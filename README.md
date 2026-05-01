# FindYourClub

FindYourClub helps high school students discover the right clubs based on their interests and career goals.

🌐 Live at: https://find-your-club-seven.vercel.app

---

## Table of Contents

- [How It Works — End to End](#how-it-works--end-to-end)
- [How It Was Built — Engineering & Product Overview](#how-it-was-built--engineering--product-overview)
  - [Frontend](#frontend)
  - [School Search](#school-search)
  - [Club Recommendations — Agentic LLM Pipeline](#club-recommendations--agentic-llm-pipeline)
  - [Personalization — localStorage](#personalization--localstorage)
  - [Podcast Feature](#podcast-feature)
  - [LLM Observability — LangSmith](#llm-observability--langsmith)
  - [Security & Reliability](#security--reliability)
  - [PDF Export](#pdf-export)
  - [Testing — Playwright via GitHub Actions](#testing--playwright-via-github-actions)
  - [Infrastructure Summary](#infrastructure-summary)

---

## How It Works — End to End

**1. You answer 5 quick questions** about what you enjoy — building things, helping people, solving problems, etc. The app scores your answers behind the scenes and matches you to careers from real U.S. Bureau of Labor Statistics data.

**2. You pick up to 2 careers** that excite you. Each one shows salary, job growth, and whether AI is likely to help or disrupt that field in the future.

**3. You type your high school name.** As you type, the app searches a database of 102,000 U.S. public schools in real time to find your school.

**4. Here's where the AI magic happens.** The moment you click "Find My Clubs", three things happen in sequence on our server:

- 🔍 **We search the web first** — using Brave Search, we look up your school's clubs and activities pages and grab the top results.
- 💉 **We feed that into the AI** — those real URLs and page descriptions get added to the prompt we send to Claude (Anthropic's AI), so it's working with fresh, school-specific context — not just guessing from memory.
- ✨ **Claude thinks and responds** — it reads your career goals, your school, and the web search context, then returns a ranked list of clubs with personalized reasons why each one helps your specific career path.

**5. You get your personalized club roadmap** — ranked by priority, with research links pulled from the web search so you can explore further.

**6. 👋 Your results are saved** — next time you visit, a "Your Past Results" card appears on the home screen showing your last 3 searches. Tap "View →" on any of them to jump straight back to those club recommendations without retaking the quiz. Hit "Clear all" to remove them from your device.

**7. 🎧 Listen as Podcast** — click the podcast button and the app turns your club roadmap into a personalized 90-second audio episode. Claude rewrites the results as a conversational podcast script, then OpenAI's Nova voice reads it aloud — playing directly in your browser. You can also expand the script to read it yourself.

---

> **The big idea:** Instead of just asking an AI "what clubs should I join?", we first go fetch real information about your specific school, then hand that to the AI as context. This is called the **Search → Inject → Generate** pattern — the foundation of how modern AI agents work.

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

### Club Recommendations — Agentic LLM Pipeline
This is the core of the product. Three services work in sequence inside `/api/clubs.js`:

**Step 1 — Web Search (Brave Search API)**
- Searches for `[school name] clubs activities student organizations`
- Returns top 5 URLs and page titles from the school's actual website
- Grounds Claude in real, current data rather than training memory

**Step 2 — Context Injection**
- Search results are appended to the Claude prompt before sending
- Claude receives: career goals + school name + live web search context

**Step 3 — LLM Generation (Claude Haiku — Anthropic)**
- Model: `claude-haiku-4-5-20251001`
- Returns structured JSON: ranked clubs, priorities, reasons, and optional URLs
- Response is parsed and rendered as club cards in the UI

> This **Search → Inject → Generate** pattern is the foundation of modern AI agent design.

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

- **`club-recommendations`** — traces every club recommendation call with school name, full prompt, and Claude's response
- **`podcast-script`** — traces every podcast script generation with school, careers, and output script
- Traces include latency, inputs, outputs, and errors
- Implemented via direct REST API calls to `api.smith.langchain.com/runs` — no npm package dependency
- Configured via `LANGCHAIN_API_KEY` and `LANGCHAIN_PROJECT` environment variables in Vercel

---

### Security & Reliability
- **API key protection** — all API keys (Anthropic, Brave, OpenAI) stored as Vercel environment variables. Never exposed to the browser.
- **Rate limiting** — `/api/clubs` enforces per-IP request limits using in-memory tracking in the serverless function to prevent abuse.
- **Privacy** — no user data is collected, stored, or logged. No cookies, no sign-up, no tracking.

---

### PDF Export
- Uses the browser's native `window.print()` — no libraries required.
- Custom `@media print` CSS hides navigation, buttons, and footer, and formats the results as a clean printable document.

---

### Testing — Playwright via GitHub Actions
Automated tests run on every push to `main` via `.github/workflows/playwright.yml`.

| Test Suite | File | What it covers |
|---|---|---|
| End-to-end | `tests/e2e.spec.js` | Full quiz flow, school search, career selection |
| Visual | `tests/visual.spec.js` | Screenshots of each screen (desktop + mobile) |
| API | `tests/api.spec.js` | `/api/clubs` and `/api/podcast` responses and error handling |

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
