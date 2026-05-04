# FindYourClub

FindYourClub helps high school students discover the right clubs based on their interests and career goals.

🌐 Live at: https://find-your-club-seven.vercel.app

---

## Table of Contents

- [How It Works — End to End](#how-it-works--end-to-end)
- [How It Was Built — Engineering & Product Overview](#how-it-was-built--engineering--product-overview)
  - [Frontend](#frontend)
  - [School Search](#school-search)
  - [Club Recommendations — Agentic Orchestration](#club-recommendations--agentic-orchestration)
  - [Human-in-the-Loop Feedback](#human-in-the-loop-feedback)
  - [Personalization — localStorage](#personalization--localstorage)
  - [Podcast Feature](#podcast-feature)
  - [LLM Observability — LangSmith](#llm-observability--langsmith)
  - [Security & Reliability](#security--reliability)
  - [Save & Share — PDF, Infographic, Start Over](#save--share--pdf-infographic-start-over)
  - [Testing — Playwright via GitHub Actions](#testing--playwright-via-github-actions)
  - [Infrastructure Summary](#infrastructure-summary)

---

## How It Works — End to End

**1. You answer 5 quick questions** about what you enjoy — building things, helping people, solving problems, etc. The app scores your answers behind the scenes and matches you to careers from real U.S. Bureau of Labor Statistics data.

**2. You pick up to 2 careers** that excite you. Each one shows salary, job growth, and whether AI is likely to help or disrupt that field in the future.

**3. You type your high school name.** As you type, the app searches a database of 102,000 U.S. public schools in real time to find your school.

**4. Here's where the AI magic happens.** The moment you click "Find My Clubs", four specialized AI agents run in sequence on our server:

- 🔍 **School Research Agent** — searches the web for your school's clubs and activities pages using Brave Search, then summarizes what it finds.
- 🎓 **Career Analysis Agent** — identifies the top skills, activity types, and leadership experiences needed for your chosen career. *(runs in parallel with School Research)*
- ✨ **Club Recommendation Agent** — receives both outputs and synthesizes them into a ranked, personalized list of clubs with reasons why each one fits your school and career path.
- 🤖 **Critique Agent** — acts as an impartial judge, scoring each club 1–10 on fit and producing a one-line critique. Scores appear as color-coded badges on every club card.

**5. You get your personalized club roadmap** — ranked by priority, with research links from the web search so you can explore further.

**6. 👍 Rate and refine** — each club card has a thumbs up / thumbs down. After rating, a "✨ Refine My List" bar appears. Tap it and the agents re-run with your feedback — liked clubs guide similar suggestions, disliked clubs get replaced. This is the **human-in-the-loop** pattern.

**7. 👋 Your results are saved** — next time you visit, a "Your Past Results" card shows your last 3 searches. Tap "View →" to jump straight back without retaking the quiz.

**8. 🎧 Listen as Podcast** — the app turns your club roadmap into a personalized 90-second audio episode. Claude writes the script, OpenAI's Nova voice reads it aloud in your browser.

**9. 📊 Save as Infographic** — export your club roadmap as a downloadable image or PDF to share with parents or your school counselor.

---

> **The big idea:** Four AI agents work in a coordinated pipeline — two in parallel to research your school and career, one to synthesize recommendations, and one to independently judge the quality of those recommendations. You rate the results and the agents refine. This is **agentic AI with self-evaluation and a human feedback loop** — the same architecture used in production AI systems.

---

## How It Was Built — Engineering & Product Overview

This section documents how all services and APIs are wired together. Updated as the product evolves.

---

### Frontend
- **Single-file app** — `index.html` contains all HTML, CSS, and JavaScript. No frameworks, no build tools.
- **Hosted on Vercel** as a static site with serverless API functions co-located in `/api/`.
- **Mobile responsive** — custom media queries for screens under 480px, including iOS zoom fix (16px input font size).

---

### School Search
- **API:** [OpenDataSoft US Public Schools Dataset](https://public.opendatasoft.com/explore/dataset/us-public-schools)
- **How:** Called directly from the browser as the user types. Returns up to 20 matching schools with name, city, state, and county.
- **Why:** Urban Institute API was evaluated but rejected — it did not support text-based school name filtering.

---

### Club Recommendations — Agentic Orchestration
The core of the product. Three specialized AI agents, each with its own system prompt and Claude Haiku call, are coordinated by an orchestrator inside `/api/orchestrate.js`.

**How it runs:**

```
        ┌─────────────────────────────────────────────┐
        │                 Orchestrator                │
        └────────┬────────────────────┬───────────────┘
                 │ (parallel)         │ (parallel)
        ┌────────▼──────┐    ┌────────▼──────┐
        │   Agent 1     │    │   Agent 2     │
        │ School        │    │ Career        │
        │ Research      │    │ Analysis      │
        └────────┬──────┘    └────────┬──────┘
                 └─────────┬──────────┘
                   ┌───────▼────────┐
                   │   Agent 3      │
                   │ Club           │
                   │ Recommendations│
                   └───────┬────────┘
                   ┌───────▼────────┐
                   │   Agent 4      │
                   │ Critique /     │
                   │ LLM as Judge   │
                   └───────┬────────┘
                           │
                    Scored JSON response
```

**Agent 1 — School Research Agent** (runs in parallel with Agent 2)
- Searches the web (Brave Search API) for `[school name] clubs activities student organizations`
- Feeds the top 5 results into Claude Haiku with a school-profiling system prompt
- Returns a concise summary of the school's extracurricular landscape

**Agent 2 — Career Analysis Agent** (runs in parallel with Agent 1)
- Claude Haiku call with a career counselor system prompt
- Identifies the top skills, activity types, and leadership experiences for the target career

**Agent 3 — Club Recommendation Agent** (runs after both complete)
- Receives the outputs of Agent 1 and Agent 2 together
- Synthesizes school context + career requirements into a ranked list of 5-7 clubs
- Returns structured JSON: club names, HIGH/MEDIUM priority, personalized reasons
- If user feedback is present, the prompt is extended: liked clubs guide similar suggestions; disliked clubs are excluded

**Agent 4 — Critique Agent (LLM as Judge)** (runs after Agent 3)
- An independent Claude Haiku call acting as an impartial evaluator
- Scores each club 1.0–10.0 on alignment with the school and career path
- Produces a one-line critique per club and an overall quality score
- Scores are merged back into the club data and displayed as color-coded badges in the UI
- Logged to LangSmith as `critique-agent` for quality monitoring over time

All four agent calls are traced to LangSmith separately. Feedback refine events are logged as `club-feedback`.

> Agents 1 and 2 run concurrently via `Promise.all`. Total latency ≈ `max(Agent1, Agent2) + Agent3 + Agent4`.

---

### Human-in-the-Loop Feedback
Each club card shows a 👍 / 👎 button. Ratings are tracked per session and stored in `localStorage` under `fyc_feedback`.

- After the first rating, a **"✨ Refine My List"** bar slides up from the bottom
- Clicking it re-runs the full agent pipeline with the feedback injected into Agent 3's prompt
- Liked clubs → agent recommends similar ones; disliked clubs → agent excludes them
- Every refine event is logged to LangSmith as `club-feedback` with liked/disliked arrays and count
- Ratings history persists across sessions (up to 20 entries) — no PII, device-only

---

### Personalization — localStorage
Quiz results are persisted on the user's device using the browser's `localStorage` API — no server storage, no accounts, no PII transmitted.

- Saves up to **3 most recent results** (school, careers, clubs, search links, date)
- On page load, `initResumeCard()` checks `localStorage` and renders a "Your Past Results" card if data exists
- Each saved result has a **View →** button that calls `resumeResult(index)` to re-render the results screen instantly
- **Clear all** button wipes `fyc_results` from localStorage
- No COPPA concerns — nothing leaves the student's device
- Key: `fyc_results` — stored as a JSON array, max 3 entries, newest first

---

### Podcast Feature
Two additional serverless functions power the podcast:

**`/api/podcast.js` — Script Generation (Claude Haiku)**
- Takes school name, career goals, and club list as input
- Prompts Claude to rewrite the results as a conversational 90-second podcast script
- Persona: friendly, upbeat host speaking directly to the student

**`/api/tts.js` — Text-to-Speech (OpenAI TTS — Nova voice)**
- Sends the Claude-generated script to OpenAI's `tts-1` model
- Voice: `nova` — warm, conversational, natural-sounding
- Returns MP3 audio streamed directly to the browser's native audio player

---

### LLM Observability — LangSmith
All Claude API calls are traced to [LangSmith](https://smith.langchain.com) for monitoring and debugging.

| Trace name | What it captures |
|---|---|
| `school-research-agent` | School web search + summary |
| `career-analysis-agent` | Career skills breakdown |
| `club-recommendation-agent` | Agent 3 full prompt + club JSON |
| `critique-agent` | Agent 4 scores and critiques per club |
| `orchestrator` | End-to-end inputs, outputs, and latency |
| `club-feedback` | Liked/disliked arrays from refine events |
| `podcast-script` | Podcast script generation |

- Traces include latency, inputs, outputs, and errors
- Implemented via direct REST API calls to `api.smith.langchain.com/runs` — no npm package dependency
- Configured via `LANGCHAIN_API_KEY` and `LANGCHAIN_PROJECT` environment variables in Vercel

---

### Security & Reliability
- **API key protection** — all API keys (Anthropic, Brave, OpenAI) stored as Vercel environment variables. Never exposed to the browser.
- **Rate limiting** — `/api/orchestrate` enforces per-IP request limits (10 requests per 10 minutes) using in-memory tracking in the serverless function to prevent abuse.
- **Privacy** — no user data is collected, stored, or logged. No cookies, no sign-up, no tracking.

---

### Save & Share — PDF, Infographic, Start Over
Results are presented with a 3-action bar at the bottom — designed as equal-weight cards side by side on both desktop and mobile:

| Action | How it works |
|---|---|
| 📄 Download PDF | Browser-native `window.print()` with `@media print` CSS — no libraries |
| 📊 Infographic | Opens a modal with a styled visual card; "Save Image" uses `html2canvas` (CDN) to export PNG |
| ↩ Start Over | Resets the quiz and returns to the welcome screen |

The infographic card is rendered from the live club data — club names, priorities, reasons, school, and career goal — and exported at 2× resolution for a crisp image on mobile and desktop.

---

### Testing — Playwright via GitHub Actions
Automated tests run on every push to `main` via `.github/workflows/playwright.yml`.

| Test Suite | File | What it covers |
|---|---|---|
| End-to-end | `tests/e2e.spec.js` | Full quiz flow, school search, career selection, thumbs feedback, refine bar, infographic modal |
| Critique Agent | `tests/e2e.spec.js` | Critique banner, score badges (green/amber/gray), per-club critique text, graceful fallback when scores absent |
| Visual | `tests/visual.spec.js` | Screenshots of each screen on desktop (1280×800) and mobile (390×844), including critique banner |
| API | `tests/api.spec.js` | `/api/orchestrate` recommendations + critique scores, feedback refinement, `/api/podcast` script, error handling |

All results screens use mocked API responses (`page.route()`) so tests run fast and deterministically without hitting Claude or Brave Search. API tests hit the live Vercel deployment.

Screenshots and HTML reports are uploaded as GitHub Actions artifacts on every run.

---

### Infrastructure Summary

| Layer | Service |
|---|---|
| Hosting | Vercel (static + serverless) |
| Version control | GitHub — [sravanprat/FindYourClub](https://github.com/sravanprat/FindYourClub) |
| School data | OpenDataSoft |
| Web search | Brave Search API |
| LLM | Anthropic Claude Haiku |
| Podcast TTS | OpenAI TTS (Nova) |
| Testing | Playwright + GitHub Actions |
| Career data | U.S. Bureau of Labor Statistics |
