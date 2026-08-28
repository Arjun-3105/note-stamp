'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Source } from '@/lib/db/sources';
import { Workspace } from '@/lib/db/workspaces';
import { SourceViewer } from '@/components/learn/SourceViewer';
import { AssistantPanel, MODE_META } from '@/components/assistant/AssistantPanel';
import type { AssistantMode, FocusTopic, RoadmapNodeInfo } from '@/components/assistant/AssistantPanel';
import { TopicRoadmap } from '@/components/learn/TopicRoadmap';
import type { RoadmapNode, RoadmapEdge } from '@/components/learn/TopicRoadmap';
import { LearningMapView } from '@/components/learn/LearningMapView';
import { ParsedCitation } from '@/lib/citations';
import { FlashcardsView } from '@/components/learn/FlashcardsView';
import { QuizView } from '@/components/learn/QuizView';
import { PracticeView } from '@/components/learn/PracticeView';

const BlockNoteEditor = dynamic(
  () => import('@/components/editor/BlockNoteEditor').then(m => m.BlockNoteEditor),
  { ssr: false, loading: () => null }
);

const CodeSandbox = dynamic(
  () => import('@/components/sandbox/CodeSandbox').then(m => m.CodeSandbox),
  { ssr: false, loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 13 }}>
      Loading Python Sandbox…
    </div>
  )}
);

const MathWhiteboard = dynamic(
  () => import('@/components/math/MathWhiteboard').then(m => m.MathWhiteboard),
  { ssr: false, loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 13 }}>
      Loading Math Whiteboard…
    </div>
  )}
);

const SOURCE_META: Record<string, { icon: string; label: string; color: string }> = {
  youtube: { icon: '▶', label: 'YouTube',  color: '#ef4444' },
  pdf:     { icon: '⬜', label: 'PDF',      color: '#3b82f6' },
  url:     { icon: '⬡', label: 'Article',  color: '#10b981' },
  text:    { icon: '✎', label: 'Text',      color: '#7C5CFF' },
  github:  { icon: '⊞', label: 'GitHub',   color: '#10b981' },
};

const TABS = ['Learn', 'Notes', 'Flashcards', 'Quiz', 'Practice', 'Sandbox', 'Math'];

