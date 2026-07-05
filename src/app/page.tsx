'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PaneState {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'done' | 'error';
  text: string;
  tools: string[];
}

interface Usage { calls: number; prompt_tokens: number; completion_tokens: number; est_cost_usd: number }

const AGENT_TITLES: Record<string, string> = {
  architecture: '🏛 Architecture',
  quickstart: '🚀 Quickstart',
  config: '🔧 Config & Env Audit',
  dependencies: '📦 Dependencies',
  diagram: '🗺 System Diagram',
  tour: '🧭 Guided Tour',
};

// Minimal markdown → HTML (headers, bold, inline/blocks of code) for pane rendering.
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = esc(md);
  out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => `<pre><code>${code}</code></pre>`);
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  out = out.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return out;
}

function extractMermaid(md: string): string | null {
  const m = md.match(/```mermaid\n([\s\S]*?)```/);
  return m ? m[1] : null;
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

  return (
    <div className="pane">
      <div className="hd">
        <span>{pane.title}</span>
        <span className={`status ${pane.status}`}>
          {pane.status === 'running' ? '● streaming' : pane.status === 'done' ? '✓ done' : pane.status === 'error' ? '✗ error' : 'idle'}
        </span>
      </div>
      <div className="body" ref={bodyRef}>
        {pane.tools.length > 0 && pane.status === 'running' && (
          <div className="toolline">{pane.tools.slice(-3).map((t, i) => <div key={i}>⚙ {t}</div>)}</div>
        )}
        {svg ? <div className="mermaidbox" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
        <div dangerouslySetInnerHTML={{ __html: mdToHtml(pane.text) }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('');
  const [phaseKind, setPhaseKind] = useState<'ok' | 'er' | ''>('');
  const [panes, setPanes] = useState<Record<string, PaneState>>({});
  const [memory, setMemory] = useState<PaneState | null>(null);
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
    <div className="container">
      <header className="top">
        <div className="brand">
          <h1>Docent<span className="dot">.</span></h1>
          <span className="tag">a living onboarding portal for any codebase · powered by BTL Runtime</span>
        </div>
        <div className="meter" title="Estimated from per-call usage returned by the BTL runtime">
          <div className="grp"><span className="big">${(usage?.est_cost_usd ?? 0).toFixed(4)}</span><span className="lbl">est. cost</span></div>
          <div className="grp"><span>{((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)).toLocaleString()}</span><span className="lbl">tokens</span></div>
          <div className="grp"><span>{usage?.calls ?? 0}</span><span className="lbl">runtime calls</span></div>
        </div>
      </header>

      <div className="inputrow">
        <input
          placeholder="https://github.com/owner/repo — paste any repository"
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

      {memory && (
        <div className="memorypane">
          <h3>🧠 What changed since my last visit</h3>
          <div dangerouslySetInnerHTML={{ __html: mdToHtml(memory.text) }} />
        </div>
      )}

      {paneList.length > 0 && (
        <div className="grid">
          {paneList.map((p) => <Pane key={p.id} pane={p} />)}
        </div>
      )}

      {repoId && sha && (
        <div className="chat">
          <div className="hd">💬 Ask the codebase <span>retrieval + persistent memory · remembers across sessions</span></div>
          <div className="msgs" ref={msgsRef}>
            {chat.map((m, i) => (
              <div key={i} className={`msg ${m.role}`} dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
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
  );
}
