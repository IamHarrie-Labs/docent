# Docent

**A living onboarding portal for any codebase — with memory that compounds.**

Point Docent at any GitHub repository. Six named engineers — The Architect, The DevOps Engineer, The Security Engineer, The Dependency Engineer, The Systems Cartographer, and The Mentor — explore it in parallel, each with their own tools and point of view, streaming an architecture overview, quickstart guide, config/security audit, dependency report, system diagram, and a guided tour for new contributors.

Then they compare notes. **The Debate & Consensus** step reads all six reports and surfaces where they actually disagree (or, when they don't, says so honestly instead of inventing conflict) — then ends with a ranked, attributed list of what the next contributor should fix first.

And the part nobody else does: **Docent remembers.** Analyze the repo again after fifty commits and The Historian tells you *what changed since its last visit* — "auth used to live in middleware, it moved to a service" — diffing its own past understanding against the new code. Ask it questions and it recalls previous conversations. It's not a docs generator; it's a codebase companion that gets smarter every time you return.

Every report, the debate, and the memory briefing are saved as they're generated, so closing the tab or coming back tomorrow doesn't lose anything — reopening the analyze page restores your last session automatically. An **Export report** button bundles all of it (all six agent reports, the debate/consensus, the memory briefing) into a single Markdown file you can keep, share, or feed into another tool.

Built solo in 48 hours for the **BTL Runtime Hackathon** (Jul 2026).

**Live:** [trydocent-production.up.railway.app](https://trydocent-production.up.railway.app)

## Powered by the BTL Runtime

Every LLM call goes through the BTL gateway at `api.badtheorylabs.com/v1`:

| Runtime feature | Where Docent uses it |
| --- | --- |
| **Chat Completions** (`/v1/chat/completions`) | All six analyst agents, debate/consensus synthesis, memory briefings, repo chat |
| **Tool Use** | Agents call `list_files`, `read_file`, `search_code` to explore the repo |
| **Streaming** | Every agent streams live into its own dashboard pane (SSE) |
| **Embeddings** (`/v1/embeddings`) | Whole-repo semantic index (`text-embedding-3-small`) powering retrieval |
| **Retrieval & Memory** | SQLite vector store + persistent facts, snapshots, chat history per repo |
| **Usage & Billing** | Per-call usage tracked into a live cost meter — a full repo analysis costs cents |
| **Multi-provider** | `deepseek-v4-flash` for the swarm, `deepseek-v4-pro` for synthesis — swap models via `.env` |

## Run it

```bash
npm install
cp .env.example .env   # add your BTL_API_KEY
npm run dev            # http://localhost:3000
```

- `/` — landing page (the pitch)
- `/analyze` — the actual product: paste a repo URL, hit **Analyze**, watch the swarm work
- `/docs` — how it works, the runtime endpoints used, how to run it locally

Then commit something to the repo and analyze again — the "What changed since my last visit" briefing appears.

## See it work

Analyzed [`tinytasks-api`](https://github.com/IamHarrie-Labs/tinytasks-api), a small demo repo, twice — before and after a commit that extracted inline auth checks into shared middleware. On the second run, Docent's memory briefing said, unprompted:

> Auth was extracted, a new endpoint appeared, and the TODO was retired. The inline `checkAuth()` function in `server.js` that was duplicated across every protected route has been lifted into `middleware/auth.js` as proper Express middleware (`requireAuth`)... [Previous conclusion] "Auth is implemented inline via `checkAuth()`"... now stale.

Full run — 6 agents, debate/consensus, memory briefing — costs well under a cent (~$0.008 across ~37 runtime calls on a real repo).

## Architecture

```
Next.js app
├── /                landing page
├── /analyze         the dashboard — repo input, live agent panes, debate, memory, chat
├── /docs            how it works
├── /api/analyze     SSE: clone → embed index → 6 parallel tool-use agents → debate/consensus + memory briefing
├── /api/chat        retrieval (BTL embeddings) + memory → streamed, cited answers
├── /api/snapshot    fetch saved reports/debate/memory for a repo+commit → restores a session on reload
├── /api/usage       live cost meter
└── SQLite (better-sqlite3, on a Railway volume in production)
    ├── repos         one row per analyzed repo, tracks last_commit + updated_at
    ├── chunks        embedded code chunks per commit
    ├── snapshots     every agent report, the debate, and the memory briefing per commit ← memory + export
    ├── facts         durable knowledge extracted from analyses & chats
    └── usage_events  per-call token/cost ledger
```

Styling: Tailwind CSS v4 + Almarai (grotesque sans, via `next/font`) with Instrument Serif italic as an accent typeface, dark warm cream palette across all three pages, all agent output rendered through `marked` (full markdown, including tables and lists) instead of raw text.

Deployed on Railway rather than Vercel: this app persists everything (SQLite, cloned repos, embeddings) to local disk and runs long streaming analyze requests, both of which need a long running process rather than ephemeral serverless functions.

## Team

Stanley Nnaka (solo)
