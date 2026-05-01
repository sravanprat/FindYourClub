import { Langfuse } from 'langfuse';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { school, careers, clubs } = req.body;
  if (!school || !careers || !clubs) return res.status(400).json({ error: 'Missing data' });

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: 'https://cloud.langfuse.com',
  });

  const trace = langfuse.trace({ name: 'podcast-script', input: { school, careers, clubCount: clubs.length } });

  const clubList = clubs.map((c, i) => `${i + 1}. ${c.name} (${c.priority} priority) — ${c.why}`).join('\n');

  const prompt = `You are a friendly, upbeat podcast host talking directly to a high school student.
Write a short, conversational podcast script (about 90 seconds when read aloud, roughly 200-220 words) for a student at ${school} who is interested in becoming a ${careers}.

Here are their recommended clubs:
${clubList}

Guidelines:
- Speak directly to the student as "you" — warm, encouraging, like a cool older mentor
- Open with a punchy one-liner hook, not "Welcome to FindYourClub"
- Briefly mention the top 3 clubs and why they matter for their specific career
- End with one motivating sentence to take action
- NO headers, NO bullet points — just natural flowing speech
- Keep it upbeat and real, not corporate or stiff`;

  const generation = trace.generation({
    name: 'claude-haiku-podcast',
    model: 'claude-haiku-4-5-20251001',
    input: prompt,
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      generation.end({ output: { error: err.error?.message }, level: 'ERROR' });
      await langfuse.flushAsync();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const script = data.content[0].text.trim();

    generation.end({
      output: script,
      usage: {
        input: data.usage?.input_tokens,
        output: data.usage?.output_tokens,
      },
    });

    await langfuse.flushAsync();
    return res.status(200).json({ script });

  } catch (err) {
    generation.end({ output: { error: err.message }, level: 'ERROR' });
    await langfuse.flushAsync();
    return res.status(500).json({ error: err.message });
  }
}
