'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/* ─────────────────────────────────────── Types ── */

export interface MapNode {
  id: string;
  label: string;
  description?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  videoInsight?: string;
  practicalExample?: string;
  // Prerequisite-map extras
  category?: 'foundation' | 'prerequisite' | 'near-prerequisite' | 'goal';
  timeEstimate?: string;
  resources?: string;
}

export interface MapEdge {
  source: string;
  target: string;
  label?: string;
}

type NodeStatus = 'available' | 'exploring' | 'known';
type MapType = 'source' | 'prerequisites';

/* ─────────────────────────────────────── Layout ── */

const NODE_W = 156;
const NODE_H = 62;
const H_GAP = 32;
const ROW_H = 190;
const PAD_X = 80;
const PAD_Y = 60;

const LAYER_INDEX: Record<string, number> = {
  beginner:  0,
  intermediate: 1,
  advanced:  2,
};
const PREREQ_LAYER: Record<string, number> = {
  foundation:       0,
  prerequisite:     1,
  'near-prerequisite': 2,
  goal:             3,
};

interface PositionedNode extends MapNode { x: number; y: number; }

function layoutNodes(nodes: MapNode[], mapType: MapType): PositionedNode[] {
  const getLayer = (n: MapNode) =>
    mapType === 'prerequisites'
      ? (PREREQ_LAYER[n.category ?? 'prerequisite'] ?? 1)
      : (LAYER_INDEX[n.difficulty ?? 'beginner'] ?? 1);

  const layers: Record<number, MapNode[]> = {};
  nodes.forEach(n => {
    const l = getLayer(n);
    if (!layers[l]) layers[l] = [];
    layers[l].push(n);
  });

  const out: PositionedNode[] = [];
  Object.keys(layers).sort((a, b) => +a - +b).forEach(rowStr => {
    const row = +rowStr;
    const rowNodes = layers[row];
    const totalW = rowNodes.length * NODE_W + (rowNodes.length - 1) * H_GAP;
    const centreX = 400; // will be offset by pan
    rowNodes.forEach((n, i) => {
      out.push({
        ...n,
        x: centreX - totalW / 2 + i * (NODE_W + H_GAP),
        y: PAD_Y + row * ROW_H,
      });
    });
  });
  return out;
}

function svgSize(positioned: PositionedNode[]) {
  if (!positioned.length) return { w: 800, h: 500 };
  const maxX = Math.max(...positioned.map(n => n.x + NODE_W));
  const maxY = Math.max(...positioned.map(n => n.y + NODE_H));
  return { w: Math.max(maxX + PAD_X, 800), h: Math.max(maxY + PAD_Y, 500) };
}

/* cubic bezier edge path */
function edgePath(src: PositionedNode, tgt: PositionedNode, flip = false) {
  const x1 = src.x + NODE_W / 2;
  const y1 = src.y + (flip ? 0 : NODE_H);
  const x2 = tgt.x + NODE_W / 2;
  const y2 = tgt.y + (flip ? NODE_H : 0);
  const cy = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
}

/* ─────────────────────────────────────── Colours ── */

const DIFF_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  beginner:     { bg: '#0a1929', border: '#1d4ed8', text: '#93c5fd', dot: '#3b82f6', glow: '#3b82f620' },
  intermediate: { bg: '#170f2e', border: '#6d28d9', text: '#c4b5fd', dot: '#7C5CFF', glow: '#7C5CFF20' },
  advanced:     { bg: '#0b1f13', border: '#065f46', text: '#6ee7b7', dot: '#10b981', glow: '#10b98120' },
};
const PREREQ_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  foundation:         { bg: '#0d1e2f', border: '#0369a1', text: '#7dd3fc', dot: '#38bdf8', glow: '#38bdf820' },
  prerequisite:       { bg: '#1a0f33', border: '#7c3aed', text: '#c4b5fd', dot: '#a78bfa', glow: '#a78bfa20' },
  'near-prerequisite': { bg: '#1f1400', border: '#b45309', text: '#fcd34d', dot: '#f59e0b', glow: '#f59e0b20' },
  goal:               { bg: '#0d1f0d', border: '#16a34a', text: '#86efac', dot: '#22c55e', glow: '#22c55e30' },
};

function nodeColors(n: MapNode, mapType: MapType) {
  if (mapType === 'prerequisites') return PREREQ_COLORS[n.category ?? 'prerequisite'] ?? PREREQ_COLORS.prerequisite;
  return DIFF_COLORS[n.difficulty ?? 'beginner'] ?? DIFF_COLORS.beginner;
}

