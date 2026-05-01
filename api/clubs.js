import { Langfuse } from 'langfuse';

// Simple in-memory rate limit: 10 requests per IP per 10 minutes
const rateLimit = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    rateLimit.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimit.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests — please wait a few minutes and try again.' });
  }

  const { prompt, school } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: 'https://cloud.langfuse.com',
  });

  const trace = langfuse.trace({ name: 'club-recommendations', input: { school }, metadata: { ip } });

  try {
    let searchLinks = [];
    let searchContext = '';

    if (school && process.env.BRAVE_SEARCH_API_KEY) {
      const searchSpan = trace.span({ name: 'brave-search', input: { school } });
      const searchQuery = `${school} clubs activities student organizations`;
      const searchRes = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5`,
        { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, 'Accept': 'application/json' } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        searchLinks = (searchData.web?.results || []).map(r => ({ title: r.title, url: r.url }));
        if (searchLinks.length) {
          searchContext = `\n\nWeb search found these pages for "${school}": ${searchLinks.map(l => l.url).join(', ')}. Use this context to improve your recommendations.`;
        }
      }
      searchSpan.end({ output: { resultsCount: searchLinks.length, urls: searchLinks.map(l => l.url) } });
    }

    const fullPrompt = prompt + searchContext;
    const generation = trace.generation({
      name: 'claude-haiku-clubs',
      model: 'claude-haiku-4-5-20251001',
      input: fullPrompt,
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      generation.end({ output: { error: err.error?.message }, level: 'ERROR' });
      await langfuse.flushAsync();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const text = data.content[0].text;

    generation.end({
      output: text,
      usage: {
        input: data.usage?.input_tokens,
        output: data.usage?.output_tokens,
      },
    });

    await langfuse.flushAsync();
    return res.status(200).json({ text, searchLinks });

  } catch (err) {
    trace.update({ level: 'ERROR', output: { error: err.message } });
    await langfuse.flushAsync();
    return res.status(500).json({ error: err.message });
  }
}