export default function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string; sourceId: string }>;
}) {
  const { id, sourceId } = use(params);
  const { userId } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [activeTab, setActiveTab] = useState('Learn');

  // AI panel
  const [aiOpen, setAiOpen] = useState(true);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [aiMode, setAiMode] = useState<AssistantMode>('teacher');
  const [selectedTopic, setSelectedTopic] = useState<FocusTopic | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<any>(null);
  const sourcePanelRef = useRef<any>(null);
  const sourceViewerRef = useRef<any>(null);

  const handleCitationClick = useCallback((citation: ParsedCitation) => {
    if (!sourceViewerRef.current) return;
    if (citation.pageStart) {
      sourceViewerRef.current.goToPage(citation.pageStart);
    } else if (citation.chunkIndex !== undefined) {
      sourceViewerRef.current.goToChunk(citation.chunkIndex);
    }
  }, []);

  // Roadmap
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([]);
  const [roadmapEdges, setRoadmapEdges] = useState<RoadmapEdge[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [isDetailedRoadmap, setIsDetailedRoadmap] = useState(false);

  // Close mode menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load source + workspace + notes
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const [wsRes, srcRes, noteRes] = await Promise.all([
          fetch(`/api/workspaces/${id}`),
          fetch(`/api/sources/${sourceId}`),
          fetch(`/api/notes?sourceId=${sourceId}`),
        ]);
        if (!wsRes.ok || !srcRes.ok) throw new Error('Failed to load');
        setWorkspace(await wsRes.json());
        const src = await srcRes.json();
        setSource(src);
        if (noteRes.ok) {
          const d = await noteRes.json();
          setNoteContent(d.note?.content || '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, id, sourceId]);

  // Auto-generate roadmap from transcript
  useEffect(() => {
    if (!source) return;
    let meta: any = {};
    try { meta = JSON.parse(source.metadata as unknown as string || '{}'); } catch {}
    
    if (meta.roadmap) {
      setRoadmapNodes(meta.roadmap.nodes || []);
      setRoadmapEdges(meta.roadmap.edges || []);
      setRoadmapOpen(true);
      if (meta.roadmap.isDetailed) {
        setIsDetailedRoadmap(true);
      }
      return;
    }

    // Trigger roadmap generation using sourceId instead of full transcript
    setRoadmapLoading(true);
    fetch('/api/concept-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.nodes?.length) {
          setRoadmapNodes(data.nodes);
          setRoadmapEdges(data.edges || []);
          setRoadmapOpen(true);
        }
      })
      .catch(() => {})
      .finally(() => setRoadmapLoading(false));
  }, [source, sourceId]);

  const generateDetailedRoadmap = useCallback(() => {
    if (!source) return;
    let meta: any = {};
    try { meta = JSON.parse(source.metadata as unknown as string || '{}'); } catch {}
    // Trigger detailed roadmap using sourceId
    setRoadmapLoading(true);
    fetch('/api/concept-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, detailed: true }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.nodes?.length) {
          setRoadmapNodes(data.nodes);
          setRoadmapEdges(data.edges || []);
          setIsDetailedRoadmap(true);
        }
      })
      .catch(() => {})
      .finally(() => setRoadmapLoading(false));
  }, [source, sourceId]);

  const handleSaveNotes = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, content }),
      });
      setNoteContent(content);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch { setSaveStatus(null); }
  }, [sourceId]);

  const handleSelectTopic = useCallback((node: RoadmapNode) => {
    if (!node.id) { setSelectedTopic(null); return; }
    setSelectedTopic({ id: node.id, label: node.label, description: node.description });
    setAiMode('teacher');
    setAiOpen(true);
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#0F1115]">
      <div className="flex items-center gap-3 text-[#A2A8B5] text-sm font-medium">
        <span className="w-4 h-4 rounded-full border-2 border-[#252B36] border-t-[#7C5CFF] animate-spin" />
        Loading workspace…
      </div>
    </div>
  );

  if (error || !workspace || !source) return (
    <div className="flex flex-col h-screen items-center justify-center bg-[#0F1115] gap-3">
      <p className="text-[#FF6A6A] text-sm font-semibold">{error || 'Source not found'}</p>
      <Link href={`/workspace/${id}`} className="text-[#7C5CFF] text-sm font-bold hover:underline">← Back to Workspace</Link>
    </div>
  );

  const meta = SOURCE_META[source.sourceType] || SOURCE_META.text;
  const title = source.title;
  let parsedMeta: any = {};
  try { parsedMeta = JSON.parse(source.metadata as unknown as string || '{}'); } catch {}

  const currentModeMeta = MODE_META[aiMode];

  // Cast roadmapNodes for the assistant panel
  const assistantRoadmapNodes: RoadmapNodeInfo[] = roadmapNodes.map(n => ({
    id: n.id,
    label: n.label,
    description: n.description,
    difficulty: n.difficulty,
  }));

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-[#0F1115] text-[#F5F6F8]"
      style={{ fontFamily: "Geist, 'Inter', sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="h-14 shrink-0 border-b border-[#252B36] flex items-center justify-between px-4 bg-[#0F1115] relative z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${id}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1e1e28] hover:bg-[#2a2a35] transition-colors"
          >
            <span className="text-[#A2A8B5] group-hover:text-white transition-colors">←</span>
          </Link>
          <button
            onClick={() => setSourceOpen(prev => !prev)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#252B36] transition-colors text-[#A2A8B5] hover:text-[#F5F6F8]"
            title={sourceOpen ? 'Hide source panel' : 'Show source panel'}
          >
            {sourceOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="3" y2="21"/>
              </svg>
            )}
          </button>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#A2A8B5]">
            <Link href={`/workspace/${id}`} className="hover:text-[#F5F6F8] transition-colors">{workspace.title}</Link>
            <span className="text-gray-600 shrink-0">›</span>
            <span className="text-[#F5F6F8] font-bold truncate">{title}</span>
          </div>
        </div>

        {/* Center: mode badge (clickable → mode menu) */}
        <div className="flex items-center gap-3" ref={modeMenuRef}>
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-bold border transition-all hover:opacity-90"
              style={{
                background: `${currentModeMeta.color}15`,
                color: currentModeMeta.color,
                borderColor: `${currentModeMeta.color}35`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: currentModeMeta.color }} />
              {currentModeMeta.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Mode dropdown */}
            {showModeMenu && (
              <div
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-52 rounded-2xl overflow-hidden shadow-2xl z-50"
                style={{ background: '#18181f', border: '1px solid #2a2a38' }}
              >
                {(Object.entries(MODE_META) as [AssistantMode, typeof currentModeMeta][])
                  .filter(([k]) => k !== 'quiz_hint')
                  .map(([key, m]) => (
                    <button
                      key={key}
                      onClick={() => { setAiMode(key); setAiOpen(true); setShowModeMenu(false); }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[#1e1e28]"
                      style={{ borderBottom: '1px solid #1e1e28' }}
                    >
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${m.color}1a` }}>
                        {m.icon}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: aiMode === key ? m.color : '#e8e8ea' }}>
                          {m.label}
                        </div>
                      </div>
                      {aiMode === key && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: save status & toggle AI */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A2A8B5]">
            {saveStatus === 'saving' && <span>Saving…</span>}
            {saveStatus === 'saved' && <span className="text-[#42C67A] font-bold">✓ Saved</span>}
          </div>
          <button
            onClick={() => {
              if (aiOpen) {
                aiPanelRef.current?.collapse();
              } else {
                setAiOpen(true);
                setTimeout(() => aiPanelRef.current?.expand(), 0);
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#252B36] transition-colors text-[#A2A8B5] hover:text-[#F5F6F8]"
            title={aiOpen ? 'Hide AI panel' : 'Show AI panel'}
          >
            {aiOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Body: roadmap mode gets its own 2-column layout ── */}
      {aiMode === 'roadmap_guide' ? (
        <PanelGroup direction="horizontal" className="flex flex-1 overflow-hidden bg-[#0F1115]">
          {/* Left: source */}
          {sourceOpen && (
            <>
              <Panel defaultSize={38} minSize={20} className="flex flex-col bg-black">
                <SourceViewer ref={sourceViewerRef} sourceId={source.$id} sourceType={source.sourceType} url={source.url} title={source.title} />
              </Panel>
              <PanelResizeHandle className="w-1 bg-[#252B36] hover:bg-[#7C5CFF] transition-colors cursor-col-resize" />
            </>
          )}
          {/* Right: full learning map */}
          <Panel className="flex flex-col bg-[#0F1115]">
            <LearningMapView
              nodes={roadmapNodes}
              edges={roadmapEdges}
              sourceId={source.$id}
              sourceTitle={title}
              loading={roadmapLoading}
              isDetailed={isDetailedRoadmap}
              onGenerateDetailed={generateDetailedRoadmap}
            />
          </Panel>
        </PanelGroup>
      ) : (

      /* ── 3-column body (all other modes) ── */
      <PanelGroup direction="horizontal" className="flex flex-1 overflow-hidden bg-[#0F1115]">

        {/* Column 1: Source Viewer */}
        {sourceOpen && (
          <>
            <Panel ref={sourcePanelRef} collapsible defaultSize={38} minSize={20} className="flex flex-col bg-black">
              <SourceViewer ref={sourceViewerRef} sourceId={source.$id} sourceType={source.sourceType} url={source.url} title={source.title} />
            </Panel>
            <PanelResizeHandle className="w-1 bg-[#252B36] hover:bg-[#7C5CFF] transition-colors cursor-col-resize" />
          </>
        )}

        {/* Column 2: Center workspace */}
        <Panel className="flex flex-col relative bg-[#0F1115]">

          {/* Title + tabs */}
          <div className="px-7 pt-5 pb-0 shrink-0">
            <h1 className="text-[20px] font-bold mb-4 leading-snug text-[#F5F6F8] truncate">{title}</h1>
            <div className="flex items-center gap-0.5 border-b border-[#252B36]">
              {TABS.map(tab => {
                const label = tab === 'Sandbox' ? '⚙ Sandbox' : tab === 'Math' ? '∑ Math' : tab;
                const accent = tab === 'Sandbox' ? '#10b981' : tab === 'Math' ? '#f59e0b' : '#7C5CFF';
                return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-3 py-2 text-[13px] font-semibold transition-all relative"
                  style={{
                    color: activeTab === tab ? '#F5F6F8' : '#A2A8B5',
                  }}
                >
                  {label}
                  {activeTab === tab && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                      style={{ background: accent }}
                    />
                  )}
                </button>
              )})}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-7 py-5">

            {/* ── LEARN TAB ── */}
            {activeTab === 'Learn' && (
              <div className="space-y-5 max-w-3xl">

                {/* Roadmap / concept map */}
                {(roadmapLoading || roadmapNodes.length > 0) && (
                  <div className="bg-[#151922] rounded-[20px] border border-[#252B36] overflow-hidden">
                    {roadmapLoading ? (
                      <div className="flex items-center gap-2 px-5 py-4 text-[12px] text-[#A2A8B5]">
                        <span className="w-3 h-3 rounded-full border-2 border-[#252B36] border-t-[#7C5CFF] animate-spin" />
                        Mapping concepts from {source.sourceType}…
                      </div>
                    ) : (
                      <TopicRoadmap
                        nodes={roadmapNodes}
                        edges={roadmapEdges}
                        selectedNodeId={selectedTopic?.id || null}
                        onSelectNode={handleSelectTopic}
                        isOpen={roadmapOpen}
                        onToggle={() => setRoadmapOpen(o => !o)}
                      />
                    )}
                  </div>
                )}

                {/* Overview card */}
                <div className="bg-[#151922] rounded-[20px] p-6 border border-[#252B36] space-y-4">
                  <h2 className="text-base font-bold flex items-center gap-2" style={{ color: '#7C5CFF' }}>
                    Let's understand this ⚡
                  </h2>

                  {parsedMeta?.description ? (
                    <p className="text-[14px] leading-relaxed text-[#A2A8B5]">
                      {parsedMeta.description}
                    </p>
                  ) : (
                    <p className="text-[14px] leading-relaxed text-[#A2A8B5]">
                      Use the <strong className="text-white">AI Teacher</strong> on the right to get a live, interactive explanation of <strong className="text-white">{title}</strong>. Ask questions, request analogies, or get step-by-step breakdowns.
                    </p>
                  )}

                  {/* Source badge */}
                  <div className="flex items-center gap-2 bg-[#0F1115] px-3 py-2 rounded-[10px] border border-[#252B36] w-fit">
                    <span className="text-[11px] font-bold text-[#A2A8B5] uppercase tracking-widest">Source</span>
                    <span className="text-[12px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer"
                        className="text-[12px] text-[#7C5CFF] hover:underline truncate max-w-[220px] ml-1">
                        {source.url}
                      </a>
                    )}
                  </div>
                </div>

                {/* Break it down — 3 view modes */}
                <BreakItDown sourceTitle={title} sourceMeta={parsedMeta} sourceType={source.sourceType} />

                {/* Key Topics (from roadmap) */}
                {roadmapNodes.length > 0 && (
                  <div className="bg-[#151922] rounded-[20px] p-5 border border-[#252B36]">
                    <h3 className="text-[13px] font-bold mb-4 text-[#F5F6F8]">Key Topics</h3>
                    <div className="space-y-2">
                      {roadmapNodes.slice(0, 6).map((node, i) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 bg-[#0F1115] rounded-[10px] border border-[#252B36] cursor-pointer hover:border-[#7C5CFF]/40 transition-colors group"
                          onClick={() => handleSelectTopic(node)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded-full border border-[#252B36] flex items-center justify-center shrink-0"
                              style={{ borderColor: i === 0 ? '#7C5CFF40' : undefined }}>
                              {i === 0 && <div className="w-2 h-2 rounded-full bg-[#7C5CFF]" />}
                            </div>
                            <span className="text-[13px] font-semibold text-[#F5F6F8]">{node.label}</span>
                          </div>
                          <span className="text-[#A2A8B5] group-hover:text-[#7C5CFF] transition-colors">→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related concepts (static from roadmap edges) */}
                {roadmapNodes.length > 0 && (
                  <div className="bg-[#151922] rounded-[20px] p-5 border border-[#252B36]">
                    <h3 className="text-[13px] font-bold mb-3 text-[#F5F6F8]">Related Concepts</h3>
                    <div className="space-y-2">
                      {roadmapNodes.slice(0, 3).map((node, i) => {
                        const statuses = ['Review', 'Next', 'Soon'];
                        const statusColors = ['#42C67A', '#7C5CFF', '#A2A8B5'];
                        return (
                          <div key={node.id} className="flex items-center justify-between p-2.5 rounded-[10px] border border-[#252B36]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: statusColors[i] }} />
                              <span className="text-[13px] text-[#F5F6F8]">{node.label}</span>
                            </div>
                            <span className="text-[11px] font-bold" style={{ color: statusColors[i] }}>
                              {statuses[i]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Key Takeaway (from meta) */}
                {parsedMeta?.summary && (
                  <div className="rounded-[20px] p-5 border"
                    style={{ background: 'rgba(124,92,255,0.04)', borderColor: 'rgba(124,92,255,0.2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-yellow-400">☆</span>
                      <h3 className="text-[13px] font-bold text-[#F5F6F8]">Key Takeaway</h3>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: '#c4b5fd' }}>
                      {typeof parsedMeta.summary === 'string' ? parsedMeta.summary : parsedMeta.summary?.summary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES TAB ── */}
            {activeTab === 'Notes' && (
              <div className="max-w-4xl">
                <div className="bg-[#151922] rounded-[20px] border border-[#252B36] p-8 min-h-[500px]">
                  <BlockNoteEditor
                    initialContent={noteContent}
                    sourceId={source.$id}
                    onSave={handleSaveNotes as any}
                    placeholder="Start writing or type '/' to see commands…"
                  />
                </div>
              </div>
            )}

            {/* ── SANDBOX TAB ── */}
            {activeTab === 'Sandbox' && (
              <div style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
                <CodeSandbox sourceId={source.$id} />
              </div>
            )}

            {/* ── MATH TAB ── */}
            {activeTab === 'Math' && (
              <div style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
                <MathWhiteboard sourceId={source.$id} workspaceId={id} />
              </div>
            )}

            {/* ── FLASHCARDS / QUIZ / PRACTICE ── */}
            {activeTab === 'Flashcards' && <FlashcardsView sourceId={source.$id} />}
            {activeTab === 'Quiz' && <QuizView sourceId={source.$id} workspaceId={id} />}
            {activeTab === 'Practice' && <PracticeView sourceId={source.$id} />}

            {!['Learn', 'Notes', 'Sandbox', 'Math', 'Flashcards', 'Quiz', 'Practice'].includes(activeTab) && (
              <div className="bg-[#151922] rounded-[20px] p-12 text-center border border-[#252B36] max-w-md mx-auto mt-4 space-y-3">
                <div className="text-3xl">✦</div>
                <h3 className="text-base font-bold text-[#F5F6F8]">{activeTab}</h3>
                <p className="text-xs text-[#A2A8B5] leading-relaxed">
                  Generates as you interact with the source and AI Teacher.
                </p>
              </div>
            )}
          </div>

          {/* Learning Journey bar */}
          <div className="shrink-0 border-t border-[#252B36] px-7 py-3 flex items-center gap-4 bg-[#151922] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <span className="text-[10px] font-extrabold text-[#A2A8B5] uppercase tracking-widest shrink-0">Journey</span>
            <div className="flex items-center gap-2 shrink-0 bg-[#0F1115] border border-[#252B36] rounded-[10px] px-3 py-1.5">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-[#42C67A]/10 text-[#42C67A]">✓</div>
              <span className="text-[12px] text-white font-bold">{meta.label} Ingested</span>
            </div>
            <div className="w-4 border-t border-dashed border-[#252B36] shrink-0" />
            <div className="flex items-center gap-2 shrink-0 bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 rounded-[10px] px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-[#7C5CFF] animate-pulse" />
              <span className="text-[12px] text-white font-bold">Now Learning</span>
            </div>
            {roadmapNodes.length > 0 && (
              <>
                <div className="w-4 border-t border-dashed border-[#252B36] shrink-0" />
                <div className="flex items-center gap-2 shrink-0 border border-[#252B36] rounded-[10px] px-3 py-1.5 text-[#A2A8B5]">
                  <span className="text-[12px] font-semibold">{roadmapNodes.length} Concepts</span>
                </div>
              </>
            )}
          </div>
        </Panel>

        {/* ── Column 3: AI Panel ── */}
        {aiOpen && (
          <>
            <PanelResizeHandle className="w-1 bg-[#252B36] hover:bg-[#7C5CFF] transition-colors cursor-col-resize" />
            <Panel ref={aiPanelRef} collapsible defaultSize={25} minSize={15} className="flex flex-col bg-[#0F1115]">
              <AssistantPanel
                sourceId={source.$id}
                mode={aiMode}
                onModeChange={setAiMode}
                focusTopic={selectedTopic}
                noteContent={noteContent}
                sourceTitle={title}
                roadmapNodes={assistantRoadmapNodes}
                onSelectNode={(node) => {
                  setSelectedTopic({ id: node.id, label: node.label, description: node.description });
                  setAiMode('teacher');
                }}
                onCitationClick={handleCitationClick}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
      )} {/* end roadmap ternary */}
    </div>
  );
}

/* ─── Break it Down component ─────────────────────────────────── */
function BreakItDown({
  sourceTitle,
  sourceMeta,
  sourceType,
}: {
  sourceTitle: string;
  sourceMeta: any;
  sourceType: string;
}) {
  const [view, setView] = useState<'visual' | 'formula' | 'code'>('visual');
  const views = ['Visual', 'Formula', 'Code'] as const;

  const hasFormula = sourceMeta?.formula || sourceMeta?.equations;
  const hasCode = sourceMeta?.code || sourceType === 'github';

  return (
    <div className="bg-[#151922] rounded-[20px] border border-[#252B36] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-[13px] font-bold text-[#F5F6F8]">Break it down</h3>
        <div className="flex items-center gap-0.5 p-0.5 rounded-[10px] bg-[#0F1115]">
          {views.map(v => (
            <button
              key={v}
              onClick={() => setView(v.toLowerCase() as typeof view)}
              className="px-3 py-1 rounded-[8px] text-[12px] font-semibold transition-all"
              style={{
                background: view === v.toLowerCase() ? '#252B36' : 'transparent',
                color: view === v.toLowerCase() ? '#F5F6F8' : '#A2A8B5',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        {view === 'visual' && (
          <div className="space-y-3">
            {/* Visual breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Input', desc: 'Source material', color: '#3b82f6', icon: '→' },
                { label: 'Process', desc: 'AI analysis & synthesis', color: '#7C5CFF', icon: '⚙' },
                { label: 'Output', desc: 'Your understanding', color: '#10b981', icon: '✓' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-[14px] border text-center"
                  style={{ background: `${item.color}08`, borderColor: `${item.color}25` }}>
                  <div className="text-2xl mb-1" style={{ color: item.color }}>{item.icon}</div>
                  <p className="text-[12px] font-bold text-white">{item.label}</p>
                  <p className="text-[11px] text-[#A2A8B5] mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-[#A2A8B5] leading-relaxed px-1">
              {sourceMeta?.description || `"${sourceTitle}" transforms how you think about this concept — from passive reading to active understanding.`}
            </p>
          </div>
        )}

        {view === 'formula' && (
          <div className="space-y-3">
            {hasFormula ? (
              <div className="p-4 rounded-[14px] font-mono text-[13px] text-[#F5F6F8]"
                style={{ background: '#0F1115', border: '1px solid #252B36' }}>
                {sourceMeta.formula || sourceMeta.equations}
              </div>
            ) : (
              <div className="p-4 rounded-[14px] text-center"
                style={{ background: '#0F1115', border: '1px solid #252B36' }}>
                <p className="text-[12px] text-[#A2A8B5]">
                  Ask the AI Teacher to explain the key formulas from this source.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {(sourceMeta?.keyPoints || []).slice(0, 3).map((point: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#7C5CFF] font-bold shrink-0 mt-0.5">•</span>
                  <p className="text-[13px] text-[#A2A8B5] leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'code' && (
          <div>
            {hasCode ? (
              <pre className="p-4 rounded-[14px] text-[12px] text-[#A2A8B5] overflow-x-auto"
                style={{ background: '#0F1115', border: '1px solid #252B36', fontFamily: 'monospace' }}>
                {sourceMeta.code || '// Code examples from this source'}
              </pre>
            ) : (
              <div className="p-4 rounded-[14px] text-center"
                style={{ background: '#0F1115', border: '1px solid #252B36' }}>
                <p className="text-[12px] text-[#A2A8B5]">
                  Ask the AI Teacher for code examples related to this concept.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Think about it */}
      {sourceMeta?.insight && (
        <div className="mx-5 mb-5 p-4 rounded-[14px]"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#60a5fa] mb-1.5">Think about it</p>
          <p className="text-[13px] text-[#A2A8B5] leading-relaxed">{sourceMeta.insight}</p>
        </div>
      )}
    </div>
  );
}
