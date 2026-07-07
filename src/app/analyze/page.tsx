'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { marked } from 'marked';
import {
  Building2, Terminal, ShieldCheck, Package, Map as MapIcon, Compass,
  MessagesSquare, Brain, MessageCircle,
} from 'lucide-react';

interface PaneState {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'done' | 'error';
  text: string;
  tools: string[];
}

interface Usage { calls: number; prompt_tokens: number; completion_tokens: number; est_cost_usd: number }

const AGENT_TITLES: Record<string, string> = {
  architecture: 'The Architect',
  quickstart: 'The DevOps Engineer',
  config: 'The Security Engineer',
  dependencies: 'The Dependency Engineer',
  diagram: 'The Systems Cartographer',
  tour: 'The Mentor',
};

const AGENT_ICONS: Record<string, React.ElementType> = {
  architecture: Building2,
  quickstart: Terminal,
  config: ShieldCheck,
  dependencies: Package,
  diagram: MapIcon,
  tour: Compass,
};

marked.setOptions({ gfm: true, breaks: true });

// Full markdown (headers, lists, tables, bold/italic, code) for pane rendering.
function mdToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

function extractMermaid(md: string): string | null {
  const fenced = md.match(/```mermaid\n([\s\S]*?)```/);
  if (fenced) return fenced[1];
  // Model sometimes omits the fence — fall back to the bare diagram block.
  const bare = md.match(/((?:graph|flowchart|sequenceDiagram|classDiagram)\s[\s\S]*?)(?:\n\n(?:[A-Z#-]|$)|$)/);
  return bare ? bare[1] : null;
}

// Once the diagram is rendered as SVG, drop the raw source from the text below it.
function stripMermaidSource(md: string): string {
  return md
    .replace(/```mermaid\n[\s\S]*?```/, '')
    .replace(/(?:graph|flowchart|sequenceDiagram|classDiagram)\s[\s\S]*?(?=\n\n(?:[A-Z#-]|$)|$)/, '');
}

let mermaidMod: { render: (id: string, src: string) => Promise<{ svg: string }> } | null = null;
async function renderMermaid(src: string): Promise<string | null> {
  try {
    if (!mermaidMod) {
      const m = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs' as string);
      m.default.initialize({ startOnLoad: false, theme: 'neutral' });
      mermaidMod = m.default;
    }
    const { svg } = await mermaidMod!.render(`mmd_${Date.now()}`, src);
    return svg;
  } catch { return null; }
}

function Pane({ pane }: { pane: PaneState }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el && pane.status === 'running') el.scrollTop = el.scrollHeight;
  }, [pane.text, pane.tools.length, pane.status]);

  useEffect(() => {
    if (pane.id === 'diagram' && pane.status === 'done') {
      const src = extractMermaid(pane.text);
      if (src) renderMermaid(src).then(setSvg);
    }
  }, [pane.status, pane.id, pane.text]);

  const Icon = AGENT_ICONS[pane.id];

  return (
    <div className="pane">
      <div className="hd">
        <span className="hdtitle">{Icon && <Icon size={14} className="text-primary" />}{pane.title}</span>
        <span className={`status ${pane.status}`}>
          {pane.status === 'running' ? '● streaming' : pane.status === 'done' ? '✓ done' : pane.status === 'error' ? '✗ error' : 'idle'}
        </span>
      </div>
      <div className="body" ref={bodyRef}>
        {pane.tools.length > 0 && pane.status === 'running' && (
          <div className="toolline">{pane.tools.slice(-3).map((t, i) => <div key={i}>⚙ {t}</div>)}</div>
        )}
        {svg ? <div className="mermaidbox" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
        <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(svg ? stripMermaidSource(pane.text) : pane.text) }} />
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [phaseKind, setPhaseKind] = useState<'ok' | 'er' | ''>('');
  const [panes, setPanes] = useState<Record<string, PaneState>>({});
  const [memory, setMemory] = useState<PaneState | null>(null);
  const [debate, setDebate] = useState<PaneState | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  // Live cost meter
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/usage');
        if (r.ok) setUsage(await r.json());
      } catch { /* server not up yet */ }
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const updatePane = useCallback((id: string, fn: (p: PaneState) => PaneState) => {
    if (id === 'memory') {
      setMemory((prev) => fn(prev ?? { id: 'memory', title: 'Memory', status: 'running', text: '', tools: [] }));
    } else if (id === 'debate') {
      setDebate((prev) => fn(prev ?? { id: 'debate', title: 'Debate', status: 'running', text: '', tools: [] }));
    } else {
      setPanes((prev) => ({
        ...prev,
        [id]: fn(prev[id] ?? { id, title: AGENT_TITLES[id] ?? id, status: 'idle', text: '', tools: [] }),
      }));
    }
  }, []);

  const analyze = useCallback(async () => {
    if (!url.trim() || running) return;
    setRunning(true);
    setPanes({});
    setMemory(null);
    setDebate(null);
    setPhase('Starting…');
    setPhaseKind('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evLine = raw.split('\n').find((l) => l.startsWith('event: '));
          const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(7).trim();
          let data: Record<string, unknown>;
          try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (event === 'phase') {
            const p = data as { phase: string; detail: string; repoId?: number; sha?: string; agents?: { id: string; title: string }[] };
            setPhase(p.detail ?? p.phase);
            setPhaseKind(p.phase === 'error' ? 'er' : p.phase === 'done' ? 'ok' : '');
            if (p.repoId) setRepoId(p.repoId);
            if (p.sha) setSha(p.sha);
            if (p.agents) {
              const init: Record<string, PaneState> = {};
              for (const a of p.agents) init[a.id] = { id: a.id, title: AGENT_TITLES[a.id] ?? a.title, status: 'running', text: '', tools: [] };
              setPanes(init);
            }
          } else if (event === 'agent') {
            const e = data as { agent: string; type: string; data: string };
            if (e.type === 'token') updatePane(e.agent, (p) => ({ ...p, status: 'running', text: p.text + e.data }));
            else if (e.type === 'tool') updatePane(e.agent, (p) => ({ ...p, status: 'running', text: '', tools: [...p.tools, e.data] }));
            else if (e.type === 'done') updatePane(e.agent, (p) => ({ ...p, status: 'done', text: e.data }));
            else if (e.type === 'error') updatePane(e.agent, (p) => ({ ...p, status: 'error', text: p.text + `\n[${e.data}]` }));
            else if (e.type === 'status') updatePane(e.agent, (p) => ({ ...p, status: 'running', text: e.data + '\n' }));
          }
        }
      }
    } catch (e) {
      setPhase(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setPhaseKind('er');
    } finally {
      setRunning(false);
    }
  }, [url, running, updatePane]);

  const sendChat = useCallback(async () => {
    const q = chatInput.trim();
    if (!q || chatBusy || !repoId || !sha) return;
    setChatInput('');
    setChat((c) => [...c, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setChatBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, sha, message: q }),
      });
      if (!res.body) throw new Error('no stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const tok = decoder.decode(value, { stream: true });
        setChat((c) => {
          const copy = [...c];
          copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + tok };
          return copy;
        });
      }
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', content: `[error: ${e instanceof Error ? e.message : e}]` }]);
    } finally {
      setChatBusy(false);
    }
  }, [chatInput, chatBusy, repoId, sha]);

  const paneList = Object.values(panes);

  return (
    <div className="relative min-h-screen bg-black">
      <div className="container pt-8">
        <header className="top flex flex-wrap items-end justify-between gap-3 pb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight">
              <Link href="/" style={{ color: '#E1E0CC' }}>
                Docent<span className="text-primary">.</span>
              </Link>
            </h1>
            <span className="italic font-serif-italic text-primary/70 text-sm sm:text-base">point it at a repo and watch the team work</span>
          </div>
          <div className="meter" title="Estimated from per-call usage returned by the BTL runtime">
            <div className="grp"><span className="big">${(usage?.est_cost_usd ?? 0).toFixed(4)}</span><span className="lbl">est. cost</span></div>
            <div className="grp"><span>{((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)).toLocaleString()}</span><span className="lbl">tokens</span></div>
            <div className="grp"><span>{usage?.calls ?? 0}</span><span className="lbl">runtime calls</span></div>
          </div>
        </header>

        <div className="inputrow">
        <input
          placeholder="https://github.com/owner/repo, paste any repository"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          disabled={running}
        />
        <button onClick={analyze} disabled={running || !url.trim()}>
          {running ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      <div className="phase"><span className={phaseKind}>{phase}</span></div>

      {debate && (
        <div className="debatepane">
          <h3><MessagesSquare size={14} /> Team Debate &amp; Consensus</h3>
          <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(debate.text) }} />
        </div>
      )}

      {memory && (
        <div className="memorypane">
          <h3><Brain size={14} /> The Historian, what changed since my last visit</h3>
          <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(memory.text) }} />
        </div>
      )}

      {paneList.length > 0 && (
        <div className="grid">
          {paneList.map((p) => <Pane key={p.id} pane={p} />)}
        </div>
      )}

      {repoId && sha && (
        <div className="chat">
          <div className="hd"><MessageCircle size={14} className="inline -mt-0.5 mr-1.5" />Ask the team <span>retrieval + persistent memory · remembers across sessions</span></div>
          <div className="msgs" ref={msgsRef}>
            {chat.map((m, i) => (
              <div key={i} className={`msg md ${m.role}`} dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
            ))}
          </div>
          <div className="inrow">
            <input
              placeholder="Where does auth happen? How do I add an endpoint?"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              disabled={chatBusy}
            />
            <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()}>Send</button>
          </div>
        </div>
      )}

        <footer>every call above went through api.badtheorylabs.com · chat completions + embeddings + tool use + streaming</footer>
      </div>
    </div>
  );
}
