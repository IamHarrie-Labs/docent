# BTL Runtime Hackathon — Submission

**Team:** Stanley Nnaka (solo)
**Project:** Docent
**Repo:** https://github.com/IamHarrie-Labs/docent

## Short description

Docent turns any GitHub repo into a living onboarding portal. Paste a URL and a
swarm of six agents explores the codebase in parallel — architecture, quickstart,
config/env audit, dependencies, a system diagram, a guided tour — streaming live.
Then it does something no docs generator does: it **remembers**. Re-analyze the
repo after new commits land and Docent tells you exactly what changed since its
last visit, citing files, and flags which of its own prior conclusions are now
stale. A chat panel answers questions about the repo with file citations, using
retrieval plus everything Docent has learned across sessions.

## BTL Runtime endpoints used

- `/v1/chat/completions` — all six analyst agents, the memory-briefing synthesis, and repo chat (streamed)
- `/v1/chat/completions` with `tools` — agents call `list_files`, `read_file`, `search_code` against the cloned repo
- `/v1/embeddings` — whole-repo semantic index (`text-embedding-3-small`) for retrieval
- Streaming (SSE) end-to-end from every agent into the dashboard
- Usage returned on every call is tracked into a live cost meter (est. $0.006 for a full 6-agent analysis + memory briefing + one chat turn on a real repo)
- Models used: `deepseek-v4-flash` (agents), `deepseek-v4-pro` (synthesis/chat) — swappable via `.env`

## Verified demo

Analyzed https://github.com/IamHarrie-Labs/tinytasks-api (a small repo created for this test) at two commits:
1. Inline auth checks duplicated across routes
2. Auth extracted into `middleware/auth.js`, a new endpoint added

On the second analysis, Docent's memory briefing correctly identified the
extraction, cited the new file, and flagged that its earlier conclusion
("auth is implemented inline via checkAuth()") was now stale — without being
told anything had changed.

## Rubric self-assessment (their 100-pt scale)

- **Use of runtime (30):** every code path — swarm, memory, chat, retrieval — is a live BTL call; nothing is mocked or cached from another provider.
- **Usefulness (25):** solves a universal problem (onboarding to unfamiliar code) for new hires, OSS contributors, and — pointedly — for judges evaluating hackathon submissions.
- **Technical execution (20):** real multi-agent tool-use loop (not a single prompt), commit-aware persistent memory backed by SQLite, working retrieval, live SSE dashboard.
- **Creativity (15):** memory that compounds across sessions is the differentiator — most repo-chat tools reset every run.
- **Presentation (10):** live streaming dashboard makes the swarm visible, not just a spinner.

## Demo video shot list (2 min)

1. **(0:00–0:15)** One-line pitch over the dashboard: "Docent turns any repo into
   a living onboarding portal — and it remembers." Paste `tinytasks-api` v1 URL, hit Analyze.
2. **(0:15–0:45)** Six panes streaming live — architecture, quickstart, config
   audit, dependencies, diagram rendering, guided tour. Cost meter ticking up in real time.
3. **(0:45–1:00)** Ask the chat "Where does auth happen?" — answer streams in with `server.js:12-21` citation.
4. **(1:00–1:15)** Cut to terminal: `git commit` extracting auth into middleware, `git push`.
5. **(1:15–1:45)** Re-run Analyze on the same repo. The memory pane appears:
   "What changed since my last visit" — reads out loud: auth moved, stale
   conclusion flagged, cites the new file.
6. **(1:45–2:00)** Cost meter final read (~$0.006, 30 calls). Close on:
   "Every call — chat completions, tool use, embeddings, streaming — through
   the BTL Runtime."