const EDGE_LABEL_COLORS: Record<string, string> = {
  'required for': '#f87171',
  'builds on':    '#60a5fa',
  'enables':      '#a78bfa',
  'deepens with': '#34d399',
  'extends':      '#f472b6',
  'unlocks':      '#fbbf24',
  'used inside':  '#94a3b8',
  'composes with':'#e879f9',
};
const edgeLabelColor = (label?: string) => label ? (EDGE_LABEL_COLORS[label] ?? '#4b5563') : '#374151';

/* ─────────────────────────────────────── Find paths ── */

function findPath(edges: MapEdge[], fromId: string, toId: string): Set<string> {
  const adj: Record<string, string[]> = {};
  edges.forEach(e => { (adj[e.source] = adj[e.source] ?? []).push(e.target); });
  const visited = new Set<string>();
  const path = new Set<string>();
  function dfs(cur: string): boolean {
    if (cur === toId) { path.add(cur); return true; }
    if (visited.has(cur)) return false;
    visited.add(cur);
    for (const next of (adj[cur] ?? [])) {
      if (dfs(next)) { path.add(cur); return true; }
    }
    return false;
  }
  dfs(fromId);
  return path;
}

function connectedEdgeIds(edges: MapEdge[], nodeId: string): Set<string> {
  const ids = new Set<string>();
  edges.forEach((e, i) => {
    if (e.source === nodeId || e.target === nodeId) {
      ids.add(String(i));
    }
  });
  return ids;
}

/* ─────────────────────────────────────── Mini-Map ── */

