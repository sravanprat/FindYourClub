export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { school, careers, clubs } = req.body;
  if (!school || !careers || !clubs) return res.status(400).json({ error: 'Missing data' });

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

  try {
    const response = await fetch('https://anthropic.helicone.ai/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
        'Helicone-Property-Feature': 'podcast-script',
        'Helicone-Property-School': school,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    return res.status(200).json({ script: data.content[0].text.trim() });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
