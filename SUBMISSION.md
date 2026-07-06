# BTL Runtime Hackathon — Submission

**Team:** Stanley Nnaka (solo)
**Project:** Docent
**Repo:** https://github.com/IamHarrie-Labs/docent

## Short description

Docent turns any GitHub repo into a living onboarding portal. Paste a URL and six
named engineers — Architect, DevOps, Security, Dependency, Cartographer, Mentor —
explore the codebase in parallel, streaming their reports live. Then they compare
notes: a **Debate & Consensus** step reads all six reports, surfaces genuine
points of tension between them (or says plainly when there aren't any — no
manufactured drama), and ends with a ranked, attributed action list. Then it does
something no docs generator does: it **remembers**. Re-analyze the repo after new
commits land and The Historian tells you exactly what changed since its last
visit, citing files, and flags which of its own prior conclusions are now stale.
A chat panel answers questions about the repo with file citations, using
retrieval plus everything Docent has learned across sessions.

## BTL Runtime endpoints used

- `/v1/chat/completions` — all six analyst agents, the debate/consensus synthesis, the memory-briefing synthesis, and repo chat (streamed)
- `/v1/chat/completions` with `tools` — agents call `list_files`, `read_file`, `search_code` against the cloned repo
- `/v1/embeddings` — whole-repo semantic index (`text-embedding-3-small`) for retrieval
- Streaming (SSE) end-to-end from every agent into the dashboard
- Usage returned on every call is tracked into a live cost meter (~$0.008 for a full 6-agent analysis + debate + memory briefing on a real repo, ~37 runtime calls)
- Models used: `deepseek-v4-flash` (agents), `deepseek-v4-pro` (debate/memory synthesis, chat) — swappable via `.env`

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
- **Creativity (15):** two differentiators most repo-chat tools don't have — memory that compounds across sessions (flags its own stale conclusions), and a debate/consensus step where six independent agent reports are cross-examined for real tension rather than just concatenated.
- **Presentation (10):** live streaming dashboard makes the swarm visible, not just a spinner.

## Demo video shot list (2 min)

1. **(0:00–0:12)** One-line pitch over the dashboard: "Docent turns any repo into
   a team of engineers who explore it, argue about it, and remember it." Paste
   `tinytasks-api` v1 URL, hit Analyze.
2. **(0:12–0:35)** Six named panes streaming live — Architect, DevOps, Security,
   Dependency, Cartographer, Mentor. Cost meter ticking up in real time.
3. **(0:35–0:55)** Debate & Consensus panel appears — read out loud one point of
   tension between two agents' findings, then the ranked consensus list.
4. **(0:55–1:05)** Ask the chat "Where does auth happen?" — answer streams in
   with `server.js:12-21` citation.
5. **(1:05–1:15)** Cut to terminal: `git commit` extracting auth into middleware, `git push`.
6. **(1:15–1:45)** Re-run Analyze on the same repo. The Historian's memory pane
   appears: "What changed since my last visit" — reads out loud: auth moved,
   stale conclusion flagged, cites the new file.
7. **(1:45–2:00)** Cost meter final read (~$0.008, ~37 calls). Close on:
   "Every call — chat completions, tool use, embeddings, streaming — through
   the BTL Runtime."
