'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MathStep {
  latex: string;
  verifiedCorrect?: boolean;
  explanation?: string;
  checking?: boolean;
}

interface MathWhiteboardProps {
  sourceId?: string;
  workspaceId: string;
}

export function MathWhiteboard({ sourceId, workspaceId }: MathWhiteboardProps) {
  const [steps, setSteps] = useState<MathStep[]>([{ latex: '' }]);
  const [problemContext, setProblemContext] = useState('');
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false);
  const [kateXLoaded, setKaTeXLoaded] = useState(false);
  const [desmosLoaded, setDesmosLoaded] = useState(false);
  const desmosContainerRef = useRef<HTMLDivElement>(null);
  const desmosRef = useRef<any>(null);
  const [graphInput, setGraphInput] = useState('y=x^2+2x');
  const [graphPinned, setGraphPinned] = useState(false);
  const layerIdsRef = useRef<string[]>([]);
  const [activeShades, setActiveShades] = useState<Record<string, string>>({}); // dir -> id
  // 3 equations max (for intersections)
  const [equations, setEquations] = useState<string[]>(['y=x^2+2x', 'y=2x+1', '']);
  const [selectedEq, setSelectedEq] = useState(0);
  const [intersections, setIntersections] = useState<{ x: number; y: number; eqA: number; eqB: number }[]>([]);
  const [showRoots, setShowRoots] = useState<Record<number, boolean>>({});
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const zoomDesmosRef = useRef<any>(null);
  const EQ_IDS = ['eq1', 'eq2', 'eq3'] as const;
  const EQ_COLORS = ['#7C5CFF', '#22c55e', '#f59e0b'];

  // Load MathLive, KaTeX, Desmos from CDN
  useEffect(() => {
    // KaTeX CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }

    // KaTeX JS
    if (!(window as any).katex) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      s.onload = () => setKaTeXLoaded(true);
      document.head.appendChild(s);
    } else {
      setKaTeXLoaded(true);
    }

    // MathLive
    if (!(window as any).MathfieldElement) {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/mathlive@0.100.0/dist/mathlive.min.js';
      s.type = 'module';
      s.onload = () => setMathLiveLoaded(true);
      document.head.appendChild(s);
    } else {
      setMathLiveLoaded(true);
    }

    // Desmos
    if (!(window as any).Desmos) {
      const s = document.createElement('script');
      s.src = 'https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
      s.onload = () => setDesmosLoaded(true);
      document.head.appendChild(s);
    } else {
      setDesmosLoaded(true);
    }
  }, []);

  // Initialize Desmos when ready
  useEffect(() => {
    if (!desmosLoaded || !desmosContainerRef.current) return;
    desmosRef.current = (window as any).Desmos.GraphingCalculator(desmosContainerRef.current, {
      expressionsCollapsed: false,
      keypad: false,
      settingsMenu: true,
      zoomButtons: true,
    });
    if (graphInput) {
      try { desmosRef.current.setExpression({ id: 'main', latex: graphInput }); } catch {}
    }
    equations.forEach((eq, i) => {
      if (eq.trim() && EQ_IDS[i] !== 'eq1') {
        try { desmosRef.current.setExpression({ id: EQ_IDS[i], latex: eq, color: EQ_COLORS[i] }); } catch {}
      }
    });
  }, [desmosLoaded]);

  // Zoom Desmos — init when zoom opens and sync expressions
  useEffect(() => {
    if (!zoomOpen || !desmosLoaded || !zoomContainerRef.current) return;
    zoomDesmosRef.current = (window as any).Desmos.GraphingCalculator(zoomContainerRef.current, {
      expressionsCollapsed: false,
      keypad: false,
      settingsMenu: true,
      zoomButtons: true,
    });
    // copy all current expressions to zoom instance
    const all = [
      { id: 'main', latex: graphInput },
      ...equations.map((eq, i) => ({ id: EQ_IDS[i], latex: eq, color: EQ_COLORS[i] })),
    ];
    all.forEach(e => {
      if (!e.latex.trim()) return;
      try { zoomDesmosRef.current.setExpression({ id: e.id + '-z', latex: e.latex, color: (e as any).color || '#7C5CFF' }); } catch {}
    });
    // copy active layers/shades/derivatives etc. from main
    try {
      const exprs = desmosRef.current?.getExpressions?.() || [];
      exprs.forEach((ex: any) => {
        if (ex.id && (ex.id.startsWith('shade-') || ex.id.startsWith('layer-') || ex.id.startsWith('deriv-') || ex.id.startsWith('tang-') || ex.id.startsWith('inter-') || ex.id.startsWith('root-') || ex.id === 'a' || ex.id === 'b' || ex.id === 'x0')) {
          try { zoomDesmosRef.current.setExpression({ ...ex, id: ex.id + '-z' }); } catch {}
        }
      });
    } catch {}
    return () => {
      try { zoomDesmosRef.current?.destroy?.(); } catch {}
      zoomDesmosRef.current = null;
    };
  }, [zoomOpen, desmosLoaded, equations, graphInput]);

  // esc to close zoom
  useEffect(() => {
    if (!zoomOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [zoomOpen]);

  const renderKaTeX = (latex: string): string => {
    try {
      return (window as any).katex.renderToString(latex, { throwOnError: false, displayMode: true });
    } catch {
      return `<code>${latex}</code>`;
    }
  };

  const updateDesmosGraph = useCallback((latex: string, opts?: { pinned?: boolean; id?: string }) => {
    if (!desmosRef.current || !latex?.trim()) return;
    try {
      let expr = latex.trim();
      if (!expr.includes('=') && !expr.includes('\\') && !expr.includes('>') && !expr.includes('<')) {
        if (/[xy]/.test(expr)) expr = `y=${expr}`;
      }
      const id = opts?.id ?? 'main';
      const color = id === 'main' ? '#7C5CFF' : id === 'eq2' ? EQ_COLORS[1] : id === 'eq3' ? EQ_COLORS[2] : '#22c55e';
      desmosRef.current.setExpression({ id, latex: expr, color });
      if (opts?.pinned !== false) {
        if (!graphPinned && id === 'main') setGraphInput(latex);
      }
    } catch {
      // ignore invalid expressions
    }
  }, [graphPinned]);

  const normalizeLatex = useCallback((s: string) => {
    let t = s.trim();
    // normalize sin/cos/tan without backslash for Desmos
    t = t.replace(/(?<!\\)\bsin\b/g, '\\sin').replace(/(?<!\\)\bcos\b/g, '\\cos').replace(/(?<!\\)\btan\b/g, '\\tan').replace(/(?<!\\)\blog\b/g, '\\log');
    return t;
  }, []);
  const updateEquation = useCallback((idx: number, latex: string) => {
    const norm = normalizeLatex(latex);
    setEquations(prev => {
      const n = [...prev];
      n[idx] = norm;
      return n;
    });
    const id = EQ_IDS[idx];
    if (!norm.trim()) {
      try { desmosRef.current?.removeExpression({ id }); } catch {}
      return;
    }
    try {
      let expr = norm.trim();
      if (!expr.includes('=') && !expr.includes('\\') && !expr.includes('>') && !expr.includes('<')) {
        if (/[xy]/.test(expr)) expr = `y=${expr}`;
      }
      expr = expr.replace(/(?<!\\)\bsin\(/g, '\\sin(').replace(/(?<!\\)\bcos\(/g, '\\cos(').replace(/(?<!\\)\btan\(/g, '\\tan(');
      const style = idx === 1 ? 'DASHED' : idx === 2 ? 'SOLID' : 'SOLID';
      desmosRef.current?.setExpression({ id, latex: expr, color: EQ_COLORS[idx], lineStyle: style as any });
    } catch {}
    if (idx === 0) setGraphInput(norm);
  }, [normalizeLatex]);

  const addLayer = useCallback((latex: string, color = '#22c55e') => {
    if (!desmosRef.current || !latex.trim()) return;
    const id = 'layer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 4);
    try {
      desmosRef.current.setExpression({ id, latex, color });
      layerIdsRef.current.push(id);
    } catch {}
  }, []);

  const clearLayers = useCallback(() => {
    layerIdsRef.current.forEach(id => { try { desmosRef.current?.removeExpression({ id }); } catch {} });
    layerIdsRef.current = [];
    // also clear toggled shades
    Object.values(activeShades).forEach(id => { try { desmosRef.current?.removeExpression({ id }); } catch {} });
    setActiveShades({});
  }, [activeShades]);

  // Helpers for multi-equation actions
  const getRhs = useCallback((latex: string) => {
    const t = latex.trim();
    if (!t) return '';
    return t.includes('=') ? t.split('=').slice(1).join('=').trim() : t;
  }, []);
  const evalRhs = useCallback((rhs: string, x: number) => {
    try {
      let e = rhs.replace(/\^/g, '**').replace(/\\sin/g, 'Math.sin').replace(/\\cos/g, 'Math.cos').replace(/\\tan/g, 'Math.tan').replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)').replace(/\\pi/g, 'Math.PI');
      e = e.replace(/(\d)(x)/g, '$1*$2').replace(/(\))(x)/g, '$1*$2').replace(/(x)(\()/g, '$1*$2').replace(/(\d)(Math)/g, '$1*$2');
      // eslint-disable-next-line no-new-func
      return Function('x', `return ${e}`)(x) as number;
    } catch { return NaN; }
  }, []);
  const isExplicitY = useCallback((eq: string) => eq.split('=')[0]?.trim() === 'y', []);
  const evalWithXY = useCallback((expr: string, x: number, y: number) => {
    try {
      let e = expr.replace(/\^/g, '**').replace(/\\sin/g, 'Math.sin').replace(/\\cos/g, 'Math.cos').replace(/\\tan/g, 'Math.tan').replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)').replace(/\\pi/g, 'Math.PI');
      e = e.replace(/(\d)(x)/g, '$1*$2').replace(/(\d)(y)/g, '$1*$2').replace(/(\))(x)/g, '$1*$2').replace(/(\))(y)/g, '$1*$2').replace(/(x)(\()/g, '$1*$2').replace(/(y)(\()/g, '$1*$2').replace(/(\d)(Math)/g, '$1*$2');
      // eslint-disable-next-line no-new-func
      return Function('x', 'y', `return ${e}`)(x, y) as number;
    } catch { return NaN; }
  }, []);
  const satisfiesEq = useCallback((eq: string, x: number, y: number) => {
    const parts = eq.split('=');
    if (parts.length !== 2) return false;
    const lv = evalWithXY(parts[0], x, y), rv = evalWithXY(parts[1], x, y);
    return isFinite(lv) && isFinite(rv) && Math.abs(lv - rv) < 0.08;
  }, [evalWithXY]);
  const findIntersections = useCallback(() => {
    if (!desmosRef.current) return;
    // toggle: if already showing, second click removes
    if (intersections.length > 0) {
      for (let i = 0; i < 12; i++) { try { desmosRef.current.removeExpression({ id: `inter-${i}` }); } catch {} }
      setIntersections([]);
      return;
    }
    for (let i = 0; i < 12; i++) { try { desmosRef.current.removeExpression({ id: `inter-${i}` }); } catch {} }
    const active = equations.map((e, i) => ({ eq: e, rhs: getRhs(e), idx: i })).filter(a => a.eq.trim());
    const found: { x: number; y: number; eqA: number; eqB: number }[] = [];
    for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
      const eqA = active[a].eq, eqB = active[b].eq;
      if (eqA.trim() === eqB.trim()) continue;
      const expA = isExplicitY(eqA), expB = isExplicitY(eqB);
      const rA = getRhs(eqA), rB = getRhs(eqB);
      if (expA && expB) {
        for (let x = -10; x <= 10; x += 0.15) {
          const yA = evalRhs(rA, x), yB = evalRhs(rB, x);
          const yA2 = evalRhs(rA, x + 0.15), yB2 = evalRhs(rB, x + 0.15);
          if (!isFinite(yA) || !isFinite(yB) || !isFinite(yA2) || !isFinite(yB2)) continue;
          if (Math.abs(yA) > 60 || Math.abs(yB) > 60) continue;
          const d1 = yA - yB, d2 = yA2 - yB2;
          if (Math.abs(d1) < 1e-6) { if (Math.abs(yA) <= 22) found.push({ x, y: yA, eqA: active[a].idx, eqB: active[b].idx }); }
          else if (d1 * d2 < 0) {
            let l = x, r = x + 0.15;
            for (let k = 0; k < 18; k++) { const m = (l + r) / 2; const ymA = evalRhs(rA, m), ymB = evalRhs(rB, m); if (!isFinite(ymA) || !isFinite(ymB)) break; const dm = ymA - ymB; if (d1 * dm <= 0) r = m; else l = m; }
            const xm = (l + r) / 2, ym = evalRhs(rA, xm);
            if (isFinite(ym) && Math.abs(ym) <= 22) found.push({ x: xm, y: ym, eqA: active[a].idx, eqB: active[b].idx });
          }
        }
      } else if (expA !== expB) {
        const expEq = expA ? eqA : eqB, impEq = expA ? eqB : eqA;
        const expIdx = expA ? active[a].idx : active[b].idx;
        const impIdx = expA ? active[b].idx : active[a].idx;
        const expRhs = expA ? rA : rB;
        for (let x = -10; x <= 10; x += 0.12) {
          const y = evalRhs(expRhs, x);
          if (!isFinite(y) || Math.abs(y) > 60) continue;
          const y2 = evalRhs(expRhs, x + 0.12);
          if (!isFinite(y2)) continue;
          const sat1 = satisfiesEq(impEq, x, y), sat2 = satisfiesEq(impEq, x + 0.12, y2);
          if (sat1) found.push({ x, y, eqA: expIdx, eqB: impIdx });
          else if (!sat1 && !sat2) {
            // check sign of residual for bisection
            const res1 = (() => { const p = impEq.split('='); return evalWithXY(p[0], x, y) - evalWithXY(p[1], x, y); })();
            const res2 = (() => { const p = impEq.split('='); return evalWithXY(p[0], x + 0.12, y2) - evalWithXY(p[1], x + 0.12, y2); })();
            if (isFinite(res1) && isFinite(res2) && res1 * res2 < 0) {
              let l = x, r = x + 0.12;
              for (let k = 0; k < 16; k++) { const m = (l + r) / 2; const ym = evalRhs(expRhs, m); if (!isFinite(ym)) break; const pm = impEq.split('='); const rm = evalWithXY(pm[0], m, ym) - evalWithXY(pm[1], m, ym); if (res1 * rm <= 0) r = m; else l = m; }
              const xm = (l + r) / 2, ym = evalRhs(expRhs, xm);
              if (isFinite(ym) && Math.abs(ym) <= 22 && satisfiesEq(impEq, xm, ym)) found.push({ x: xm, y: ym, eqA: expIdx, eqB: impIdx });
            }
          }
        }
      } else {
        // both implicit (e.g., two circles) - sample grid
        for (let x = -8; x <= 8; x += 0.3) for (let y = -8; y <= 8; y += 0.3) {
          if (satisfiesEq(eqA, x, y) && satisfiesEq(eqB, x, y)) found.push({ x, y, eqA: active[a].idx, eqB: active[b].idx });
        }
      }
    }
    const uniq: typeof found = [];
    found.forEach(p => { if (!uniq.some(q => Math.abs(q.x - p.x) < 0.18 && Math.abs(q.y - p.y) < 0.18)) uniq.push(p); });
    uniq.sort((a, b) => a.x - b.x);
    uniq.slice(0, 8).forEach((p, i) => {
      try {
        desmosRef.current.setExpression({ id: `inter-${i}`, latex: `(${p.x.toFixed(3)},${p.y.toFixed(3)})`, color: '#f59e0b', showLabel: true, label: `Eq${p.eqA+1}∩Eq${p.eqB+1} x=${p.x.toFixed(2)}` });
      } catch {}
    });
    setIntersections(uniq.slice(0, 8));
  }, [equations, getRhs, evalRhs, evalWithXY, satisfiesEq, isExplicitY, intersections]);

  const toggleDerivative = useCallback(() => {
    const key = `deriv-${selectedEq}`;
    const existing = activeShades[key];
    if (existing) { try { desmosRef.current?.removeExpression({ id: existing }); } catch {} setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    const latex = `y = \\frac{d}{dx}(${rhs})`;
    const id = key + '-' + Date.now();
    try { desmosRef.current?.setExpression({ id, latex, color: EQ_COLORS[selectedEq] }); setActiveShades(p => ({ ...p, [key]: id })); } catch {}
  }, [selectedEq, equations, graphInput, getRhs, activeShades]);

  const toggleTangent = useCallback(() => {
    const key = `tang-${selectedEq}`;
    const existing = activeShades[key];
    if (existing) { try { desmosRef.current?.removeExpression({ id: existing }); desmosRef.current?.removeExpression({ id: existing + '-pt' }); } catch {} setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    const id = key + '-' + Date.now();
    try {
      desmosRef.current?.setExpression({ id: 'x0', latex: 'x_0=1', sliderBounds: { min: '-5', max: '5', step: '0.1' } });
      desmosRef.current?.setExpression({ id, latex: `y - (${rhs.replace(/x/g, 'x_0')}) = \\frac{d}{dx}(${rhs})|_{x=x_0} (x - x_0)`, color: EQ_COLORS[selectedEq] });
      desmosRef.current?.setExpression({ id: id + '-pt', latex: `(x_0, ${rhs.replace(/x/g, 'x_0')})`, color: EQ_COLORS[selectedEq], showLabel: true });
      setActiveShades(p => ({ ...p, [key]: id }));
    } catch {}
  }, [selectedEq, equations, graphInput, getRhs, activeShades]);

  const toggleRoots = useCallback(() => {
    if (showRoots[selectedEq]) {
      for (let i = 0; i < 6; i++) try { desmosRef.current?.removeExpression({ id: `root-${selectedEq}-${i}` }); } catch {}
      setShowRoots(prev => ({ ...prev, [selectedEq]: false })); return;
    }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    // for implicit like x^2+y^2=25, roots = where y=0 -> solve x^2=25
    if (!rhs.includes('x') && rhs.trim() === '25') {
      [-5, 5].forEach((x, i) => {
        try { desmosRef.current?.setExpression({ id: `root-${selectedEq}-${i}`, latex: `(${x.toFixed(3)},0)`, color: EQ_COLORS[selectedEq], showLabel: true, label: `root ${x.toFixed(2)}` }); } catch {}
      });
      setShowRoots(prev => ({ ...prev, [selectedEq]: true })); return;
    }
    const roots: number[] = [];
    for (let x = -10; x <= 10; x += 0.1) {
      const y1 = evalRhs(rhs, x), y2 = evalRhs(rhs, x + 0.1);
      if (!isFinite(y1) || !isFinite(y2)) continue;
      if (Math.abs(y1) < 1e-7) roots.push(x);
      else if (y1 * y2 < 0) {
        let l = x, r = x + 0.1;
        for (let k = 0; k < 15; k++) { const m = (l + r) / 2; const ym = evalRhs(rhs, m); if (ym * y1 <= 0) r = m; else l = m; }
        roots.push((l + r) / 2);
      }
    }
    roots.slice(0, 6).forEach((x, i) => {
      try { desmosRef.current?.setExpression({ id: `root-${selectedEq}-${i}`, latex: `(${x.toFixed(3)},0)`, color: EQ_COLORS[selectedEq], showLabel: true, label: `root ${x.toFixed(2)}` }); } catch {}
    });
    setShowRoots(prev => ({ ...prev, [selectedEq]: true }));
  }, [showRoots, selectedEq, equations, graphInput, getRhs, evalRhs]);

  const toggleYIntercept = useCallback(() => {
    const key = `yint-${selectedEq}`;
    const existing = activeShades[key];
    if (existing) { try { desmosRef.current?.removeExpression({ id: existing }); } catch {} setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    const y0 = evalRhs(rhs, 0);
    if (!isFinite(y0)) return;
    const id = key + '-' + Date.now();
    try { desmosRef.current?.setExpression({ id, latex: `(0,${y0.toFixed(3)})`, color: EQ_COLORS[selectedEq], showLabel: true, label: `y-int ${y0.toFixed(2)}` }); setActiveShades(p => ({ ...p, [key]: id })); } catch {}
  }, [selectedEq, equations, graphInput, getRhs, evalRhs, activeShades]);

  const toggleExtrema = useCallback(() => {
    const key = `ext-${selectedEq}`;
    const existing = activeShades[key];
    if (existing) {
      for (let i = 0; i < 6; i++) try { desmosRef.current?.removeExpression({ id: `${key}-${i}` }); } catch {}
      try { desmosRef.current?.removeExpression({ id: key }); } catch {}
      setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return;
    }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    const pts: { x: number; y: number }[] = [];
    for (let x = -10; x <= 10; x += 0.1) {
      const d1 = (evalRhs(rhs, x + 0.01) - evalRhs(rhs, x - 0.01)) / 0.02;
      const d2 = (evalRhs(rhs, x + 0.11) - evalRhs(rhs, x + 0.09)) / 0.02;
      if (!isFinite(d1) || !isFinite(d2)) continue;
      if (Math.abs(d1) < 0.05) pts.push({ x, y: evalRhs(rhs, x) });
      else if (d1 * d2 < 0) {
        let l = x, r = x + 0.1;
        for (let k = 0; k < 12; k++) { const m = (l + r) / 2; const dm = (evalRhs(rhs, m + 0.01) - evalRhs(rhs, m - 0.01)) / 0.02; if (dm * d1 <= 0) r = m; else l = m; }
        const xm = (l + r) / 2; const ym = evalRhs(rhs, xm);
        if (isFinite(ym)) pts.push({ x: xm, y: ym });
      }
    }
    const uniq: typeof pts = [];
    pts.forEach(p => { if (!uniq.some(q => Math.abs(q.x - p.x) < 0.2)) uniq.push(p); });
    uniq.slice(0, 4).forEach((p, i) => {
      try { desmosRef.current?.setExpression({ id: `${key}-${i}`, latex: `(${p.x.toFixed(3)},${p.y.toFixed(3)})`, color: EQ_COLORS[selectedEq], showLabel: true, label: `ext ${p.y.toFixed(2)}` }); } catch {}
    });
    // keep key to allow toggle off
    try { desmosRef.current?.setExpression({ id: key, latex: `y=${rhs}`, color: EQ_COLORS[selectedEq], hidden: true } as any); } catch {}
    setActiveShades(p => ({ ...p, [key]: key }));
  }, [selectedEq, equations, graphInput, getRhs, evalRhs, activeShades]);

  const toggleIntegral = useCallback(() => {
    const key = `int-${selectedEq}`;
    const existing = activeShades[key];
    if (existing) {
      try { desmosRef.current?.removeExpression({ id: existing }); desmosRef.current?.removeExpression({ id: 'a' }); desmosRef.current?.removeExpression({ id: 'b' }); if (zoomDesmosRef.current) { zoomDesmosRef.current?.removeExpression({ id: existing + '-z' }); zoomDesmosRef.current?.removeExpression({ id: 'a-z' }); zoomDesmosRef.current?.removeExpression({ id: 'b-z' }); } } catch {}
      setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return;
    }
    const rhs = getRhs(equations[selectedEq] || graphInput);
    if (!rhs) return;
    const id = key + '-' + Date.now();
    try {
      // Use simple 0<=y<=f(x) without domain chain (Desmos limit 2 inequalities). Sliders a,b still shown for reference.
      desmosRef.current?.setExpression({ id: 'a', latex: 'a=0', sliderBounds: { min: '-5', max: '5', step: '0.1' } });
      desmosRef.current?.setExpression({ id: 'b', latex: 'b=2', sliderBounds: { min: '-5', max: '5', step: '0.1' } });
      desmosRef.current?.setExpression({ id, latex: `0 \\le y \\le ${rhs}`, color: EQ_COLORS[selectedEq] });
      if (zoomDesmosRef.current) {
        zoomDesmosRef.current?.setExpression({ id: 'a-z', latex: 'a=0', sliderBounds: { min: '-5', max: '5', step: '0.1' } });
        zoomDesmosRef.current?.setExpression({ id: 'b-z', latex: 'b=2', sliderBounds: { min: '-5', max: '5', step: '0.1' } });
        zoomDesmosRef.current?.setExpression({ id: id + '-z', latex: `0 \\le y \\le ${rhs}`, color: EQ_COLORS[selectedEq] });
      }
      setActiveShades(p => ({ ...p, [key]: id }));
    } catch {}
  }, [selectedEq, equations, graphInput, getRhs, activeShades]);

  const toggleAreaBetween = useCallback(() => {
    const key = `area-between`;
    const existing = activeShades[key];
    if (existing) { try { desmosRef.current?.removeExpression({ id: existing }); } catch {} setActiveShades(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const active = equations.map((e, i) => ({ rhs: getRhs(e), idx: i, eq: e })).filter(a => a.rhs);
    if (active.length < 2) return;
    const a = active.find(x => x.idx === selectedEq) || active[0];
    const b = active.find(x => x.idx !== a.idx) || active[1];
    if (!b) return;
    let pairInters = intersections.filter(p => (p.eqA === a.idx && p.eqB === b.idx) || (p.eqA === b.idx && p.eqB === a.idx));
    if (pairInters.length < 2) {
      const rA = a.rhs, rB = b.rhs;
      const tmp: { x: number }[] = [];
      for (let x = -10; x <= 10; x += 0.15) {
        const yA = evalRhs(rA, x), yB = evalRhs(rB, x);
        const yA2 = evalRhs(rA, x + 0.15), yB2 = evalRhs(rB, x + 0.15);
        if (!isFinite(yA) || !isFinite(yB) || !isFinite(yA2) || !isFinite(yB2)) continue;
        const d1 = yA - yB, d2 = yA2 - yB2;
        if (Math.abs(d1) < 1e-6) tmp.push({ x });
        else if (d1 * d2 < 0) {
          let l = x, r = x + 0.15;
          for (let k = 0; k < 16; k++) { const m = (l + r) / 2; const ymA = evalRhs(rA, m), ymB = evalRhs(rB, m); if (!isFinite(ymA) || !isFinite(ymB)) break; const dm = ymA - ymB; if (d1 * dm <= 0) r = m; else l = m; }
          tmp.push({ x: (l + r) / 2 });
        }
      }
      const uniqTmp: typeof tmp = [];
      tmp.forEach(p => { if (!uniqTmp.some(q => Math.abs(q.x - p.x) < 0.2)) uniqTmp.push(p); });
      if (uniqTmp.length >= 2) {
        pairInters = uniqTmp.slice(0, 2).map(p => ({ x: p.x, y: 0, eqA: a.idx, eqB: b.idx }));
      } else if (tmp.length > 0) {
        pairInters = tmp.slice(0, 1).map(p => ({ x: p.x, y: 0, eqA: a.idx, eqB: b.idx }));
      }
    }
    let bounds = '';
    let lower = a.rhs, upper = b.rhs;
    if (pairInters.length >= 2) {
      const xs = pairInters.map(p => p.x);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      bounds = `{${minX.toFixed(2)} \\le x \\le ${maxX.toFixed(2)}}`;
      const mid = (minX + maxX) / 2;
      const yA = evalRhs(a.rhs, mid), yB = evalRhs(b.rhs, mid);
      if (isFinite(yA) && isFinite(yB) && yA > yB) { lower = b.rhs; upper = a.rhs; }
    } else if (pairInters.length === 1) {
      const x0 = pairInters[0].x;
      bounds = `{${(x0 - 1).toFixed(2)} \\le x \\le ${(x0 + 1).toFixed(2)}}`;
      const yA = evalRhs(a.rhs, x0), yB = evalRhs(b.rhs, x0);
      if (isFinite(yA) && isFinite(yB) && yA > yB) { lower = b.rhs; upper = a.rhs; }
    } else {
      bounds = `{-1 \\le x \\le 1}`;
      const yA0 = evalRhs(a.rhs, 0), yB0 = evalRhs(b.rhs, 0);
      if (isFinite(yA0) && isFinite(yB0) && yA0 > yB0) { lower = b.rhs; upper = a.rhs; }
    }
    const id = key + '-' + Date.now();
    try {
      // No domain chain — Desmos limit 2 inequalities, and f<=y<=g already restricts x to where f<=g (between intersections)
      desmosRef.current?.setExpression({ id, latex: `${lower} \\le y \\le ${upper}`, color: EQ_COLORS[selectedEq] });
      if (zoomDesmosRef.current) zoomDesmosRef.current?.setExpression({ id: id + '-z', latex: `${lower} \\le y \\le ${upper}`, color: EQ_COLORS[selectedEq] });
      setActiveShades(p => ({ ...p, [key]: id }));
    } catch {}
  }, [selectedEq, equations, getRhs, activeShades, intersections, evalRhs]);

  const shadeForCurrent = useCallback((dir: 'above' | 'below' | 'between') => {
    if (!desmosRef.current) return;
    const src = (equations[selectedEq]?.trim() || graphInput.trim());
    if (!src) return;
    let latex: string;
    if (src.includes('=')) {
      if (dir === 'above') latex = src.replace('=', '>');
      else if (dir === 'below') latex = src.replace('=', '<');
      else {
        if (src.trim().startsWith('y=')) {
          const rhs2 = src.split('=').slice(1).join('=').trim();
          latex = `0 \\le y \\le ${rhs2}`;
        } else {
          latex = src.replace('=', '\\le');
        }
      }
    } else {
      const rhs = src;
      if (dir === 'above') latex = `y > ${rhs}`;
      else if (dir === 'below') latex = `y < ${rhs}`;
      else latex = `0 \\le y \\le ${rhs}`;
    }
    const key = dir + '-' + selectedEq;
    const existingId = activeShades[key];
    if (existingId) {
      try { desmosRef.current.removeExpression({ id: existingId }); } catch {}
      setActiveShades(prev => { const n = { ...prev }; delete n[key]; return n; });
      layerIdsRef.current = layerIdsRef.current.filter(id => id !== existingId);
      return;
    }
    const id = 'shade-' + key + '-' + Date.now();
    try {
      desmosRef.current.setExpression({ id, latex, color: EQ_COLORS[selectedEq] });
      layerIdsRef.current.push(id);
      setActiveShades(prev => ({ ...prev, [key]: id }));
    } catch {}
  }, [graphInput, equations, selectedEq, activeShades]);

  const verifyStep = useCallback(async (index: number) => {
    const step = steps[index];
    if (!step.latex.trim() || index === 0) return;

    setSteps(prev => prev.map((s, i) => i === index ? { ...s, checking: true } : s));

    const prevStep = steps[index - 1].latex;

    try {
      const res = await fetch('/api/math/verify-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prevStep,
          currentStep: step.latex,
          problemContext,
        }),
      });
      const data = await res.json();

      setSteps(prev => prev.map((s, i) =>
        i === index
          ? { ...s, checking: false, verifiedCorrect: data.correct, explanation: data.explanation }
          : s
      ));

      // Update Desmos with the verified step (unless graph is pinned)
      if (data.correct && !graphPinned) {
        updateDesmosGraph(step.latex);
      }
    } catch {
      setSteps(prev => prev.map((s, i) =>
        i === index ? { ...s, checking: false, explanation: 'Verification failed — check your network.' } : s
      ));
    }
  }, [steps, problemContext, updateDesmosGraph, graphPinned, graphInput]);

  const updateStep = (index: number, latex: string) => {
    setSteps(prev => prev.map((s, i) =>
      i === index ? { latex, verifiedCorrect: undefined, explanation: undefined } : s
    ));
    // Live graph preview while typing (unless pinned to manual graph)
    if (!graphPinned && latex.trim()) updateDesmosGraph(latex);
  };

  const addStep = () => {
    setSteps(prev => [...prev, { latex: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 0, height: '100%', background: '#0f1117', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Left: Steps */}
      <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Problem context */}
        <div>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Problem Statement</label>
          <textarea
            value={problemContext}
            onChange={e => setProblemContext(e.target.value)}
            placeholder="Describe the problem (e.g. 'Solve for x: 2x + 4 = 12')"
            style={{
              width: '100%', marginTop: 6, padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13, resize: 'vertical', minHeight: 60,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
          Solution Steps
        </div>

        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              borderRadius: 10,
              border: `1.5px solid ${
                step.verifiedCorrect === true ? 'rgba(52,211,153,0.5)' :
                step.verifiedCorrect === false ? 'rgba(248,113,113,0.5)' :
                'rgba(255,255,255,0.1)'
              }`,
              padding: '12px 14px',
              background: step.verifiedCorrect === true ? 'rgba(52,211,153,0.05)' :
                step.verifiedCorrect === false ? 'rgba(248,113,113,0.05)' :
                'rgba(255,255,255,0.03)',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Step {index + 1} {index === 0 ? '(given)' : ''}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {index > 0 && (
                  <button
                    onClick={() => verifyStep(index)}
                    disabled={step.checking || !step.latex.trim()}
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: step.checking ? 'rgba(124,92,255,0.15)' : 'rgba(124,92,255,0.25)',
                      color: '#c4b5fd', fontSize: 11,
                    }}
                  >
                    {step.checking ? 'Checking...' : '✓ Check Step'}
                  </button>
                )}
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(index)}
                    style={{
                      padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 11,
                    }}
                  >✕</button>
                )}
              </div>
            </div>

            <input
              type="text"
              value={step.latex}
              onChange={e => updateStep(index, e.target.value)}
              placeholder="Enter LaTeX (e.g. 2x + 4 = 12  or  y = x^2 + 2x)"
              autoFocus={index === 0}
              style={{
                width: '100%', padding: '8px 10px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, color: '#e2e8f0', fontSize: 14,
                fontFamily: 'monospace', outline: 'none',
              }}
            />
            {mathLiveLoaded && (
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>MathLive ready — KaTeX preview below</div>
            )}

            {/* KaTeX render */}
            {kateXLoaded && step.latex && (
              <div
                style={{ marginTop: 8, padding: '6px 0', overflowX: 'auto' }}
                dangerouslySetInnerHTML={{ __html: renderKaTeX(step.latex) }}
              />
            )}

            {/* Error explanation from LLM */}
            {step.verifiedCorrect === false && step.explanation && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 6,
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                fontSize: 12, color: '#fca5a5', lineHeight: 1.6,
              }}>
                ⚠️ {step.explanation}
              </div>
            )}

            {step.verifiedCorrect === true && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#34d399' }}>✓ Algebraically correct</div>
            )}
          </div>
        ))}

        <button
          onClick={addStep}
          style={{
            padding: '8px 0', borderRadius: 8, border: '1.5px dashed rgba(255,255,255,0.15)',
            background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
          }}
        >
          + Add Step
        </button>
      </div>

      {/* Right: Desmos graph + freeform box */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Graph</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {graphPinned && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: 4 }}>pinned</span>}
              <button onClick={() => setZoomOpen(true)} title="Open graph in zoom (Esc to close)" style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(124,92,255,0.3)', background: 'rgba(124,92,255,0.12)', color: '#c4b5fd', fontSize: 10, cursor: 'pointer' }}>⛶ Zoom</button>
            </div>
          </div>
          {[0,1,2].map(i => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: EQ_COLORS[i], flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: selectedEq === i ? '#fff' : '#64748b', minWidth: 22 }}>Eq{i+1}</span>
              <input
                value={equations[i]}
                onChange={e => { setGraphPinned(true); updateEquation(i, e.target.value); }}
                onFocus={() => setSelectedEq(i)}
                placeholder={i===0 ? "y=x^2+2x" : i===1 ? "y=2x+1 (for intersection)" : "x^2+y^2=25"}
                style={{
                  flex: 1, padding: '6px 8px', background: selectedEq === i ? 'rgba(124,92,255,0.10)' : 'rgba(255,255,255,0.07)',
                  border: selectedEq === i ? `1px solid ${EQ_COLORS[i]}` : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button onClick={() => updateEquation(i, '')} style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: 10, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Selected: <b style={{ color: EQ_COLORS[selectedEq] }}>Eq{selectedEq+1}</b> — actions below target it</span>
            <button onClick={() => setGraphPinned(p=>!p)} title={graphPinned ? 'Unpin — steps won\'t overwrite Eq1' : 'Pinned — steps won\'t overwrite Eq1'} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: graphPinned ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)', color: graphPinned ? '#f59e0b' : '#94a3b8', fontSize: 10, cursor: 'pointer' }}>{graphPinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => { setEquations(['','','']); setIntersections([]); setShowRoots({}); clearLayers(); ['eq1','eq2','eq3','main'].forEach(id=>{try{desmosRef.current?.removeExpression({id});}catch{}}); for(let i=0;i<6;i++) try{desmosRef.current?.removeExpression({id:`inter-${i}`});}catch{} for(let s=0;s<3;s++) for(let k=0;k<6;k++) try{desmosRef.current?.removeExpression({id:`root-${s}-${k}`});}catch{} }} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.10)', color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}>Clear all</button>
          </div>
          <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>
            3 max — Desmos shows intersections visually. Use <code style={{ color: '#94a3b8' }}>Find Intersections</code> to mark them.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'x²+2x', expr: 'y=x^2+2x' },
              { label: 'sin(x)', expr: 'y=\\sin(x)' },
              { label: 'Circle', expr: 'x^2+y^2=25' },
            ].map(b => (
              <button
                key={b.label}
                onClick={() => { setGraphPinned(true); updateEquation(selectedEq, b.expr); }}
                title={`Add to Eq${selectedEq+1}`}
                style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: `${EQ_COLORS[selectedEq]}15`, color: EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}
              >{b.label} → Eq{selectedEq+1}</button>
            ))}
            <button onClick={findIntersections} style={{ padding: '3px 8px', borderRadius: 20, border: '1px solid #f59e0b', background: intersections.length > 0 ? '#f59e0b' : 'rgba(245,158,11,0.15)', color: intersections.length > 0 ? '#fff' : '#fbbf24', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>{intersections.length > 0 ? '✓ Intersections' : 'Find Intersections'}</button>
          </div>
          {intersections.length > 0 && (
            <div style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '6px 8px' }}>
              {intersections.map((p,i) => <div key={i}>Eq{p.eqA+1}∩Eq{p.eqB+1}: ({p.x.toFixed(2)}, {p.y.toFixed(2)})</div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>Shade Eq{selectedEq+1}:</span>
            <button onClick={() => shadeForCurrent('above')} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['above-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['above-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['above-'+selectedEq] ? '✓ Above' : 'Above'}</button>
            <button onClick={() => shadeForCurrent('below')} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['below-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['below-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['below-'+selectedEq] ? '✓ Below' : 'Below'}</button>
            <button onClick={() => shadeForCurrent('between')} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['between-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['between-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['between-'+selectedEq] ? '✓ 0↔curve' : '0↔curve'}</button>
            <button onClick={clearLayers} style={{ padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.10)', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>Clear shade</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>Eq{selectedEq+1} actions:</span>
            <button onClick={toggleDerivative} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['deriv-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['deriv-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['deriv-'+selectedEq] ? '✓ Deriv' : 'Derivative'}</button>
            <button onClick={toggleTangent} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['tang-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['tang-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['tang-'+selectedEq] ? '✓ Tangent' : 'Tangent x₀'}</button>
            <button onClick={toggleRoots} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: showRoots[selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: showRoots[selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{showRoots[selectedEq] ? '✓ Roots' : 'Roots'}</button>
            <button onClick={toggleYIntercept} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['yint-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['yint-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['yint-'+selectedEq] ? '✓ Y-int' : 'Y-int'}</button>
            <button onClick={toggleExtrema} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['ext-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['ext-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['ext-'+selectedEq] ? '✓ Extrema' : 'Extrema'}</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>More:</span>
            <button onClick={toggleIntegral} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['int-'+selectedEq] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['int-'+selectedEq] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['int-'+selectedEq] ? '✓ Integral' : 'Integral a→b'}</button>
            <button onClick={toggleAreaBetween} style={{ padding: '3px 8px', borderRadius: 20, border: `1px solid ${EQ_COLORS[selectedEq]}`, background: activeShades['area-between'] ? EQ_COLORS[selectedEq] : `${EQ_COLORS[selectedEq]}20`, color: activeShades['area-between'] ? '#fff' : EQ_COLORS[selectedEq], fontSize: 11, cursor: 'pointer' }}>{activeShades['area-between'] ? '✓ Area↔' : 'Area between'}</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 220 }}>
          {desmosLoaded ? (
            <div ref={desmosContainerRef} style={{ width: '100%', height: '100%' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
              Loading Desmos...
            </div>
          )}
        </div>
      </div>
      {zoomOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setZoomOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Graph — Zoom (Esc or click outside to close)</span>
            <button onClick={() => setZoomOpen(false)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#7C5CFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Close</button>
          </div>
          <div ref={zoomContainerRef} style={{ flex: 1, background: '#fff', borderRadius: 12, overflow: 'hidden', minHeight: 400 }} />
        </div>
      )}
    </div>
  );
}
