"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dagre from "dagre";
import { LearnWorkspace } from "@/components/learn/LearnWorkspace";

/* ─── types ──────────────────────────────────────────────────────────── */
type ConceptNode = {
  id: string; label: string; summary?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  description: string; videoInsight?: string; practicalExample?: string;
};
type ConceptEdge = { source: string; target: string; label: string };
type ViewMode = "graph" | "roadmap";

/* ─── palette ────────────────────────────────────────────────────────── */
const PAL = {
  beginner:     { accent: "#ffffff", dim: "rgba(255,255,255,0.08)",  text: "#ffffff", arrow: "#ffffff", glowBg: "rgba(255,255,255,0.05)" },
  intermediate: { accent: "#ffffff", dim: "rgba(255,255,255,0.06)",  text: "#ffffff", arrow: "#ffffff", glowBg: "rgba(255,255,255,0.04)" },
  advanced:     { accent: "#ffffff", dim: "rgba(255,255,255,0.04)",  text: "#ffffff", arrow: "#ffffff", glowBg: "rgba(255,255,255,0.03)" },
} as const;
const DEFAULT_PAL = PAL.intermediate;

/* ─── node dimensions (graph mode - INCREASED for bigger rendering area) ──────────────────────────────── */
const NODE_W = 380, NODE_H = 260, RANK_SEP = 280, NODE_SEP = 140, PAD = 100;

/* ─── topological sort ───────────────────────────────────────────────── */
function topoSort(nodes: ConceptNode[], edges: ConceptEdge[]): ConceptNode[] {
  const inDeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  nodes.forEach(n => { inDeg[n.id] = 0; adj[n.id] = []; });
  edges.forEach(e => {
    if (inDeg[e.target] !== undefined) inDeg[e.target]++;
    if (adj[e.source]) adj[e.source].push(e.target);
  });
  const queue = nodes.filter(n => inDeg[n.id] === 0).slice();
  const result: ConceptNode[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    result.push(n);
    (adj[n.id] ?? []).forEach(tid => {
      inDeg[tid]--;
      if (inDeg[tid] === 0) { const t = nodes.find(x => x.id === tid); if (t) queue.push(t); }
    });
  }
  nodes.forEach(n => { if (!result.find(r => r.id === n.id)) result.push(n); });
  return result;
}

/* ─── dagre layout (graph mode - VERTICAL top-to-bottom) ─────────────────────────────────────── */
function buildLayout(nodes: ConceptNode[], edges: ConceptEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: RANK_SEP, nodesep: NODE_SEP, marginx: PAD, marginy: PAD });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => { try { g.setEdge(e.source, e.target); } catch { /* skip */ } });
  dagre.layout(g);
  let maxX = 0, maxY = 0;
  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach(n => {
    const pos = g.node(n.id);
    if (!pos) return;
    const x = pos.x - NODE_W / 2, y = pos.y - NODE_H / 2;
    positions[n.id] = { x, y, cx: pos.x, cy: pos.y };
    maxX = Math.max(maxX, x + NODE_W + PAD);
    maxY = Math.max(maxY, y + NODE_H + PAD);
  });
  return { positions, totalW: Math.max(maxX, 1200), totalH: Math.max(maxY, 1000) };
}

function cubicPath(x1: number, y1: number, x2: number, y2: number) {
  // For vertical (TB) layout, use vertical control points
  const dy = Math.abs(y2 - y1) * 0.5;
  return `M ${x1} ${y1} C ${x1}, ${y1 + dy}, ${x2}, ${y2 - dy}, ${x2} ${y2}`;
}

