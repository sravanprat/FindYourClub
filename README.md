# FindYourClub

FindYourClub helps high school students discover the right clubs based on their interests and career goals.

Live at: https://find-your-club-seven.vercel.app

---

## Architecture

```mermaid
flowchart TD
    User(["👤 Student"])

    subgraph Browser ["Frontend — Vercel Static"]
        UI["HTML / CSS / JS\nQuiz → Career Match → School Search → Results"]
    end

    subgraph Vercel ["Backend — Vercel Serverless"]
        Fn["/api/clubs\nOrchestrator"]
    end

    subgraph External ["External APIs"]
        ODS["🏫 OpenDataSoft\nUS Public Schools Dataset"]
        Brave["🔍 Brave Search API\nSchool Club Page Lookup"]
        Claude["🤖 Claude Haiku\nAnthropic LLM"]
    end

    User -->|"Takes quiz &\nselects school"| UI
    UI -->|"School name search"| ODS
    ODS -->|"Returns matching schools"| UI
    UI -->|"POST school + career prompt"| Fn

    Fn -->|"1 — Search for school's\nclub pages"| Brave
    Brave -->|"Returns top 5 URLs\n& page titles"| Fn
    Fn -->|"2 — Prompt + search\nresults as context"| Claude
    Claude -->|"Returns ranked club\nrecommendations as JSON"| Fn
    Fn -->|"Club list + research links"| UI
    UI -->|"Displays results"| User

    style Fn fill:#6366f1,color:#fff
    style Claude fill:#8b5cf6,color:#fff
    style Brave fill:#f59e0b,color:#fff
    style ODS fill:#10b981,color:#fff
```

### How the Agentic LLM Pattern Works

1. **Tool Call** — Before asking Claude anything, the Vercel function calls Brave Search as a tool to find real web pages for the selected school's clubs and activities.
2. **Context Injection** — The search results (URLs + titles) are injected into the Claude prompt as grounding context.
3. **Grounded Generation** — Claude generates club recommendations informed by real, up-to-date web sources rather than relying solely on training data.
4. **Structured Output** — Claude returns JSON, which the frontend parses to render ranked club cards and a Recommended Links section.

This pattern — **search → inject → generate** — is the core of agentic LLM design: the model is given tools to gather context before it reasons.
