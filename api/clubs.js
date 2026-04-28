export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, school } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    // Search for the school's club page using Brave Search
    let schoolClubUrl = null;
    let searchContext = '';

    if (school && process.env.BRAVE_SEARCH_API_KEY) {
      const searchQuery = `${school} clubs activities student organizations`;
      const searchRes = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5`,
        { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, 'Accept': 'application/json' } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData.web?.results || [];

        // Pick the most relevant URL — prefer pages with "club", "activit", "organization" in URL or title
        const best = results.find(r =>
          /club|activit|organization|student.*life/i.test(r.url + ' ' + r.title)
        ) || results[0];

        if (best) {
          schoolClubUrl = best.url;
          searchContext = `\n\nI found this page for "${school}" clubs and activities: ${best.url} — "${best.title}". Use this URL in the "url" field for every club in your response.`;
        }
      }
    }

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
        messages: [{ role: 'user', content: prompt + searchContext }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.content[0].text, schoolClubUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