/* ══════════════════════════════════════════════════════════════════════
   ROADMAP VIEW
══════════════════════════════════════════════════════════════════════ */
function RoadmapView({ nodes, edges, selectedId, onSelect }: {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = useMemo(() => topoSort(nodes, edges), [nodes, edges]);

  /* Build adjacency for "leads to" / "required by" tags */
  const leadsTo: Record<string, string[]> = {};
  const requiredBy: Record<string, string[]> = {};
  nodes.forEach(n => { leadsTo[n.id] = []; requiredBy[n.id] = []; });
  edges.forEach(e => {
    leadsTo[e.source]?.push(e.target);
    requiredBy[e.target]?.push(e.source);
  });

  /* Group by difficulty in meaningful order */
  const DIFF_ORDER = ["beginner", "intermediate", "advanced"];
  const grouped: Record<string, ConceptNode[]> = {};
  sorted.forEach(n => {
    const key = n.difficulty ?? "concept";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(n);
  });
  const groups: { key: string; nodes: ConceptNode[] }[] = [];
  DIFF_ORDER.forEach(k => { if (grouped[k]?.length) groups.push({ key: k, nodes: grouped[k] }); });
  Object.keys(grouped).forEach(k => { if (!DIFF_ORDER.includes(k) && grouped[k]?.length) groups.push({ key: k, nodes: grouped[k] }); });

  const globalIdx = (id: string) => nodes.findIndex(n => n.id === id);

  const LEVEL_ICONS = ["◆", "●", "▲"];

  return (
    <div style={{ padding: "32px 36px 32px 28px", overflowY: "auto", maxHeight: 640, background: "#0a0a0a", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}>
      <div style={{ position: "relative" }}>

        {/* vertical spine */}
        <div style={{
          position: "absolute", left: 21, top: 0, bottom: 0, width: 2,
          background: "linear-gradient(to bottom, rgba(56,189,248,0.0), rgba(56,189,248,0.10) 5%, rgba(56,189,248,0.10) 95%, rgba(56,189,248,0.0))",
          borderRadius: 2,
        }} />

        {groups.map((group, gi) => {
          const p = PAL[(group.key as keyof typeof PAL)] ?? DEFAULT_PAL;
          return (
            <div key={group.key} style={{ marginBottom: 8 }}>

              {/* ── section header ──────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.08, duration: 0.4 }}
                style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}
              >
                {/* spine diamond */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  border: `2px solid ${p.accent}`,
                  background: p.glowBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: p.text, zIndex: 2, position: "relative",
                  boxShadow: `0 0 24px ${p.accent}40, inset 0 0 20px ${p.accent}20`,
                  backdropFilter: "blur(10px)",
                }}>
                  {LEVEL_ICONS[gi] ?? "●"}
                </div>
                <div>
                  <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: p.text, margin: "0 0 4px", opacity: 0.7 }}>
                    Level {gi + 1}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                    {group.key.charAt(0).toUpperCase() + group.key.slice(1)}
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.42)", marginLeft: 10 }}>
                      {group.nodes.length} concept{group.nodes.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
              </motion.div>

              {/* ── concept cards ────────────────────────────────── */}
              <div style={{ paddingLeft: 64, paddingBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                {group.nodes.map((n, i) => {
                  const active = n.id === selectedId;
                  const idx = globalIdx(n.id);
                  const leads = leadsTo[n.id]?.map(id => nodes.find(x => x.id === id)?.label).filter(Boolean) ?? [];
                  const reqs = requiredBy[n.id]?.map(id => nodes.find(x => x.id === id)?.label).filter(Boolean) ?? [];
                  const desc = (n.summary || n.description || "").slice(0, 120) + ((n.summary || n.description || "").length > 120 ? "…" : "");
                  const isLast = i === group.nodes.length - 1;

                  return (
                    <div key={n.id} style={{ position: "relative" }}>
                      {/* horizontal connector arm */}
                      <div style={{
                        position: "absolute", left: -42, top: 26,
                        height: 1.5, width: 34,
                        background: active ? p.accent : "rgba(255,255,255,0.07)",
                        transition: "background 0.25s",
                      }} />
                      {/* dot on spine */}
                      <div style={{
                        position: "absolute", left: -51, top: 20,
                        width: 12, height: 12, borderRadius: "50%",
                        border: `2px solid ${active ? p.accent : "rgba(255,255,255,0.12)"}`,
                        background: active ? p.accent : "#0a0a0a",
                        zIndex: 2, transition: "all 0.25s",
                        boxShadow: active ? `0 0 10px ${p.accent}` : "none",
                      }} />
                      {/* vertical sub-connector between cards */}
                      {!isLast && (
                        <div style={{
                          position: "absolute", left: -45, top: 32, bottom: -10,
                          width: 1, background: "rgba(255,255,255,0.04)",
                        }} />
                      )}

                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.045, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        onClick={() => onSelect(n.id)}
                        style={{
                          borderRadius: 16, cursor: "pointer",
                          border: `1.5px solid ${active ? p.accent : "rgba(255,255,255,0.08)"}`,
                          background: active 
                            ? `linear-gradient(135deg, ${p.dim}, rgba(255,255,255,0.02))`
                            : "linear-gradient(135deg, rgba(255,255,255,0.02), transparent)",
                          overflow: "hidden",
                          transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                          boxShadow: active 
                            ? `0 0 32px ${p.accent}28, 0 0 0 1px ${p.accent}18, 0 8px 32px rgba(0,0,0,0.6)` 
                            : "0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        {/* accent top strip */}
                        <div style={{
                          height: 4,
                          background: active
                            ? `linear-gradient(90deg, ${p.accent}, ${p.accent}40)`
                            : "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)",
                          transition: "background 0.2s",
                        }} />

                        <div style={{ padding: "16px 18px 16px 16px" }}>
                          {/* number + title row */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: desc ? 10 : 2 }}>
                            <span style={{
                              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginTop: 0,
                              background: active ? p.accent : `linear-gradient(135deg, ${p.dim}, rgba(255,255,255,0.04))`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 900,
                              color: active ? "#000" : p.text, transition: "all 0.2s",
                              border: `1px solid ${active ? p.accent : "rgba(255,255,255,0.1)"}`,
                              boxShadow: active ? `0 0 12px ${p.accent}40` : "none",
                            }}>{String(idx + 1).padStart(2, "0")}</span>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: 15, fontWeight: 800, color: active ? "#fff" : "#d0d0d0",
                                margin: "0 0 3px", lineHeight: 1.3, letterSpacing: "-0.01em",
                                transition: "color 0.2s",
                              }}>{n.label}</p>
                              {desc && (
                                <p style={{
                                  fontSize: 13, fontWeight: 500, color: active ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.45)",
                                  margin: 0, lineHeight: 1.6, transition: "color 0.2s", letterSpacing: "-0.003em",
                                }}>{desc}</p>
                              )}
                            </div>

                            {/* expand chevron */}
                            <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: active ? p.text : "#444", transition: "color 0.2s" }}>
                              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>

                          {/* dependency tags */}
                          {(reqs.length > 0 || leads.length > 0) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 12, borderTop: `1px solid ${active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}` }}>
                              {reqs.slice(0, 2).map(r => (
                                <span key={r} style={{
                                  fontSize: 10, fontWeight: 600, padding: "4px 9px", borderRadius: 22,
                                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#aaa",
                                  display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s",
                                }}>
                                  <span style={{ opacity: 0.5, fontSize: 9 }}>↑</span> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r}</span>
                                </span>
                              ))}
                              {leads.slice(0, 2).map(l => (
                                <span key={l} style={{
                                  fontSize: 10, fontWeight: 600, padding: "4px 9px", borderRadius: 22,
                                  border: `1px solid ${p.accent}50`, background: `${p.glowBg}`, color: p.text,
                                  display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s",
                                }}>
                                  <span style={{ fontSize: 9 }}>→</span> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* finish flag */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            border: "2px solid rgba(56,189,248,0.18)",
            background: "rgba(56,189,248,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, zIndex: 2, position: "relative",
          }}>🏁</div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#38bdf8", opacity: 0.5, margin: "0 0 2px" }}>End</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#555", margin: 0 }}>Complete all concepts · then take the Assignment</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   GRAPH VIEW (custom canvas - larger rendering area)
══════════════════════════════════════════════════════════════════════ */
function GraphView({ nodes, edges, selectedId, onSelect, canvasW }: {
  nodes: ConceptNode[]; edges: ConceptEdge[];
  selectedId: string | null; onSelect: (id: string) => void; canvasW: number;
}) {
  const { positions, totalW, totalH } = useMemo(() => buildLayout(nodes, edges), [nodes, edges]);
  const scale = canvasW > 0 ? Math.min(1, canvasW / totalW) : 1;
  const svgH = totalH * scale;

  return (
    <div style={{ overflowX: "auto", overflowY: "auto", background: "#0a0a0a", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent", height: "100%", width: "100%" }}>
      <div style={{ position: "relative", width: totalW * scale, height: Math.max(svgH, 680), minWidth: "100%" }}>
        {/* dot grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="cm-dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="rgba(56,189,248,0.08)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cm-dots)" />
        </svg>

        {/* edges */}
        <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
          width={totalW * scale} height={totalH * scale}
          viewBox={`0 0 ${totalW} ${totalH}`} preserveAspectRatio="xMinYMin meet"
        >
          <defs>
            {/* Glow filter for edges */}
            <filter id="edge-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Strong glow for active edges */}
            <filter id="edge-glow-active">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Gradients for each difficulty level */}
            {nodes.map(n => {
              const p = PAL[(n.difficulty as keyof typeof PAL) ?? "intermediate"] ?? DEFAULT_PAL;
              return (
                <g key={`grad-${n.id}`}>
                  <linearGradient id={`grad-${n.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={p.accent} stopOpacity="0.6"/>
                    <stop offset="100%" stopColor={p.accent} stopOpacity="0.9"/>
                  </linearGradient>
                  <marker key={n.id} id={`ga-${n.id}`} markerWidth="20" markerHeight="20" refX="10" refY="16" orient="auto" markerUnits="userSpaceOnUse">
                    <polygon points="5,0 15,16 0,16" fill={p.arrow} />
                  </marker>
                </g>
              );
            })}
            <linearGradient id="grad-default" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="rgba(255,255,255,0.5)" stopOpacity="0.6"/>
            </linearGradient>
            <marker id="ga-default" markerWidth="20" markerHeight="20" refX="10" refY="16" orient="auto" markerUnits="userSpaceOnUse">
              <polygon points="5,0 15,16 0,16" fill="rgba(255,255,255,0.6)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const from = positions[e.source], to = positions[e.target];
            if (!from || !to) return null;
            // Vertical layout: edges flow downward (TB - top to bottom)
            const x1 = from.cx, y1 = from.y + NODE_H, x2 = to.cx, y2 = to.y;
            const srcPal  = PAL[(nodes.find(n => n.id === e.source)?.difficulty as keyof typeof PAL) ?? "intermediate"] ?? DEFAULT_PAL;
            const isActive = e.source === selectedId || e.target === selectedId;
            // Determine if edge is connected to selected node
            const isConnectedToSelected = selectedId && (e.source === selectedId || e.target === selectedId);
            // Determine visibility when a node is selected
            const isVisible = !selectedId || isConnectedToSelected;
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            return (
              <g key={i} style={{ opacity: isVisible ? 1 : 0.15, transition: "opacity 0.4s" }}>
                {/* Glow background layer */}
                <path d={cubicPath(x1, y1, x2, y2)} fill="none"
                  stroke={isActive ? srcPal.accent : "rgba(255,255,255,0.08)"}
                  strokeWidth={isActive ? 12 : 6}
                  opacity={isActive ? 0.25 : 0.12}
                  strokeLinecap="round"
                  filter={isActive ? "url(#edge-glow-active)" : "url(#edge-glow)"}
                />
                {/* Main edge line */}
                <path d={cubicPath(x1, y1, x2, y2)} fill="none"
                  stroke={isActive ? `url(#grad-${e.source})` : "url(#grad-default)"}
                  strokeWidth={isActive ? 4 : 2.8}
                  markerEnd={isActive ? `url(#ga-${e.source})` : "url(#ga-default)"}
                  style={{ transition: "stroke-width 0.3s, filter 0.3s" }}
                  strokeLinecap="round"
                  filter={isActive ? "url(#edge-glow-active)" : "url(#edge-glow)"}
                />
              </g>
            );
          })}
        </svg>

        {/* node cards */}
        {nodes.map((n, i) => {
          const pos = positions[n.id];
          if (!pos) return null;
          const p = PAL[(n.difficulty as keyof typeof PAL) ?? "intermediate"] ?? DEFAULT_PAL;
          const active = n.id === selectedId;
          const desc = (n.summary || n.description || "").slice(0, 100) + ((n.summary || n.description || "").length > 100 ? "…" : "");
          
          // Calculate node connectivity - find all connected nodes
          const connectedNodeIds = new Set<string>();
          edges.forEach(e => {
            if (e.source === selectedId) connectedNodeIds.add(e.target);
            if (e.target === selectedId) connectedNodeIds.add(e.source);
          });
          
          const isConnected = connectedNodeIds.has(n.id);
          const isSelected = n.id === selectedId;
          
          // Dynamic scaling: selected and connected nodes grow, others shrink
          let nodeScale = 1;
          let nodeOpacity = 1;
          if (selectedId && !isSelected) {
            if (isConnected) {
              nodeScale = 1.25; // Connected nodes grow 25%
              nodeOpacity = 1;
            } else {
              nodeScale = 0.75; // Other nodes shrink to 75%
              nodeOpacity = 0.4; // And fade away
            }
          }
          
          const effectiveScale = Math.min(scale, 1);
          const scaledNodeW = NODE_W * nodeScale * scale;
          const scaledNodeH = NODE_H * nodeScale * scale;
          // Adjust position to keep centered
          const posX = pos.x * scale - (scaledNodeW - NODE_W * scale) / 2;
          const posY = pos.y * scale - (scaledNodeH - NODE_H * scale) / 2;
          
          return (
            <motion.div key={n.id}
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: nodeOpacity, y: 0, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onSelect(n.id)}
              style={{
                position: "absolute", left: posX, top: posY,
                width: scaledNodeW, height: scaledNodeH, cursor: "pointer",
                borderRadius: Math.max(14, 18 * effectiveScale), overflow: "hidden",
                border: `1.2px solid #fff`,
                background: active 
                  ? `linear-gradient(135deg, ${p.dim}, rgba(255,255,255,0.03))`
                  : isConnected && selectedId
                  ? `linear-gradient(135deg, ${p.dim}, ${p.glowBg})`
                  : `linear-gradient(135deg, rgba(255,255,255,0.03), ${p.glowBg})`,
                boxShadow: "none",
                transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                backdropFilter: "none",
                filter: "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ 
                height: Math.max(4, 5 * scale), 
                background: active ? "linear-gradient(90deg, #fff, rgba(255,255,255,0.5))" : "linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))", 
                transition: "background 0.3s",
                flexShrink: 0,
              }} />
              <div style={{ padding: `${Math.max(18, 20 * scale)}px ${Math.max(20, 22 * scale)}px ${Math.max(16, 18 * scale)}px`, display: "flex", flexDirection: "column", gap: Math.max(6, 8 * scale), minHeight: 0, flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: Math.max(7, 9 * scale), flexShrink: 0 }}>
                  <span style={{ 
                    width: Math.max(22, 24 * scale), 
                    height: Math.max(22, 24 * scale), 
                    borderRadius: "50%", 
                    background: active ? p.accent : "transparent", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    fontSize: Math.max(10, 11 * scale), 
                    fontWeight: 900, 
                    color: active ? "#000" : "#fff",
                    border: "1.2px solid #fff",
                    boxShadow: "none",
                    flexShrink: 0,
                    transition: "all 0.3s",
                  }}>{i + 1}</span>
                  <span style={{ fontSize: Math.max(8, 8.5 * scale), fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "#fff", transition: "color 0.3s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "Syne, sans-serif" }}>{n.difficulty ?? "concept"}</span>
                </div>
                <div style={{ fontSize: Math.max(14, 16 * scale), fontWeight: 900, color: "#fff", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", transition: "color 0.3s", letterSpacing: "-0.015em", fontFamily: "Syne, sans-serif", overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word", wordWrap: "break-word" }}>{n.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function ConceptMap({ nodes, edges }: { nodes: ConceptNode[]; edges: ConceptEdge[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [showFeynman, setShowFeynman] = useState(false);
  const [viewMode, setViewMode]       = useState<ViewMode>("roadmap");
  const [maximized, setMaximized]     = useState(false);
  const [canvasW, setCanvasW]         = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selected = useMemo(() => nodes.find(n => n.id === selectedId) ?? nodes[0] ?? null, [nodes, selectedId]);
  const selectedIdx = nodes.findIndex(n => n.id === selectedId);
  const pal = PAL[(selected?.difficulty as keyof typeof PAL) ?? "intermediate"] ?? DEFAULT_PAL;

  const select = (id: string) => { setSelectedId(id); setShowFeynman(false); };

  return (
    <div ref={wrapperRef} style={{ fontFamily: "inherit", background: "#0a0a0a", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* ── top bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0d0d", gap: 12 }}>
        {/* live selected indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: pal.accent, boxShadow: `0 0 10px ${pal.accent}`, flexShrink: 0 }} />
          <AnimatePresence mode="wait">
            <motion.span key={selected?.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.15 }}
              style={{ fontSize: 13, fontWeight: 700, color: pal.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected?.label ?? "—"}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: 10, color: "#333", flexShrink: 0 }}>· {nodes.length} concepts</span>
        </div>

        {/* view toggle */}
        <div style={{ display: "flex", gap: 2, background: "#111", borderRadius: 10, padding: 3, border: "1px solid rgba(255,255,255,0.06)" }}>
          {(["roadmap", "graph"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{
                height: 28, borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 700,
                background: viewMode === m ? "rgba(255,255,255,0.08)" : "transparent",
                color: viewMode === m ? "#fff" : "#444",
                border: viewMode === m ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                cursor: "pointer", transition: "all 0.15s",
                textTransform: "capitalize",
              }}>
              {m === "roadmap" ? "Roadmap" : "Graph"}
            </button>
          ))}
        </div>

        {viewMode === "graph" && (
          <button onClick={() => setMaximized(!maximized)} 
            style={{ height: 32, borderRadius: 9, border: `1px solid ${maximized ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.22)"}`, background: maximized ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.07)", padding: "0 14px", fontSize: 11, fontWeight: 700, color: "#7dd3fc", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = maximized ? "rgba(56,189,248,0.12)" : "rgba(56,189,248,0.07)")}
            title={maximized ? "Minimize" : "Maximize graph"}
          >
            {maximized ? "◉ Fullscreen" : "⊡ Maximize"}
          </button>
        )}
        <button onClick={() => setShowFeynman(true)} style={{ height: 32, borderRadius: 9, border: "1px solid rgba(56,189,248,0.22)", background: "rgba(56,189,248,0.07)", padding: "0 14px", fontSize: 11, fontWeight: 700, color: "#7dd3fc", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(56,189,248,0.07)")}
        >
          Feynman →
        </button>
      </div>

      {/* ── node pill strip ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#0a0a0a", overflowX: "auto", scrollbarWidth: "none" }}>
        {nodes.map((n, i) => {
          const p = PAL[(n.difficulty as keyof typeof PAL) ?? "intermediate"] ?? DEFAULT_PAL;
          const active = n.id === selectedId;
          return (
            <button key={n.id} onClick={() => select(n.id)}
              style={{ 
                flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "6px 13px 6px 8px", 
                borderRadius: 22, border: `1.5px solid ${active ? p.accent : "rgba(255,255,255,0.1)"}`, 
                background: active 
                  ? `linear-gradient(135deg, ${p.dim}, rgba(255,255,255,0.02))`
                  : "rgba(255,255,255,0.02)",
                cursor: "pointer", transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)", 
                fontSize: 12, fontWeight: 700, color: active ? p.text : "rgba(255,255,255,0.50)", 
                whiteSpace: "nowrap",
                boxShadow: active ? `0 0 16px ${p.accent}30, inset 0 0 12px ${p.accent}20` : "none",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={e => { 
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; 
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
                }
              }}
              onMouseLeave={e => { 
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.50)"; 
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                }
              }}
            >
              <span style={{ 
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, 
                background: active ? p.accent : `linear-gradient(135deg, ${p.dim}, rgba(255,255,255,0.04))`, 
                display: "flex", alignItems: "center", justifyContent: "center", 
                fontSize: 8, fontWeight: 900, color: active ? "#000" : p.text,
                border: `1px solid ${active ? p.accent : "rgba(255,255,255,0.1)"}`,
                boxShadow: active ? `0 0 10px ${p.accent}40` : "none",
              }}>{i + 1}</span>
              {n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label}
            </button>
          );
        })}
      </div>

      {/* ── content area (side-by-side) ─────────────────────────────── */}
      <div style={{ display: "flex", height: maximized ? "calc(100vh - 240px)" : 760, overflow: "hidden", minHeight: maximized ? 600 : 760 }}>
        
        {/* Left Column: List / Graph (Main Focus - 72%) */}
        <div style={{ width: maximized ? "100%" : "72%", borderRight: maximized ? "none" : "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", transition: "all 0.3s ease" }}>
          <AnimatePresence mode="wait">
            <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ flex: 1, overflowY: "auto", background: "#0a0a0a", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}>
              {viewMode === "roadmap"
                ? <RoadmapView nodes={nodes} edges={edges} selectedId={selectedId} onSelect={select} />
                : <GraphView nodes={nodes} edges={edges} selectedId={selectedId} onSelect={select} canvasW={maximized ? canvasW : canvasW * 0.72} />
              }
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column: AI Detail Answer (Sidebar - 28%) */}
        <AnimatePresence>
          {!maximized && (
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.3 }}
              style={{ width: "28%", minWidth: 300, overflowY: "auto", background: "#0d0d0d", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div key={selected.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div style={{ padding: "28px 26px 20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ 
                      flexShrink: 0, width: 40, height: 40, borderRadius: "50%", border: `2px solid ${pal.accent}`, 
                      background: pal.glowBg, display: "flex", alignItems: "center", justifyContent: "center", 
                      fontSize: 14, fontWeight: 900, color: pal.text,
                      boxShadow: `0 0 16px ${pal.accent}40, inset 0 0 12px ${pal.accent}20`,
                      backdropFilter: "blur(8px)",
                    }}>
                      {selectedIdx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em", color: pal.text, marginBottom: 6, opacity: 0.7 }}>{selected.difficulty ?? "Concept"}</p>
                      <h4 style={{ fontSize: 22, fontStyle: "normal", fontWeight: 900, color: "#fff", margin: "0 0 12px", lineHeight: 1.25, letterSpacing: "-0.015em" }}>{selected.label}</h4>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", margin: 0, fontWeight: 500 }}>{selected.description}</p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "0 26px 28px" }}>
                  {(selected.videoInsight || selected.practicalExample) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {selected.videoInsight && (
                        <div style={{ 
                          borderRadius: 14, border: `1.5px solid ${pal.accent}50`, 
                          background: `linear-gradient(135deg, ${pal.dim}, rgba(255,255,255,0.01))`, 
                          padding: "16px", 
                          backdropFilter: "blur(8px)",
                          boxShadow: `0 0 12px ${pal.accent}15`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pal.accent, opacity: 0.9, boxShadow: `0 0 8px ${pal.accent}` }} />
                            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.13em", color: pal.text, margin: 0, opacity: 0.85 }}>📚 Video Insight</p>
                          </div>
                          <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.68)", margin: 0, fontWeight: 500 }}>{selected.videoInsight}</p>
                        </div>
                      )}
                      {selected.practicalExample && (
                        <div style={{ 
                          borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.2)", 
                          background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", 
                          padding: "16px",
                          backdropFilter: "blur(8px)",
                          boxShadow: "0 0 8px rgba(255,255,255,0.08)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffffff", opacity: 0.6, boxShadow: "none" }} />
                            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.13em", color: "rgba(255,255,255,0.7)", margin: 0, opacity: 1 }}>⚡ Practical Example</p>
                          </div>
                          <p style={{ fontFamily: "'Monaco', 'Courier New', monospace", fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.6)", margin: 0, whiteSpace: "pre-wrap", fontWeight: 500 }}>{selected.practicalExample}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Feynman drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFeynman && selected && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFeynman(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 260 }}
              style={{ position: "relative", width: "100%", maxWidth: 460, height: "100%", display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(56,189,248,0.10)", background: "#0a0a0a", boxShadow: "-40px 0 80px rgba(0,0,0,0.9)" }}>
              <div style={{ position: "absolute", right: 20, top: 20, zIndex: 10 }}>
                <button onClick={() => setShowFeynman(false)}
                  style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#555", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#555"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <LearnWorkspace conceptTitle={selected.label} conceptDescription={selected.description} onComplete={() => setShowFeynman(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

