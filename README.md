# Docent

**A living onboarding portal for any codebase — with memory that compounds.**

Point Docent at any GitHub repository. A swarm of six analyst agents explores it in parallel — reading files, searching code, following the evidence — and streams back an architecture overview, quickstart guide, config/env audit, dependency report, system diagram, and a guided tour for new contributors.

Then the part nobody else does: **Docent remembers.** Analyze the repo again after fifty commits and it tells you *what changed since its last visit* — "auth used to live in middleware, it moved to a service" — diffing its own past understanding against the new code. Ask it questions and it recalls previous conversations. It's not a docs generator; it's a codebase companion that gets smarter every time you return.

Built solo in 48 hours for the **BTL Runtime Hackathon** (Jul 2026).

## Powered by the BTL Runtime

Every LLM call goes through the BTL gateway at `api.badtheorylabs.com/v1`:

| Runtime feature | Where Docent uses it |
| --- | --- |
| **Chat Completions** (`/v1/chat/completions`) | All six analyst agents, memory briefings, repo chat |
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

Paste a repo URL, hit **Analyze**, watch the swarm work. Then commit something to the repo and analyze again — the "What changed since my last visit" briefing appears.

## Architecture

```
Next.js app
├── /api/analyze   SSE: clone → embed index → 6 parallel tool-use agents + memory briefing
├── /api/chat      retrieval (BTL embeddings) + memory → streamed, cited answers
├── /api/usage     live cost meter
└── SQLite (better-sqlite3)
    ├── chunks      embedded code chunks per commit
    ├── snapshots   each agent's report per commit  ← memory
    ├── facts       durable knowledge extracted from analyses & chats
    └── usage_events per-call token/cost ledger
```

## Team

Stanley Nnaka (solo)
