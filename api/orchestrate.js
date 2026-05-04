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

async function recommendClubs({ school_context, career_requirements, school_name, careers, feedback }) {
  // Club Recommendation Agent: synthesizes school + career data into ranked recommendations
  let feedbackSection = '';
  if (feedback && (feedback.liked?.length || feedback.disliked?.length)) {
    feedbackSection = `\n\nStudent feedback on previous recommendations:
${feedback.liked?.length  ? `Clubs they LIKED — recommend clubs similar to these: ${feedback.liked.join(', ')}` : ''}
${feedback.disliked?.length ? `Clubs they DISLIKED — exclude these and anything similar: ${feedback.disliked.join(', ')}` : ''}
Use this feedback to meaningfully improve the recommendations.`;
  }

  const res = await callClaude({
    system: 'You are a club recommendation agent. You receive research about a school and career requirements, then recommend the best clubs for a student.',
    prompt: `A freshman at "${school_name}" wants to pursue a career as: ${careers}

School profile:
${school_context}

Career requirements:
${career_requirements}${feedbackSection}

Based on all of the above, recommend the TOP 5-7 clubs ranked by importance. For each explain in 1-2 sentences why it matches both the school AND the career path. Mark each HIGH or MEDIUM priority.

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

// ── CRITIQUE AGENT ──
async function critiqueRecommendations({ clubs, school_name, careers, school_context, career_requirements }) {
  const clubList = clubs.map((c, i) =>
    `${i + 1}. ${c.name} (${c.priority}): ${c.why}`
  ).join('\n');

  const res = await callClaude({
    system: 'You are a critical evaluator acting as an impartial judge for AI-generated club recommendations. Score each club honestly — not every recommendation deserves a high score. Be rigorous.',
    prompt: `Judge these club recommendations for a student at "${school_name}" pursuing: ${careers}

School context: ${school_context}
Career requirements: ${career_requirements}

Clubs to evaluate:
${clubList}

Score each club 1.0–10.0 on how well it aligns with BOTH the school and the career path.
Scoring guide: 9–10 = exceptional fit, 7–8 = good fit, 5–6 = moderate, below 5 = weak.

Return JSON only:
{
  "overall_quality": 8.4,
  "critique_summary": "one sentence overall assessment of this roadmap",
  "clubs": [
    { "name": "Club Name", "score": 9.2, "critique": "one sentence explaining the score" }
  ]
}`,
    max_tokens: 800,
    agentName: 'critique-agent'
  });

  return { critique: res };
}

// ── ORCHESTRATOR ──
async function orchestrate({ school, careers, feedback }) {
  const startTime = Date.now();

  // Step 1: School research + career analysis in parallel
  const [schoolResult, careerResult] = await Promise.all([
    researchSchool({ school_name: school }),
    analyzeCareer({ careers }),
  ]);

  const { summary: school_context, searchLinks } = schoolResult;
  const { analysis: career_requirements } = careerResult;

  // Step 2: Recommend clubs
  const { recommendations: rawRecommendations } = await recommendClubs({
    school_context,
    career_requirements,
    school_name: school,
    careers,
    feedback,
  });

  // Parse recommendations
  const recMatch = rawRecommendations.match(/\{[\s\S]*\}/);
  if (!recMatch) throw new Error('Could not parse recommendations.');
  const recommendedData = JSON.parse(recMatch[0]);

  // Step 3: Critique agent — LLM as judge
  const { critique: rawCritique } = await critiqueRecommendations({
    clubs: recommendedData.clubs,
    school_name: school,
    careers,
    school_context,
    career_requirements,
  });

  // Merge critique scores into clubs
  try {
    const critiqueMatch = rawCritique.match(/\{[\s\S]*\}/);
    if (critiqueMatch) {
      const critiqueData = JSON.parse(critiqueMatch[0]);
      recommendedData.overall_quality = critiqueData.overall_quality;
      recommendedData.critique_summary = critiqueData.critique_summary;
      recommendedData.clubs = recommendedData.clubs.map(club => {
        const judged = critiqueData.clubs?.find(
          x => x.name.toLowerCase() === club.name.toLowerCase()
        );
        return judged ? { ...club, score: judged.score, critique: judged.critique } : club;
      });
    }
  } catch (_) {}

  const finalResult = JSON.stringify(recommendedData);

  await logToLangSmith({ name: 'orchestrator', inputs: { school, careers, feedback }, outputs: { finalResult }, startTime });

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

  const { school, careers, feedback } = req.body;
  if (!school || !careers) return res.status(400).json({ error: 'Missing school or careers' });

  // Log feedback event to LangSmith when a refine request comes in
  if (feedback && (feedback.liked?.length || feedback.disliked?.length)) {
    await logToLangSmith({
      name: 'club-feedback',
      inputs: { school, careers, liked: feedback.liked, disliked: feedback.disliked },
      outputs: { total_rated: (feedback.liked?.length || 0) + (feedback.disliked?.length || 0) },
      startTime: Date.now(),
    });
  }

  try {
    const { finalResult, searchLinks } = await orchestrate({ school, careers, feedback });

    if (!finalResult) throw new Error('No response from agents. Try again.');
    const parsed = JSON.parse(finalResult);

    return res.status(200).json({ clubs: parsed, searchLinks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
