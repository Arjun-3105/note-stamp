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
      expressionsCollapsed: true,
      keypad: false,
      settingsMenu: false,
      zoomButtons: true,
    });
  }, [desmosLoaded]);

  const renderKaTeX = (latex: string): string => {
    try {
      return (window as any).katex.renderToString(latex, { throwOnError: false, displayMode: true });
    } catch {
      return `<code>${latex}</code>`;
    }
  };

  const updateDesmosGraph = useCallback((latex: string) => {
    if (!desmosRef.current || !latex) return;
    try {
      desmosRef.current.setExpression({ id: 'main', latex });
    } catch {
      // ignore invalid expressions
    }
  }, []);

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

      // Update Desmos with the verified step
      if (data.correct) {
        updateDesmosGraph(step.latex);
      }
    } catch {
      setSteps(prev => prev.map((s, i) =>
        i === index ? { ...s, checking: false, explanation: 'Verification failed — check your network.' } : s
      ));
    }
  }, [steps, problemContext, updateDesmosGraph]);

  const updateStep = (index: number, latex: string) => {
    setSteps(prev => prev.map((s, i) =>
      i === index ? { latex, verifiedCorrect: undefined, explanation: undefined } : s
    ));
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

            {/* LaTeX input — uses a simple textarea with MathLive web component when ready */}
            {mathLiveLoaded ? (
              <math-field
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#e2e8f0',
                  fontSize: 16,
                  display: 'block',
                }}
                onInput={(e: any) => updateStep(index, e.target.value)}
              />
            ) : (
              <input
                type="text"
                value={step.latex}
                onChange={e => updateStep(index, e.target.value)}
                placeholder="Enter LaTeX (e.g. 2x + 4 = 12)"
                style={{
                  width: '100%', padding: '6px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: '#e2e8f0', fontSize: 14,
                  fontFamily: 'monospace',
                }}
              />
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

      {/* Right: Desmos graph */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Graph
        </div>
        {desmosLoaded ? (
          <div ref={desmosContainerRef} style={{ flex: 1 }} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
            Loading Desmos...
          </div>
        )}
      </div>
    </div>
  );
}
