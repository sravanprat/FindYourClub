# FindYourClub

FindYourClub helps high school students discover the right clubs based on their interests and career goals.

🌐 Live at: https://find-your-club-seven.vercel.app

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

**6. 🎧 Listen as Podcast** — click the podcast button and the app turns your club roadmap into a personalized 90-second audio episode. Claude rewrites the results as a conversational podcast script, then OpenAI's Nova voice reads it aloud — playing directly in your browser. You can also expand the script to read it yourself.

---

> **The big idea:** Instead of just asking an AI "what clubs should I join?", we first go fetch real information about your specific school, then hand that to the AI as context. This is called the **Search → Inject → Generate** pattern — the foundation of how modern AI agents work.
