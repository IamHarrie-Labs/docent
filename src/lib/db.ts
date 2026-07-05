import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Lazy singleton — avoids concurrent open/DDL races when Next.js build
// workers import this module in parallel.
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, 'docent.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  _db.exec(SCHEMA);
  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  local_path TEXT NOT NULL,
  last_commit TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  commit_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB
);
CREATE INDEX IF NOT EXISTS idx_chunks_repo ON chunks(repo_id, commit_sha);

-- Analysis snapshots: one row per agent per commit. This is Docent's memory —
-- re-analyzing a later commit diffs against the previous snapshot.
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  commit_sha TEXT NOT NULL,
  agent TEXT NOT NULL,
  report TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(repo_id, commit_sha, agent)
);

-- Durable facts Docent has learned about a repo (from analyses and chats).
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  fact TEXT NOT NULL,
  source TEXT NOT NULL,
  commit_sha TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER,
  model TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  est_cost_usd REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

export default getDb;

export interface Repo {
  id: number;
  url: string;
  name: string;
  local_path: string;
  last_commit: string | null;
}

export function upsertRepo(url: string, name: string, localPath: string): Repo {
  getDb().prepare(
    `INSERT INTO repos (url, name, local_path) VALUES (?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET local_path = excluded.local_path`,
  ).run(url, name, localPath);
  return getDb().prepare('SELECT * FROM repos WHERE url = ?').get(url) as Repo;
}

export function getRepo(id: number): Repo | undefined {
  return getDb().prepare('SELECT * FROM repos WHERE id = ?').get(id) as Repo | undefined;
}

export function listRepos(): Repo[] {
  return getDb().prepare('SELECT * FROM repos ORDER BY created_at DESC').all() as Repo[];
}

export function setLastCommit(repoId: number, sha: string) {
  getDb().prepare('UPDATE repos SET last_commit = ? WHERE id = ?').run(sha, repoId);
}

export function insertChunk(
  repoId: number, commitSha: string, filePath: string,
  startLine: number, endLine: number, content: string, embedding: Float32Array,
) {
  getDb().prepare(
    `INSERT INTO chunks (repo_id, commit_sha, file_path, start_line, end_line, content, embedding)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(repoId, commitSha, filePath, startLine, endLine, content, Buffer.from(embedding.buffer));
}

export function deleteChunks(repoId: number, commitSha: string) {
  getDb().prepare('DELETE FROM chunks WHERE repo_id = ? AND commit_sha = ?').run(repoId, commitSha);
}

export interface ChunkRow {
  id: number; file_path: string; start_line: number; end_line: number;
  content: string; embedding: Buffer;
}

export function getChunks(repoId: number, commitSha: string): ChunkRow[] {
  return getDb().prepare(
    'SELECT id, file_path, start_line, end_line, content, embedding FROM chunks WHERE repo_id = ? AND commit_sha = ?',
  ).all(repoId, commitSha) as ChunkRow[];
}

export function saveSnapshot(repoId: number, commitSha: string, agent: string, report: string) {
  getDb().prepare(
    `INSERT INTO snapshots (repo_id, commit_sha, agent, report) VALUES (?, ?, ?, ?)
     ON CONFLICT(repo_id, commit_sha, agent) DO UPDATE SET report = excluded.report, created_at = datetime('now')`,
  ).run(repoId, commitSha, agent, report);
}

export function getSnapshots(repoId: number, commitSha: string): { agent: string; report: string }[] {
  return getDb().prepare(
    'SELECT agent, report FROM snapshots WHERE repo_id = ? AND commit_sha = ?',
  ).all(repoId, commitSha) as { agent: string; report: string }[];
}

export function getPreviousAnalyzedCommit(repoId: number, excludeSha: string): string | null {
  const row = getDb().prepare(
    `SELECT commit_sha, MAX(created_at) as t FROM snapshots
     WHERE repo_id = ? AND commit_sha != ? GROUP BY commit_sha ORDER BY t DESC LIMIT 1`,
  ).get(repoId, excludeSha) as { commit_sha: string } | undefined;
  return row?.commit_sha ?? null;
}

export function addFact(repoId: number, fact: string, source: string, commitSha?: string) {
  getDb().prepare('INSERT INTO facts (repo_id, fact, source, commit_sha) VALUES (?, ?, ?, ?)')
    .run(repoId, fact, source, commitSha ?? null);
}

export function getFacts(repoId: number, limit = 50): { fact: string; source: string; created_at: string }[] {
  return getDb().prepare(
    'SELECT fact, source, created_at FROM facts WHERE repo_id = ? ORDER BY id DESC LIMIT ?',
  ).all(repoId, limit) as { fact: string; source: string; created_at: string }[];
}

export function addChatMessage(repoId: number, role: string, content: string) {
  getDb().prepare('INSERT INTO chat_messages (repo_id, role, content) VALUES (?, ?, ?)').run(repoId, role, content);
}

export function getChatHistory(repoId: number, limit = 20): { role: string; content: string }[] {
  const rows = getDb().prepare(
    'SELECT role, content FROM chat_messages WHERE repo_id = ? ORDER BY id DESC LIMIT ?',
  ).all(repoId, limit) as { role: string; content: string }[];
  return rows.reverse();
}

export function recordUsage(
  repoId: number | null, model: string, kind: string,
  promptTokens: number, completionTokens: number, estCost: number,
) {
  getDb().prepare(
    `INSERT INTO usage_events (repo_id, model, kind, prompt_tokens, completion_tokens, est_cost_usd)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(repoId, model, kind, promptTokens, completionTokens, estCost);
}

export function getUsageSummary(repoId?: number) {
  const where = repoId ? 'WHERE repo_id = ?' : '';
  const args = repoId ? [repoId] : [];
  return getDb().prepare(
    `SELECT COUNT(*) as calls, SUM(prompt_tokens) as prompt_tokens,
            SUM(completion_tokens) as completion_tokens, SUM(est_cost_usd) as est_cost_usd
     FROM usage_events ${where}`,
  ).get(...args) as { calls: number; prompt_tokens: number; completion_tokens: number; est_cost_usd: number };
}
