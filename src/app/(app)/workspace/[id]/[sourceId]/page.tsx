'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Source } from '@/lib/db/sources';
import { Workspace } from '@/lib/db/workspaces';
import { SourceViewer } from '@/components/learn/SourceViewer';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import type { FocusTopic } from '@/components/assistant/AssistantPanel';
import { TopicRoadmap } from '@/components/learn/TopicRoadmap';
import type { RoadmapNode, RoadmapEdge } from '@/components/learn/TopicRoadmap';

const BlockNoteEditor = dynamic(
  () => import('@/components/editor/BlockNoteEditor').then(m => m.BlockNoteEditor),
  { ssr: false, loading: () => null }
);

const SOURCE_META: Record<string, { icon: string; label: string; color: string }> = {
  youtube: { icon: '▶', label: 'YouTube',    color: '#ef4444' },
  pdf:     { icon: '⬜', label: 'PDF',         color: '#3b82f6' },
  url:     { icon: '⬡', label: 'Article',     color: '#10b981' },
  text:    { icon: '✎', label: 'Text',         color: '#7C5CFF' },
  github:  { icon: '⊞', label: 'GitHub',      color: '#10b981' },
};

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

  const aiPanelRef = useRef<any>(null);
  const sourcePanelRef = useRef<any>(null);

  // AI panel overlay
  const [aiOpen, setAiOpen] = useState(true);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<FocusTopic | null>(null);

  // Roadmap
  const [roadmapNodes, setRoadmapNodes] = useState<RoadmapNode[]>([]);
  const [roadmapEdges, setRoadmapEdges] = useState<RoadmapEdge[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [isDetailedRoadmap, setIsDetailedRoadmap] = useState(false);

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
  try {
    parsedMeta = JSON.parse(source.metadata as unknown as string || '{}');
  } catch {}

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0F1115] text-[#F5F6F8]" style={{ fontFamily: "Geist, 'Inter', sans-serif" }}>
      
      {/* ── Topbar ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[#252B36] bg-[#151922]">
        {/* Left: breadcrumb and toggle */}
        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${id}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1e1e28] hover:bg-[#2a2a35] transition-colors"
          >
            <span className="text-[#A2A8B5] group-hover:text-white transition-colors">←</span>
          </Link>
          <button
            onClick={() => sourcePanelRef.current?.toggle()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#252B36] transition-colors text-[#A2A8B5] hover:text-[#F5F6F8]"
            title={sourceOpen ? 'Hide source panel' : 'Show source panel'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#A2A8B5] min-w-0">
            <Link href={`/workspace/${id}`} className="hover:text-[#F5F6F8] transition-colors shrink-0">
              {workspace.title}
            </Link>
            <span className="text-gray-600 shrink-0">›</span>
            <span className="text-[#F5F6F8] font-bold truncate">{title}</span>
          </div>
        </div>

        {/* Center: mode badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-bold text-[#F5F6F8] bg-[#252B36] border border-[#252B36] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#7C5CFF]" />
            Teacher Mode
          </div>
        </div>

        {/* Right: save status & toggle AI */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A2A8B5] mr-2">
            {saveStatus === 'saving' && <span className="text-[#A2A8B5]/80">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-[#42C67A] font-bold">✓ Saved</span>}
          </div>
          <button
            onClick={() => aiPanelRef.current?.toggle()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#252B36] transition-colors text-[#A2A8B5] hover:text-[#F5F6F8]"
            title={aiOpen ? 'Hide AI panel' : 'Show AI panel'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <PanelGroup direction="horizontal" className="flex flex-1 overflow-hidden">
        {/* Left: Source Viewer */}
        <Panel ref={sourcePanelRef} collapsible defaultSize={38} minSize={20} onCollapse={() => setSourceOpen(false)} onExpand={() => setSourceOpen(true)} className="flex flex-col bg-black">
          <SourceViewer sourceType={source.sourceType} url={source.url} title={source.title} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-[#252B36] hover:bg-[#7C5CFF] transition-colors cursor-col-resize" />

        {/* Column 2: Center - Notes, Learn, Roadmap & Canvas */}
        <Panel className="flex flex-col relative bg-[#0F1115]">
          
          {/* Header & Tabs */}
          <div className="px-8 pt-6 pb-2">
            <h1 className="text-[22px] font-bold mb-4 leading-snug max-w-[90%] text-[#F5F6F8]">
              {title}
            </h1>
            
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-[#252B36] pb-3">
              {['Learn', 'Notes', 'Mind Map', 'Flashcards', 'Quiz', 'Practice'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-[14px] text-[13px] font-bold transition-all"
                  style={{
                    background: activeTab === tab ? '#7C5CFF' : 'transparent',
                    color: activeTab === tab ? '#ffffff' : '#A2A8B5',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Central Workspace Content */}
          <div className="flex-1 overflow-y-auto px-8 pb-8">
            
            {/* Dynamic Roadmap Layer (Only rendered when actual concepts are present) */}
            {(roadmapLoading || roadmapNodes.length > 0) && (
              <div className="mb-6 bg-[#151922] rounded-[20px] shadow-sm border border-[#252B36] overflow-hidden relative">
                
                {/* Generate Detailed Roadmap Button */}
                {!isDetailedRoadmap && (
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={generateDetailedRoadmap}
                      disabled={roadmapLoading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #7C5CFF, #4F39F6)' }}
                    >
                      {roadmapLoading ? 'Generating...' : '✨ Generate Detailed Roadmap'}
                    </button>
                  </div>
                )}

                {roadmapLoading ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-[12px] font-medium text-[#A2A8B5] bg-[#151922]">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[#252B36] border-t-[#7C5CFF] animate-spin" />
                    Mapping topics from {source.sourceType}...
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

            {/* Learn Tab: Clean Actual Info (No Dummy Placeholders) */}
            {activeTab === 'Learn' && (
              <div className={`grid grid-cols-1 ${roadmapNodes.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6 max-w-5xl`}>
                {/* Primary Card */}
                <div className={`${roadmapNodes.length > 0 ? 'lg:col-span-2' : 'col-span-1'} space-y-6`}>
                  <div className="bg-[#151922] rounded-[20px] p-6 shadow-sm border border-[#252B36] space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-[#7C5CFF]">
                      Overview ⚡
                    </h2>
                    
                    {parsedMeta?.description ? (
                      <p className="text-[14px] leading-relaxed text-[#A2A8B5]">
                        {parsedMeta.description}
                      </p>
                    ) : (
                      <p className="text-[14px] leading-relaxed text-[#A2A8B5]">
                        Interactive learning mode for <strong className="text-white">{title}</strong>. Take notes in the Notes tab, or focus on key topics with the AI Teacher.
                      </p>
                    )}

                    <div className="flex items-center gap-3 bg-[#0F1115] px-4 py-2.5 rounded-[10px] border border-[#252B36] inline-flex">
                      <span className="text-[11px] font-bold text-[#A2A8B5] uppercase tracking-widest">Source</span>
                      <span className="text-[13px] font-bold text-[#F5F6F8]">{meta.label}</span>
                      {source.url && (
                        <a href={source.url} target="_blank" rel="noreferrer" className="text-[12px] text-[#7C5CFF] hover:underline truncate max-w-[250px] ml-2">
                          {source.url}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setActiveTab('Notes')} className="px-5 py-2.5 rounded-[14px] bg-[#7C5CFF] text-white text-[13px] font-bold hover:bg-[#7C5CFF]/90 transition-colors shadow-sm">
                      Open Notes
                    </button>
                  </div>
                </div>

                {/* Key Topics Column (Only shown when actual roadmap nodes exist) */}
                {roadmapNodes.length > 0 && (
                  <div className="col-span-1 space-y-6">
                    <div className="bg-[#151922] rounded-[20px] p-5 shadow-sm border border-[#252B36]">
                      <h3 className="text-[13px] font-bold mb-4 px-1 text-[#F5F6F8]">Key Topics</h3>
                      <div className="space-y-2.5">
                        {roadmapNodes.slice(0, 6).map((node, i) => (
                          <div
                            key={node.id}
                            className="flex items-center justify-between p-3 bg-[#0F1115] rounded-[10px] border border-[#252B36] shadow-sm cursor-pointer hover:border-[#7C5CFF]/50 transition-colors"
                            onClick={() => handleSelectTopic(node)}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-5 h-5 rounded-full border border-[#7C5CFF]/40 flex items-center justify-center shrink-0">
                                {i === 0 && <div className="w-2 h-2 rounded-full bg-[#7C5CFF]"></div>}
                              </div>
                              <span className="text-[13px] font-bold truncate text-[#F5F6F8]">{node.label}</span>
                            </div>
                            <span className="text-[#A2A8B5]">→</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab: Clean Document Surface */}
            {activeTab === 'Notes' && (
              <div className="max-w-4xl">
                <div className="text-[#F5F6F8] bg-[#151922] rounded-[20px] shadow-sm border border-[#252B36] p-8 min-h-[500px]">
                  <BlockNoteEditor
                    initialContent={noteContent}
                    sourceId={source.$id}
                    onSave={handleSaveNotes as any}
                    placeholder="Start writing or type '/' to see commands…"
                  />
                </div>
              </div>
            )}

            {/* Other tabs fallback */}
            {!['Learn', 'Notes'].includes(activeTab) && (
              <div className="bg-[#151922] rounded-[20px] p-12 text-center border border-[#252B36] shadow-sm space-y-3 max-w-md mx-auto mt-8">
                <div className="text-3xl">✦</div>
                <h3 className="text-base font-bold text-[#F5F6F8]">{activeTab}</h3>
                <p className="text-xs text-[#A2A8B5] leading-relaxed">
                  Generates automatically as you interact with the source materials and AI Teacher.
                </p>
              </div>
            )}
          </div>

          {/* Clean Learning Journey Bar (Real Data Only) */}
          <div className="shrink-0 border-t border-[#252B36] px-8 py-3 flex items-center gap-4 bg-[#151922]">
            <span className="text-[10px] font-extrabold text-[#A2A8B5] uppercase tracking-widest">Status:</span>
            
            <div className="flex items-center gap-2 shrink-0 bg-[#0F1115] border border-[#252B36] rounded-[10px] px-3 py-1.5 shadow-sm">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[#42C67A]/10 text-[#42C67A]">✓</div>
              <span className="text-[12px] text-white font-bold">{meta.label} Ingested</span>
            </div>
            
            <div className="w-4 border-t border-dashed border-[#252B36] shrink-0"></div>
            
            <div className="flex items-center gap-2 shrink-0 bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 rounded-[10px] px-3 py-1.5 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#7C5CFF] animate-pulse" />
              <span className="text-[12px] text-white font-bold truncate max-w-[200px]">{title}</span>
            </div>
          </div>
        </Panel>

        {/* ── Column 3: Right - AI Teacher Panel ── */}
        {aiOpen && (
          <>
            <PanelResizeHandle className="w-1 bg-[#252B36] hover:bg-[#7C5CFF] transition-colors cursor-col-resize" />
            <Panel ref={aiPanelRef} collapsible defaultSize={25} minSize={15} onCollapse={() => setAiOpen(false)} onExpand={() => setAiOpen(true)} className="flex flex-col bg-[#151922]">
              <AssistantPanel
                sourceId={source.$id}
                title="Teacher Mode"
                initialMode="teacher"
                focusTopic={selectedTopic}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}
