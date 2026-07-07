import path from 'path';
import fs from 'fs';
import { simpleGit } from 'simple-git';
import { btl, EMBED_MODEL, trackUsage } from './btl';
import { upsertRepo, insertChunk, deleteChunks, setLastCommit, getChunks, type Repo } from './db';

// Same volume-aware root as db.ts, so cloned repos live alongside the DB.
const REPOS_DIR = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(), 'data', 'repos');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'vendor', 'target',
  '__pycache__', '.venv', 'venv', 'coverage', '.idea', '.vscode', 'out',
]);

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs',
  '.java', '.kt', '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.swift',
  '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.sql',
  '.sh', '.ps1', '.dockerfile', '.env.example', '.html', '.css', '.scss',
  '.vue', '.svelte', '.prisma', '.graphql', '.proto',
]);

const MAX_FILE_BYTES = 200_000;
const CHUNK_LINES = 60;
const CHUNK_OVERLAP = 10;
const MAX_CHUNKS = 1200; // safety cap for very large repos

export interface IngestProgress {
  phase: 'clone' | 'walk' | 'embed' | 'done';
  detail: string;
  filesIndexed?: number;
  chunksEmbedded?: number;
  totalChunks?: number;
}

export function repoNameFromUrl(url: string): string {
  return url.replace(/\.git$/, '').split('/').filter(Boolean).slice(-2).join('__').replace(/[^\w.-]/g, '_');
}

/** Clone (or pull) a repo, returning the Repo row + HEAD sha. */
export async function cloneOrUpdate(url: string): Promise<{ repo: Repo; sha: string }> {
  const name = repoNameFromUrl(url);
  const localPath = path.join(REPOS_DIR, name);
  if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });

  if (fs.existsSync(path.join(localPath, '.git'))) {
    const git = simpleGit(localPath);
    try { await git.fetch(); await git.pull(); } catch { /* offline or detached — analyze what we have */ }
  } else {
    await simpleGit().clone(url, localPath, ['--depth', '50']);
  }
  const sha = (await simpleGit(localPath).revparse(['HEAD'])).trim();
  const repo = upsertRepo(url, name, localPath);
  return { repo, sha };
}

export function walkFiles(root: string): string[] {
  const results: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) stack.push(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        const base = e.name.toLowerCase();
        if (TEXT_EXTS.has(ext) || base === 'dockerfile' || base === 'makefile' || base === 'readme') {
          try {
            if (fs.statSync(full).size <= MAX_FILE_BYTES) results.push(full);
          } catch { /* ignore */ }
        }
      }
    }
  }
  return results;
}

function chunkFile(relPath: string, content: string): { start: number; end: number; text: string }[] {
  const lines = content.split('\n');
  const chunks: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i += CHUNK_LINES - CHUNK_OVERLAP) {
    const end = Math.min(i + CHUNK_LINES, lines.length);
    const text = lines.slice(i, end).join('\n').trim();
    if (text.length > 20) chunks.push({ start: i + 1, end, text: `FILE: ${relPath}\n${text}` });
    if (end >= lines.length) break;
  }
  return chunks;
}

/** Index a repo at a commit: walk, chunk, embed via BTL, store in SQLite. */
export async function indexRepo(
  repo: Repo, sha: string,
  onProgress?: (p: IngestProgress) => void,
): Promise<{ files: number; chunks: number }> {
  onProgress?.({ phase: 'walk', detail: 'Scanning files…' });
  const files = walkFiles(repo.local_path);

  const allChunks: { file: string; start: number; end: number; text: string }[] = [];
  for (const f of files) {
    const rel = path.relative(repo.local_path, f).replace(/\\/g, '/');
    let content: string;
    try { content = fs.readFileSync(f, 'utf-8'); } catch { continue; }
    for (const c of chunkFile(rel, content)) {
      allChunks.push({ file: rel, start: c.start, end: c.end, text: c.text });
    }
    if (allChunks.length >= MAX_CHUNKS) break;
  }

  deleteChunks(repo.id, sha);
  const BATCH = 64;
  let embedded = 0;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    const res = await btl.embeddings.create({
      model: EMBED_MODEL,
      input: batch.map((c) => c.text.slice(0, 8000)),
    });
    trackUsage(repo.id, EMBED_MODEL, 'embed', res.usage as { prompt_tokens?: number });
    res.data.forEach((d, j) => {
      const c = batch[j];
      insertChunk(repo.id, sha, c.file, c.start, c.end, c.text, new Float32Array(d.embedding));
    });
    embedded += batch.length;
    onProgress?.({
      phase: 'embed',
      detail: `Embedded ${embedded}/${allChunks.length} chunks`,
      chunksEmbedded: embedded, totalChunks: allChunks.length, filesIndexed: files.length,
    });
  }

  setLastCommit(repo.id, sha);
  onProgress?.({ phase: 'done', detail: `Indexed ${files.length} files, ${allChunks.length} chunks` });
  return { files: files.length, chunks: allChunks.length };
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function retrieve(
  repoId: number, sha: string, query: string, k = 8,
): Promise<{ file_path: string; start_line: number; end_line: number; content: string; score: number }[]> {
  const res = await btl.embeddings.create({ model: EMBED_MODEL, input: [query] });
  trackUsage(repoId, EMBED_MODEL, 'embed', res.usage as { prompt_tokens?: number });
  const q = new Float32Array(res.data[0].embedding);

  const rows = getChunks(repoId, sha);
  const scored = rows.map((r) => ({
    file_path: r.file_path, start_line: r.start_line, end_line: r.end_line, content: r.content,
    score: cosine(q, new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