function MiniMap({
  positioned,
  svgW,
  svgH,
  zoom,
  pan,
  mapType,
}: {
  positioned: PositionedNode[];
  svgW: number;
  svgH: number;
  zoom: number;
  pan: { x: number; y: number };
  mapType: MapType;
}) {
  const mmW = 130;
  const mmH = 80;
  const scaleX = mmW / Math.max(svgW + 100, 1);
  const scaleY = mmH / Math.max(svgH + 100, 1);
  const scale = Math.min(scaleX, scaleY);

  return (
    <div className="absolute bottom-10 right-3 rounded-xl overflow-hidden shadow-xl z-20 pointer-events-none"
      style={{ width: mmW, height: mmH, background: '#0d0d14', border: '1px solid #252B36' }}>
      <svg width={mmW} height={mmH}>
        {positioned.map(n => {
          const c = nodeColors(n, mapType);
          return (
            <rect key={n.id}
              x={(n.x + PAD_X) * scale}
              y={(n.y) * scale}
              width={NODE_W * scale}
              height={NODE_H * scale}
              rx={3}
              fill={c.dot}
              opacity={0.7}
            />
          );
        })}
        {/* viewport indicator */}
        <rect
          x={(-pan.x / zoom) * scale}
          y={(-pan.y / zoom) * scale}
          width={(800 / zoom) * scale}
          height={(500 / zoom) * scale}
          fill="none"
          stroke="#7C5CFF"
          strokeWidth="1.5"
          rx={2}
          opacity={0.8}
        />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-[#555] font-semibold py-0.5">
        MINI-MAP
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Graph Canvas ── */

function GraphCanvas({
  nodes,
  edges,
  mapType,
  selectedId,
  onSelectNode,
  searchQuery,
}: {
  nodes: MapNode[];
  edges: MapEdge[];
  mapType: MapType;
  selectedId: string | null;
  onSelectNode: (n: MapNode | null) => void;
  searchQuery: string;
}) {
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [mounted, setMounted] = useState(false);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // stagger-animate on mount
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [nodes.length]);

  // Reset when nodes change (new map loaded)
  useEffect(() => {
    setMounted(false);
    setZoom(0.85);
    setPan({ x: 60, y: 20 });
    setStatuses({});
    onSelectNode(null);
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType]);

  const positioned = useMemo(() => layoutNodes(nodes, mapType), [nodes, mapType]);
  const { w: svgW, h: svgH } = useMemo(() => svgSize(positioned), [positioned]);
  const posMap = useMemo(() => new Map(positioned.map(n => [n.id, n])), [positioned]);

  // Search highlight
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(nodes.filter(n => n.label.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q)).map(n => n.id));
  }, [nodes, searchQuery]);

  // Path from root to selected
  const highlightPath = useMemo(() => {
    if (!selectedId) return null;
    const rootNode = positioned[0];
    if (!rootNode) return null;
    return findPath(edges, rootNode.id, selectedId);
  }, [selectedId, edges, positioned]);

  const highlightEdges = useMemo(() => {
    if (!selectedId) return null;
    return connectedEdgeIds(edges, selectedId);
  }, [selectedId, edges]);

  // Cycle node status on click
  const handleNodeClick = (n: MapNode) => {
    const cur = statuses[n.id] ?? 'available';
    const next: NodeStatus = cur === 'available' ? 'exploring' : cur === 'exploring' ? 'known' : 'available';
    setStatuses(prev => ({ ...prev, [n.id]: next }));
    onSelectNode(selectedId === n.id ? null : n);
  };

  // Pan + wheel
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.map-node')) return;
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !panStart.current) return;
    setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
  };
  const onMouseUp = () => { setIsPanning(false); panStart.current = null; };
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2.2, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  const zoomIn  = () => setZoom(z => Math.min(2.2, z * 1.15));
  const zoomOut = () => setZoom(z => Math.max(0.3, z * 0.87));
  const resetView = () => { setZoom(0.85); setPan({ x: 60, y: 20 }); };

  // Layer labels
  const layerLabels = useMemo(() => {
    if (mapType === 'prerequisites') {
      return [
        { label: 'FOUNDATIONS', y: PAD_Y - 30, color: '#38bdf8', key: 'foundation' },
        { label: 'PREREQUISITES', y: PAD_Y + ROW_H - 30, color: '#a78bfa', key: 'prerequisite' },
        { label: 'NEAR-PREREQUISITES', y: PAD_Y + ROW_H * 2 - 30, color: '#f59e0b', key: 'near-prerequisite' },
        { label: 'GOAL', y: PAD_Y + ROW_H * 3 - 30, color: '#22c55e', key: 'goal' },
      ].filter(l => nodes.some(n => (n.category ?? 'prerequisite') === l.key));
    }
    return [
      { label: 'FOUNDATION', y: PAD_Y - 30, color: DIFF_COLORS.beginner.dot, key: 'beginner' },
      { label: 'CORE CONCEPTS', y: PAD_Y + ROW_H - 30, color: DIFF_COLORS.intermediate.dot, key: 'intermediate' },
      { label: 'ADVANCED', y: PAD_Y + ROW_H * 2 - 30, color: DIFF_COLORS.advanced.dot, key: 'advanced' },
    ].filter(l => nodes.some(n => (n.difficulty ?? 'beginner') === l.key));
  }, [mapType, nodes]);

  if (nodes.length === 0) return null;

  const explored = Object.values(statuses).filter(s => s !== 'available').length;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button onClick={zoomIn} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold text-[#A2A8B5] hover:text-white transition-all hover:bg-[#252B36]"
          style={{ background: '#151922', border: '1px solid #252B36' }}>+</button>
        <button onClick={zoomOut} className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold text-[#A2A8B5] hover:text-white transition-all hover:bg-[#252B36]"
          style={{ background: '#151922', border: '1px solid #252B36' }}>−</button>
        <button onClick={resetView} className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-[#A2A8B5] hover:text-white transition-all hover:bg-[#252B36]"
          style={{ background: '#151922', border: '1px solid #252B36' }}>⤢</button>
      </div>

      {/* Mini-map */}
      <MiniMap positioned={positioned} svgW={svgW} svgH={svgH} zoom={zoom} pan={pan} mapType={mapType} />

      {/* SVG canvas */}
      <svg
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <defs>
          {/* Dot grid pattern */}
          <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#252B36" />
          </pattern>
          {/* Animated edge gradient */}
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
          </linearGradient>
          {/* Arrowheads */}
          <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#374151" />
          </marker>
          <marker id="arr-active" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="url(#edgeGrad)" />
          </marker>
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

          {/* Layer labels */}
          {layerLabels.map(l => (
            <text key={l.label} x={0} y={l.y} fontSize="9" fontWeight="800" fill={l.color}
              opacity={0.5} style={{ letterSpacing: '0.18em', pointerEvents: 'none' }}>
              {l.label}
            </text>
          ))}

          {/* Edges */}
          {edges.map((edge, i) => {
            const src = posMap.get(edge.source);
            const tgt = posMap.get(edge.target);
            if (!src || !tgt) return null;

            const isHighlighted = highlightEdges?.has(String(i));
            const isPathEdge = highlightPath?.has(edge.source) && highlightPath?.has(edge.target);
            const isDimmed = (highlightEdges || highlightPath) && !isHighlighted && !isPathEdge;
            const col = isPathEdge ? 'url(#edgeGrad)' : isHighlighted ? edgeLabelColor(edge.label) : '#2a2a3a';

            return (
              <g key={`e-${i}`}>
                <path
                  d={edgePath(src, tgt)}
                  fill="none"
                  stroke={col}
                  strokeWidth={isPathEdge ? 2.5 : isHighlighted ? 2 : 1.5}
                  strokeDasharray={isHighlighted || isPathEdge ? 'none' : '5 4'}
                  markerEnd={isHighlighted || isPathEdge ? 'url(#arr-active)' : 'url(#arr)'}
                  opacity={isDimmed ? 0.1 : isPathEdge ? 0.95 : 0.75}
                  style={{ transition: 'opacity 0.25s, stroke 0.25s' }}
                />
                {/* Edge label on hover/select */}
                {(isHighlighted || isPathEdge) && edge.label && (
                  <text
                    x={(src.x + NODE_W / 2 + tgt.x + NODE_W / 2) / 2}
                    y={(src.y + NODE_H + tgt.y) / 2}
                    fontSize="8.5"
                    textAnchor="middle"
                    fill={edgeLabelColor(edge.label)}
                    fontWeight="700"
                    style={{ pointerEvents: 'none', letterSpacing: '0.04em' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {positioned.map((node, idx) => {
            const c = nodeColors(node, mapType);
            const isSelected = selectedId === node.id;
            const isHovered = hoveredId === node.id;
            const status = statuses[node.id] ?? 'available';
            const inSearch = searchMatches !== null && !searchMatches.has(node.id);
            const inPath = highlightPath?.has(node.id);
            const isDimmed = (inSearch || (highlightPath && !inPath)) && !isSelected;

            const delay = (idx * 40) % 600;
            const nodeOpacity = !mounted ? 0 : isDimmed ? 0.2 : 1;

            return (
              <g
                key={node.id}
                className="map-node"
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  cursor: 'pointer',
                  opacity: nodeOpacity,
                  transition: `opacity 0.35s ease ${delay}ms, transform 0.2s ease`,
                }}
              >
                {/* Glow halo on selected */}
                {(isSelected || inPath) && (
                  <rect
                    x={-5} y={-5}
                    width={NODE_W + 10} height={NODE_H + 10}
                    rx={17}
                    fill={c.glow}
                    style={{ filter: 'url(#glow)' }}
                  />
                )}

                {/* Main rect */}
                <rect
                  width={NODE_W} height={NODE_H}
                  rx={13}
                  fill={isSelected ? c.border + '28' : c.bg}
                  stroke={isSelected ? c.border : isHovered ? c.border + '99' : c.border + '50'}
                  strokeWidth={isSelected ? 2 : 1.5}
                  style={{ transition: 'stroke 0.15s, fill 0.15s' }}
                />

                {/* Goal node — special star */}
                {node.category === 'goal' && (
                  <text x={NODE_W - 16} y={16} fontSize="10" fill="#22c55e" style={{ pointerEvents: 'none' }}>★</text>
                )}

                {/* Status dot */}
                {status !== 'available' && (
                  <circle cx={NODE_W - 11} cy={11} r={4.5}
                    fill={status === 'known' ? '#10b981' : '#7C5CFF'}
                    stroke="#0F1115" strokeWidth="1.5" />
                )}

                {/* Diff / category dot */}
                <circle cx={13} cy={NODE_H / 2} r={3.5} fill={c.dot} opacity={0.85} />

                {/* Label text — 2 lines max */}
                {(() => {
                  const words = node.label.split(' ');
                  const mid = Math.ceil(words.length / 2);
                  const hasTwo = words.length > 3;
                  const l1 = hasTwo ? words.slice(0, mid).join(' ') : node.label;
                  const l2 = hasTwo ? words.slice(mid).join(' ') : null;
                  return (
                    <text
                      x={NODE_W / 2}
                      y={hasTwo ? NODE_H / 2 - 5 : NODE_H / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill={isSelected ? '#fff' : c.text}
                      style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
                    >
                      <tspan x={NODE_W / 2} dy="0">{l1}</tspan>
                      {l2 && <tspan x={NODE_W / 2} dy="14">{l2}</tspan>}
                    </text>
                  );
                })()}

                {/* Time estimate badge (prerequisite map only) */}
                {mapType === 'prerequisites' && node.timeEstimate && (
                  <text x={NODE_W / 2} y={NODE_H - 7} textAnchor="middle" fontSize="8.5"
                    fill={c.dot} opacity={0.7} style={{ pointerEvents: 'none' }}>
                    {node.timeEstimate}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-[136px] px-4 py-2 flex items-center gap-4 border-t border-[#252B36] bg-[#0F1115]/90"
        style={{ backdropFilter: 'blur(6px)' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A2A8B5] shrink-0">
          {mapType === 'source' ? 'Explored' : 'Completed'}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[#252B36] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${nodes.length ? (explored / nodes.length) * 100 : 0}%`,
              background: mapType === 'source' ? 'linear-gradient(90deg,#7C5CFF,#3b82f6)' : 'linear-gradient(90deg,#22c55e,#06b6d4)',
            }} />
        </div>
        <span className="text-[11px] font-bold text-[#F5F6F8] shrink-0">{explored}/{nodes.length}</span>
        <span className="text-[10px] text-[#555] shrink-0">
          {mapType === 'source' ? 'Click node → explore → mark known' : 'Click to mark prerequisites known'}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Node Detail Card ── */

function NodeDetailCard({ node, mapType, onClose }: { node: MapNode; mapType: MapType; onClose: () => void }) {
  const c = nodeColors(node, mapType);
  return (
    <div className="rounded-2xl p-4 space-y-2.5 relative" style={{ background: c.bg, border: `1px solid ${c.border}60` }}>
      <button onClick={onClose} className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full text-[10px] text-[#555] hover:text-white transition-colors"
        style={{ background: '#2a2a38' }}>✕</button>

      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.dot }} />
        <p className="text-[13px] font-extrabold" style={{ color: c.text }}>{node.label}</p>
      </div>

      {node.description && (
        <p className="text-[12px] text-[#A2A8B5] leading-relaxed">{node.description}</p>
      )}

      {mapType === 'prerequisites' && node.timeEstimate && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#555]">Time</span>
          <span className="text-[12px] font-bold" style={{ color: c.dot }}>{node.timeEstimate}</span>
        </div>
      )}

      {node.videoInsight && (
        <div className="pt-2" style={{ borderTop: `1px solid ${c.border}30` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: c.dot }}>From the source</p>
          <p className="text-[12px] text-[#A2A8B5] leading-relaxed">{node.videoInsight}</p>
        </div>
      )}

      {mapType === 'prerequisites' && node.resources && (
        <div className="pt-2" style={{ borderTop: `1px solid ${c.border}30` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: c.dot }}>How to learn</p>
          <p className="text-[12px] text-[#A2A8B5] leading-relaxed">{node.resources}</p>
        </div>
      )}

      {node.practicalExample && (
        <div className="pt-2" style={{ borderTop: `1px solid ${c.border}30` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: c.dot }}>Example</p>
          <p className="text-[12px] text-[#A2A8B5] leading-relaxed italic">{node.practicalExample}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── AI Sidebar ── */

function AIAdvisorSidebar({
  nodes,
  selectedNode,
  sourceId,
  mapType,
  onSelectNode,
}: {
  nodes: MapNode[];
  selectedNode: MapNode | null;
  sourceId: string;
  mapType: MapType;
  onSelectNode: (n: MapNode) => void;
}) {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'guide' | 'chat'>('guide');
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef<string>('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendToAI = useCallback(async (msg: string) => {
    if (!sourceId || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          contextType: 'source',
          contextId: sourceId,
          mode: 'roadmap_guide',
          focusTopic: selectedNode ? { id: selectedNode.id, label: selectedNode.label } : null,
        }),
      });
      if (!res.ok || !res.body) throw new Error('AI failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      setMessages(prev => [...prev, { role: 'ai', text: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const a = [...prev];
          a[a.length - 1] = { role: 'ai', text: full };
          return a;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Couldn't reach AI. Try again." }]);
    } finally {
      setLoading(false);
    }
  }, [sourceId, selectedNode, loading]);

  // Auto-start per mapType
  useEffect(() => {
    const key = `${mapType}-${nodes.length}`;
    if (!sourceId || autoStarted.current === key || nodes.length === 0) return;
    autoStarted.current = key;
    setMessages([]);
    const nodeList = nodes.map(n => n.label).join(', ');
    const msg = mapType === 'source'
      ? `I'm looking at the source concept map which has: ${nodeList}. What should I focus on first and why?`
      : `I'm looking at the prerequisites roadmap which shows I need to know: ${nodeList}. Which of these am I most likely missing and how should I fill the gaps?`;
    sendToAI(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType, nodes.length, sourceId]);

  // Auto-query when node selected
  useEffect(() => {
    if (!selectedNode) return;
    const prompt = mapType === 'source'
      ? `Tell me about "${selectedNode.label}" in this context — why it matters, what I should understand about it, and what it connects to.`
      : `I'm assessing my knowledge of "${selectedNode.label}" as a prerequisite. ${selectedNode.description || ''} How can I verify I understand this well enough before moving on?`;
    sendToAI(prompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, mapType]);

  const topNodes = nodes.slice(0, mapType === 'source' ? 3 : 4);

  const quickPrompts = mapType === 'source'
    ? ['What order should I follow?', 'Which concept is most critical?', 'Show me the big picture']
    : ['Which gap hurts most?', 'How long will this take me?', 'What can I skip?'];

  return (
    <div className="h-full flex flex-col border-l border-[#252B36]" style={{ background: '#16161f', width: 270 }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px]"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>✦</div>
        <span className="text-[12px] font-extrabold text-white">AI Guide</span>
        <button className="ml-auto text-[#555] hover:text-white transition-colors"
          onClick={() => { setMessages([]); autoStarted.current = ''; }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 px-4 shrink-0" style={{ borderBottom: '1px solid #252B36' }}>
        {(['guide','chat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="text-[11px] font-semibold pb-2 capitalize transition-colors"
            style={{ color: tab === t ? '#F5F6F8' : '#555', borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent' }}>
            {t === 'guide' ? 'Recommendations' : 'Ask AI'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0" style={{ scrollbarWidth: 'none' }}>

        {tab === 'guide' && (
          <>
            {/* Latest AI message */}
            {messages.filter(m => m.role === 'ai').slice(-1).map((m, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: '#1e2a1e', border: '1px solid #2a3a2a' }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#6ee7b7] mb-1.5">
                  {selectedNode ? `About: ${selectedNode.label}` : 'AI Recommendation'}
                </p>
                <p className="text-[11.5px] text-[#6ee7b7] leading-relaxed">
                  {m.text.substring(0, 240)}{m.text.length > 240 ? '…' : ''}
                </p>
              </div>
            ))}

            {loading && messages.filter(m => m.role === 'ai').length === 0 && (
              <div className="rounded-xl p-3" style={{ background: '#1e2a1e', border: '1px solid #2a3a2a' }}>
                <div className="flex gap-1.5 items-center">
                  {[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: '#3b82f6', animationDelay: `${i * 120}ms` }} />)}
                </div>
              </div>
            )}

            {/* Node detail */}
            {selectedNode && (
              <NodeDetailCard node={selectedNode} mapType={mapType} onClose={() => onSelectNode(null as any)} />
            )}

            {/* Top nodes */}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-1.5">
                {mapType === 'source' ? 'Learn in this order' : 'Know before starting'}
              </p>
              <div className="space-y-1.5">
                {topNodes.map((n, i) => {
                  const c = nodeColors(n, mapType);
                  return (
                    <div key={n.id}
                      className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:opacity-90 transition-all"
                      style={{ background: '#1e1e28', border: '1px solid #2a2a38' }}
                      onClick={() => onSelectNode(n)}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                        style={{ background: c.dot }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{n.label}</p>
                        {mapType === 'prerequisites' && n.timeEstimate && (
                          <p className="text-[10px] text-[#555]">{n.timeEstimate}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick prompts */}
            <div className="space-y-1">
              {quickPrompts.map(p => (
                <button key={p} onClick={() => { setTab('chat'); sendToAI(p); }}
                  disabled={loading}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all hover:bg-[#1e1e28] disabled:opacity-40"
                  style={{ border: '1px solid #252B36', color: '#A2A8B5' }}>
                  <span className="text-[11px]">→</span>
                  <span className="text-[11px] font-medium">{p}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'chat' && (
          <>
            {messages.length === 0 && !loading && (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-xl"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>🗺️</div>
                <p className="text-[11px] text-[#555] leading-relaxed px-2">Ask about your learning path</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && (
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>✦</div>
                )}
                <div className="max-w-[88%] px-2.5 py-2 text-[11.5px] leading-relaxed"
                  style={m.role === 'user'
                    ? { background: '#1e1e28', color: '#F5F6F8', borderRadius: '14px 14px 4px 14px', border: '1px solid #252B36' }
                    : { background: 'rgba(59,130,246,0.07)', color: '#F5F6F8', borderRadius: '14px 14px 14px 4px', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-1.5 items-center ml-6">
                {[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: '#3b82f6', animationDelay: `${i * 120}ms` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: '#151922', border: '1px solid #252B36' }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { setTab('chat'); sendToAI(input.trim()); setInput(''); } }}
            placeholder="Ask about your path…"
            disabled={loading}
            className="flex-1 bg-transparent text-[12px] text-[#F5F6F8] placeholder-[#555] outline-none" />
          <button onClick={() => { if (input.trim()) { setTab('chat'); sendToAI(input.trim()); setInput(''); } }}
            disabled={!input.trim() || loading}
            className="w-6 h-6 rounded-[8px] flex items-center justify-center transition-all shrink-0"
            style={{ background: input.trim() ? '#3b82f6' : '#252B36', color: input.trim() ? '#fff' : '#555' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── Main Export ── */

export interface LearningMapViewProps {
  nodes: MapNode[];
  edges: MapEdge[];
  sourceId: string;
  sourceTitle: string;
  loading?: boolean;
  isDetailed?: boolean;
  onGenerateDetailed?: () => void;
}

export function LearningMapView({
  nodes,
  edges,
  sourceId,
  sourceTitle,
  loading = false,
  isDetailed = false,
  onGenerateDetailed,
}: LearningMapViewProps) {
  const [mapType, setMapType] = useState<MapType>('source');
  const [prereqNodes, setPrereqNodes] = useState<MapNode[]>([]);
  const [prereqEdges, setPrereqEdges] = useState<MapEdge[]>([]);
  const [prereqLoading, setPrereqLoading] = useState(false);
  const [prereqFetched, setPrereqFetched] = useState(false);
  const [isDetailedPrereq, setIsDetailedPrereq] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'map' | 'list' | 'milestones'>('map');

  const activeNodes = mapType === 'source' ? nodes : prereqNodes;
  const activeEdges = mapType === 'source' ? edges : prereqEdges;
  const isLoading   = mapType === 'source' ? loading : prereqLoading;

  // Fetch prerequisite map on demand
  const fetchPrereqs = useCallback(async (detailed: boolean = false) => {
    if (prereqLoading) return;
    setPrereqLoading(true);
    try {
      const res = await fetch('/api/prerequisite-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          sourceTitle,
          sourceConcepts: nodes.map(n => n.label),
          detailed
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPrereqNodes(data.nodes ?? []);
      setPrereqEdges(data.edges ?? []);
      setPrereqFetched(true);
      if (detailed) setIsDetailedPrereq(true);
    } catch {
      setPrereqFetched(true); // don't retry
    } finally {
      setPrereqLoading(false);
    }
  }, [sourceTitle, nodes, prereqFetched, prereqLoading]);

  const handleMapTypeChange = (t: MapType) => {
    setMapType(t);
    setSelectedNode(null);
    setSearch('');
    if (t === 'prerequisites' && !prereqFetched) fetchPrereqs(false);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#0F1115' }}>

      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-[#252B36] bg-[#151922]">

        {/* Map toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-[12px] bg-[#0F1115] border border-[#252B36]">
          <button
            onClick={() => handleMapTypeChange('source')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all"
            style={{
              background: mapType === 'source' ? '#252B36' : 'transparent',
              color: mapType === 'source' ? '#F5F6F8' : '#555',
            }}>
            <span className="w-2 h-2 rounded-full bg-[#7C5CFF]" />
            Source Map
          </button>
          <button
            onClick={() => handleMapTypeChange('prerequisites')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-all"
            style={{
              background: mapType === 'prerequisites' ? '#252B36' : 'transparent',
              color: mapType === 'prerequisites' ? '#F5F6F8' : '#555',
            }}>
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            Prerequisites
            {!prereqFetched && mapType !== 'prerequisites' && (
              <span className="text-[9px] px-1 py-0.5 rounded-md font-semibold bg-[#22c55e]/10 text-[#22c55e]">NEW</span>
            )}
          </button>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-0.5">
          {(['map', 'list', 'milestones'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold transition-all capitalize"
              style={{ background: tab === t ? '#252B36' : 'transparent', color: tab === t ? '#F5F6F8' : '#555' }}>
              {t === 'map' ? '⬡ Graph' : t === 'list' ? '☰ List' : '★ Goals'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] flex-1 max-w-[200px]"
          style={{ background: '#0F1115', border: '1px solid #252B36' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-[11px] text-[#A2A8B5] placeholder-[#555] outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#555] hover:text-white text-xs">✕</button>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 ml-auto shrink-0">
          {mapType === 'source' ? (
            Object.entries(DIFF_COLORS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-[#555]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.dot }} />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </span>
            ))
          ) : (
            Object.entries(PREREQ_COLORS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-[#555]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.dot }} />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex min-h-0 relative">
        
        {/* Detailed Roadmap Button */}
        {!isDetailed && onGenerateDetailed && mapType === 'source' && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onGenerateDetailed}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7C5CFF, #4F39F6)' }}
            >
              <span>{isLoading ? 'Generating...' : '✨ Generate Detailed Roadmap'}</span>
            </button>
          </div>
        )}
        {!isDetailedPrereq && mapType === 'prerequisites' && prereqNodes.length > 0 && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => fetchPrereqs(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <span>{isLoading ? 'Generating...' : '✨ Generate Detailed Prerequisites'}</span>
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden relative min-w-0">

          {/* GRAPH VIEW */}
          {tab === 'map' && (
            <>
              {isLoading && activeNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="flex gap-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-3 h-3 rounded-full animate-bounce"
                        style={{ background: mapType === 'source' ? '#7C5CFF' : '#22c55e', animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <p className="text-[13px] text-[#A2A8B5] font-medium">
                    {mapType === 'source' ? 'Building concept map…' : 'Generating prerequisite roadmap…'}
                  </p>
                  <p className="text-[11px] text-[#555]">
                    {mapType === 'prerequisites' ? 'AI is mapping what you need to know before this source' : 'Analysing source content'}
                  </p>
                </div>
              )}

              {!isLoading && activeNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="text-4xl opacity-30">{mapType === 'source' ? '🗺️' : '🧭'}</div>
                  <p className="text-[13px] font-bold text-[#F5F6F8]">
                    {mapType === 'source' ? 'No concept map yet' : 'No prerequisites yet'}
                  </p>
                  <p className="text-[12px] text-[#555] leading-relaxed max-w-xs">
                    {mapType === 'source'
                      ? 'Concept maps are generated from YouTube video transcripts. Add a video source to see your learning map.'
                      : 'Click "Generate" to create a prerequisite roadmap showing what you need to know before this source.'}
                  </p>
                  {mapType === 'prerequisites' && (
                    <button onClick={fetchPrereqs}
                      className="px-5 py-2 rounded-xl text-[13px] font-bold transition-all hover:opacity-90"
                      style={{ background: '#22c55e', color: '#000' }}>
                      Generate Prerequisites Map
                    </button>
                  )}
                </div>
              )}

              {activeNodes.length > 0 && (
                <GraphCanvas
                  nodes={activeNodes}
                  edges={activeEdges}
                  mapType={mapType}
                  selectedId={selectedNode?.id ?? null}
                  onSelectNode={setSelectedNode}
                  searchQuery={search}
                />
              )}
            </>
          )}

          {/* LIST VIEW */}
          {tab === 'list' && (
            <div className="h-full overflow-y-auto p-5 space-y-2" style={{ scrollbarWidth: 'none' }}>
              <p className="text-[11px] text-[#555] mb-3">Click any concept to highlight it in the graph.</p>
              {activeNodes.map((n, i) => {
                const c = nodeColors(n, mapType);
                return (
                  <div key={n.id}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:opacity-90 transition-all"
                    style={{ background: c.bg, border: `1px solid ${c.border}40` }}
                    onClick={() => { setSelectedNode(n); setTab('map'); }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                      style={{ background: c.dot, color: '#000' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[13px] font-bold" style={{ color: c.text }}>{n.label}</p>
                        {n.timeEstimate && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ color: c.dot, background: `${c.dot}1a` }}>{n.timeEstimate}</span>
                        )}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto"
                          style={{ color: c.dot, background: `${c.dot}1a` }}>
                          {n.category ?? n.difficulty}
                        </span>
                      </div>
                      {n.description && <p className="text-[12px] text-[#A2A8B5] leading-relaxed">{n.description}</p>}
                      {n.resources && <p className="text-[11px] mt-1" style={{ color: c.dot }}>→ {n.resources}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MILESTONES VIEW */}
          {tab === 'milestones' && (
            <div className="h-full overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
              {/* Summary */}
              <div className="rounded-2xl p-5 text-center"
                style={{ background: mapType === 'source' ? 'rgba(124,92,255,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${mapType === 'source' ? 'rgba(124,92,255,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
                <div className="text-4xl mb-2">{mapType === 'source' ? '🏆' : '🧭'}</div>
                <p className="text-[14px] font-bold text-white mb-1">
                  {mapType === 'source' ? `${sourceTitle} Expert` : 'Learning Journey Complete'}
                </p>
                <p className="text-[12px] text-[#555] leading-relaxed mb-2">
                  {mapType === 'source'
                    ? `Explore all ${activeNodes.length} source concepts`
                    : `Master all ${activeNodes.length} prerequisite areas`}
                </p>
              </div>

              {/* Milestone checklist */}
              <div className="space-y-2">
                {[
                  { icon: '🚀', label: 'First concept explored', desc: 'Click your first node in the graph', done: false },
                  { icon: '🧱', label: `Foundation mastered`, desc: `Know all ${activeNodes.filter(n => (n.difficulty || n.category) === 'beginner' || n.category === 'foundation').length} foundation concepts`, done: false },
                  { icon: '🎯', label: 'Core unlocked', desc: 'Progress to intermediate concepts', done: false },
                  { icon: '🔬', label: 'Deep diver', desc: 'Explore 5+ concepts', done: false },
                  { icon: '🗺️', label: 'Map complete', desc: `All ${activeNodes.length} concepts explored`, done: false },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: '#151922', border: '1px solid #252B36' }}>
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-[#F5F6F8]">{m.label}</p>
                      <p className="text-[11px] text-[#555]">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Sidebar */}
        <AIAdvisorSidebar
          nodes={activeNodes}
          selectedNode={selectedNode}
          sourceId={sourceId}
          mapType={mapType}
          onSelectNode={n => n ? setSelectedNode(n) : setSelectedNode(null)}
        />
      </div>
    </div>
  );
}
