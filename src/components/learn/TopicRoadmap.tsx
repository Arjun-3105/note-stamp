'use client';

import { useState } from 'react';

export interface RoadmapNode {
  id: string;
  label: string;
  description?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  videoInsight?: string;
  practicalExample?: string;
}

export interface RoadmapEdge {
  source: string;
  target: string;
  label?: string;
}

interface TopicRoadmapProps {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: RoadmapNode) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const DIFFICULTY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  beginner:     { bg: 'bg-[#42C67A]/10',   text: 'text-[#42C67A]',   dot: 'bg-[#42C67A]' },
  intermediate: { bg: 'bg-[#3b82f6]/10',   text: 'text-[#3b82f6]',   dot: 'bg-[#3b82f6]' },
  advanced:     { bg: 'bg-[#7C5CFF]/10', text: 'text-[#7C5CFF]', dot: 'bg-[#7C5CFF]' },
};

function getDifficultyStyle(d?: string) {
  return DIFFICULTY_STYLES[d || 'beginner'] || DIFFICULTY_STYLES.beginner;
}

function getConnectedNodeIds(nodeId: string, edges: RoadmapEdge[]): Set<string> {
  const connected = new Set<string>();
  edges.forEach(e => {
    if (e.source === nodeId) connected.add(e.target);
    if (e.target === nodeId) connected.add(e.source);
  });
  return connected;
}

export function TopicRoadmap({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  isOpen,
  onToggle,
}: TopicRoadmapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const connectedIds = selectedNodeId
    ? getConnectedNodeIds(selectedNodeId, edges)
    : new Set<string>();

  const groupByDifficulty = (difficulty: string) =>
    nodes.filter(n => (n.difficulty || 'beginner') === difficulty);

  const beginnerNodes = groupByDifficulty('beginner');
  const intermediateNodes = groupByDifficulty('intermediate');
  const advancedNodes = groupByDifficulty('advanced');

  return (
    <div className="bg-[#151922] transition-all duration-300 rounded-[20px] border border-[#252B36]">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#252B36]/30 transition-colors group rounded-t-[20px]"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[10px] bg-[#7C5CFF]/10 flex items-center justify-center text-[#7C5CFF] text-sm font-bold border border-[#7C5CFF]/20">
            ⬡
          </div>
          <span className="text-[15px] font-bold text-[#F5F6F8]">Topic Roadmap</span>
          <span className="text-[13px] text-[#A2A8B5] font-medium ml-2">
            {nodes.length} concepts
            {selectedNodeId && (
              <span className="ml-2 text-[#7C5CFF] font-semibold">
                · {nodes.find(n => n.id === selectedNodeId)?.label}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {selectedNodeId && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C5CFF] bg-[#7C5CFF]/10 px-2.5 py-1 rounded-[10px] border border-[#7C5CFF]/20">
              Topic selected
            </span>
          )}
          <svg
            className={`w-5 h-5 text-[#A2A8B5] group-hover:text-[#F5F6F8] transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Roadmap Body */}
      {isOpen && (
        <div className="px-5 pb-5 overflow-y-auto border-t border-[#252B36]" style={{ maxHeight: '320px' }}>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-5 mt-4 text-[13px] font-medium text-[#A2A8B5]">
            {['beginner', 'intermediate', 'advanced'].map(d => {
              const s = getDifficultyStyle(d);
              return (
                <span key={d} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  <span className="capitalize">{d}</span>
                </span>
              );
            })}
            <span className="ml-auto text-[#A2A8B5]/60 italic text-[12px]">Click to focus AI on that topic</span>
          </div>

          {/* Nodes by layer */}
          {[
            { label: 'Foundation', nodes: beginnerNodes },
            { label: 'Core Concepts', nodes: intermediateNodes },
            { label: 'Advanced', nodes: advancedNodes },
          ].map(layer => layer.nodes.length > 0 && (
            <div key={layer.label} className="mb-4">
              <div className="text-[11px] uppercase tracking-widest text-[#A2A8B5]/60 font-bold mb-2.5 px-1">
                {layer.label}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {layer.nodes.map(node => {
                  const style = getDifficultyStyle(node.difficulty);
                  const isSelected = node.id === selectedNodeId;
                  const isConnected = connectedIds.has(node.id);
                  const isHovered = hoveredId === node.id;
                  const isDimmed = selectedNodeId !== null && !isSelected && !isConnected;

                  return (
                    <button
                      key={node.id}
                      onClick={() => onSelectNode(node)}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`
                        relative group/node flex items-center gap-2 px-3.5 py-2 rounded-[14px] border text-left
                        transition-all duration-150 text-[13px] font-semibold cursor-pointer shadow-sm
                        ${isSelected
                          ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white shadow-md shadow-[#7C5CFF]/20'
                          : isConnected
                          ? `${style.bg} border-current/30 ${style.text} opacity-90`
                          : isDimmed
                          ? 'bg-[#0F1115] border-[#252B36] text-[#A2A8B5]/40 opacity-50'
                          : `${style.bg} border-transparent ${style.text} hover:border-current/30 hover:shadow`
                        }
                      `}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white' : style.dot}`} />
                      <span className="truncate max-w-[180px] text-[#F5F6F8]">{node.label}</span>
                      {isConnected && !isSelected && (
                        <span className="text-[10px] opacity-70 font-bold uppercase tracking-wider ml-1">related</span>
                      )}

                      {/* Hover tooltip */}
                      {(isHovered || isSelected) && node.description && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 z-50 pointer-events-none">
                          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-xl text-[12px] text-gray-300 leading-relaxed">
                            <div className="font-bold text-white mb-1.5">{node.label}</div>
                            <div className="text-gray-400">{node.description}</div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Relationship hint when a topic is selected */}
          {selectedNodeId && (
            <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-[#A2A8B5] bg-[#0F1115] p-2.5 rounded-[14px] border border-[#252B36]">
              <svg className="w-4 h-4 text-[#7C5CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>
                {connectedIds.size > 0
                  ? `${connectedIds.size} related concepts highlighted`
                  : 'No direct connections from this node'}
                {' · '}
                <button onClick={() => onSelectNode({ id: '', label: '' } as RoadmapNode)} className="text-[#7C5CFF] font-bold hover:text-[#7C5CFF]/80 underline underline-offset-2 ml-1">
                  Clear selection
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
