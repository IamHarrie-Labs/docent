import fs from 'fs';
import path from 'path';
import { walkFiles } from './ingest';

// Tool definitions given to every analyst agent — executed locally against the
// cloned repo, wired through BTL's OpenAI-compatible tool-use protocol.

export const TOOL_DEFS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List files in the repository, optionally under a subdirectory. Returns relative paths.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Subdirectory to list (relative). Omit for repo root.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read a file from the repository. Returns up to 400 lines.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          start_line: { type: 'number', description: '1-indexed start line (default 1)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_code',
      description: 'Search all repository files for a string or simple pattern. Returns matching lines with file:line.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for (case-insensitive substring)' },
        },
        required: ['query'],
      },
    },
  },
];

function safeJoin(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root))) return null; // path traversal guard
  return full;
}

export function executeTool(repoRoot: string, name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'list_files': {
        const dir = typeof args.dir === 'string' && args.dir ? args.dir : '.';
        const full = safeJoin(repoRoot, dir);
        if (!full || !fs.existsSync(full)) return `Directory not found: ${dir}`;
        const files = walkFiles(full)
          .map((f) => path.relative(repoRoot, f).replace(/\\/g, '/'))
          .slice(0, 300);
        return files.join('\n') || '(no indexable files)';
      }
      case 'read_file': {
        const rel = String(args.path ?? '');
        const full = safeJoin(repoRoot, rel);
        if (!full || !fs.existsSync(full)) return `File not found: ${rel}`;
        const start = Math.max(1, Number(args.start_line) || 1);
        const lines = fs.readFileSync(full, 'utf-8').split('\n');
        const slice = lines.slice(start - 1, start - 1 + 400);
        return slice.map((l, i) => `${start + i}: ${l}`).join('\n');
      }
      case 'search_code': {
        const q = String(args.query ?? '').toLowerCase();
        if (!q) return 'Empty query';
        const hits: string[] = [];
        for (const f of walkFiles(repoRoot)) {
          const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
          let content: string;
          try { content = fs.readFileSync(f, 'utf-8'); } catch { continue; }
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
              if (hits.length >= 60) return hits.join('\n');
            }
          }
        }
        return hits.join('\n') || `No matches for "${q}"`;
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
