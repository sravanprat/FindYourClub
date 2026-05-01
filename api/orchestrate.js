// ── AGENT TOOLS ──

async function researchSchool({ school_name }) {
  // School Research Agent: searches web + profiles the school's clubs
  let searchContext = '';
  let searchLinks = [];

  if (process.env.BRAVE_SEARCH_API_KEY) {
    const searchRes = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(school_name + ' clubs activities student organizations')}&count=5`,
      { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, 'Accept': 'application/json' } }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      searchLinks = (data.web?.results || []).map(r => ({ title: r.title, url: r.url }));
      searchContext = searchLinks.map(r => `- ${r.title}: ${r.url}`).join('\n');
    }
  }

  const res = await callClaude({
    system: 'You are a school research agent. Your job is to profile a high school\'s extracurricular offerings based on web search results.',
    prompt: `Research "${school_name}" and summarize what clubs, activities, and student organizations are available there.
Web search results:
${searchContext || 'No web results found — use your knowledge of typical high schools in this area.'}

Return a concise summary of the school's extracurricular landscape in 3-5 sentences.`,
    max_tokens: 400,
    agentName: 'school-research-agent'
  });

  return { summary: res, searchLinks };
}

async function analyzeCareer({ careers }) {
  // Career Analysis Agent: maps careers to skills and relevant activity types
  const res = await callClaude({
    system: 'You are a career counselor agent. Your job is to identify the key skills, experiences, and extracurricular activities that best prepare high school students for specific careers.',
    prompt: `Analyze what a high school student needs to prepare for a career as: ${careers}

List:
1. Top 3 skills they should develop
2. Types of extracurricular activities that build those skills
3. Leadership experiences that would stand out

Be specific and concise — 4-6 sentences total.`,
    max_tokens: 400,
    agentName: 'career-analysis-agent'
  });

  return { analysis: res };
}

async function recommendClubs({ school_context, career_requirements, school_name, careers }) {
  // Club Recommendation Agent: synthesizes school + career data into ranked recommendations
  const res = await callClaude({
    system: 'You are a club recommendation agent. You receive research about a school and career requirements, then recommend the best clubs for a student.',
    prompt: `A freshman at "${school_name}" wants to pursue a career as: ${careers}

School profile:
${school_context}

Career requirements:
${career_requirements}

Based on both, recommend the TOP 5-7 clubs ranked by importance. For each explain in 1-2 sentences why it matches both the school AND the career path. Mark each HIGH or MEDIUM priority.

Return JSON only:
{
  "school_note": "one sentence about how well you know this school's specific clubs",
  "clubs": [
    { "name": "Club Name", "priority": "HIGH", "why": "reason", "url": null }
  ]
}`,
    max_tokens: 1200,
    agentName: 'club-recommendation-agent'
  });

  return { recommendations: res };
}

// ── CLAUDE HELPER ──
async function callClaude({ system, prompt, max_tokens, agentName }) {
  const startTime = Date.now();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Claude API error');
  }

  const data = await response.json();

  // Log to LangSmith
  await logToLangSmith({ name: agentName, inputs: { prompt }, outputs: { text: data.content[0].text }, startTime });

  return data.content[0].text;
}

// ── ORCHESTRATOR (Claude with tool use) ──
async function orchestrate({ school, careers }) {
  const tools = [
    {
      name: 'research_school',
      description: 'Research a school\'s available clubs and activities using web search. Call this first.',
      input_schema: {
        type: 'object',
        properties: { school_name: { type: 'string', description: 'Full name of the high school' } },
        required: ['school_name']
      }
    },
    {
      name: 'analyze_career',
      description: 'Analyze what skills and activities are important for a career path. Call this second.',
      input_schema: {
        type: 'object',
        properties: { careers: { type: 'string', description: 'Career(s) the student is interested in' } },
        required: ['careers']
      }
    },
    {
      name: 'recommend_clubs',
      description: 'Recommend clubs based on school research and career analysis. Call this last after you have both research results.',
      input_schema: {
        type: 'object',
        properties: {
          school_context: { type: 'string' },
          career_requirements: { type: 'string' },
          school_name: { type: 'string' },
          careers: { type: 'string' }
        },
        required: ['school_context', 'career_requirements', 'school_name', 'careers']
      }
    }
  ];

  const messages = [{
    role: 'user',
    content: `A high school freshman at "${school}" is interested in becoming a ${careers}.
Use your tools to: 1) research the school, 2) analyze the career requirements, 3) recommend the best clubs.
Call all three tools in order.`
  }];

  let searchLinks = [];
  let finalResult = null;
  const startTime = Date.now();

  // Agentic loop — keep going until Claude stops calling tools
  for (let i = 0; i < 10; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        tools,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Orchestrator error');
    }

    const data = await res.json();
    messages.push({ role: 'assistant', content: data.content });

    if (data.stop_reason === 'end_turn') {
      // Claude finished — extract final text response
      const textBlock = data.content.find(b => b.type === 'text');
      if (textBlock) finalResult = textBlock.text;
      break;
    }

    if (data.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;

        let toolOutput;
        if (block.name === 'research_school') {
          const result = await researchSchool(block.input);
          searchLinks = result.searchLinks;
          toolOutput = result.summary;
        } else if (block.name === 'analyze_career') {
          const result = await analyzeCareer(block.input);
          toolOutput = result.analysis;
        } else if (block.name === 'recommend_clubs') {
          const result = await recommendClubs(block.input);
          toolOutput = result.recommendations;
          finalResult = result.recommendations;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  await logToLangSmith({ name: 'orchestrator', inputs: { school, careers }, outputs: { finalResult }, startTime });

  return { finalResult, searchLinks };
}

// ── LANGSMITH LOGGING ──
async function logToLangSmith({ name, inputs, outputs, startTime }) {
  if (!process.env.LANGCHAIN_API_KEY) return;
  try {
    await fetch('https://api.smith.langchain.com/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.LANGCHAIN_API_KEY },
      body: JSON.stringify({
        name,
        run_type: 'chain',
        inputs,
        outputs,
        start_time: startTime,
        end_time: Date.now(),
        extra: { project: process.env.LANGCHAIN_PROJECT || 'FindYourClub' },
      }),
    });
  } catch (_) {}
}

// ── RATE LIMITING ──
const rateLimit = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) { rateLimit.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  rateLimit.set(ip, entry);
  return false;
}

// ── HANDLER ──
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests — please wait a few minutes and try again.' });

  const { school, careers } = req.body;
  if (!school || !careers) return res.status(400).json({ error: 'Missing school or careers' });

  try {
    const { finalResult, searchLinks } = await orchestrate({ school, careers });

    const jsonMatch = finalResult?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse agent response. Try again.');
    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json({ clubs: parsed, searchLinks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
