'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { TraceVisualizer } from './TraceVisualizer';
import type { TraceFrame, TestResult } from '@/lib/db/sandbox';

interface CodeSandboxProps {
  sourceId?: string;
  /** Optional starter code to pre-fill the editor */
  starterCode?: string;
}

// Python tracer code injected into every submission.
// This uses sys.settrace to capture per-line variable state.
const TRACER_PREAMBLE = `
import sys, json, copy, traceback as _tb

_TRACE_FRAMES = []
_MAX_FRAMES = 200

def _trace_calls(frame, event, arg):
    if event not in ('call', 'return', 'line', 'exception'):
        return _trace_calls
    if len(_TRACE_FRAMES) >= _MAX_FRAMES:
        return None
    local_vars = {}
    for k, v in frame.f_locals.items():
        if k.startswith('_'):
            continue
        try:
            local_vars[k] = repr(v)[:120]
        except:
            local_vars[k] = '<error>'
    stack = []
    f = frame
    while f is not None:
        stack.append(f.f_code.co_name)
        f = f.f_back
    _TRACE_FRAMES.append({
        'line': frame.f_lineno,
        'event': event,
        'variables': local_vars,
        'callStack': stack[:6],
        'returnValue': repr(arg)[:80] if event == 'return' else None,
    })
    return _trace_calls

sys.settrace(_trace_calls)
`;

const TRACER_SUFFIX = `
sys.settrace(None)
print("__TRACE__" + json.dumps(_TRACE_FRAMES))
`;

const STARTER = `# Write Python code below
# The tracer captures variable state at each step

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(f"factorial(5) = {result}")
`;

export function CodeSandbox({ sourceId, starterCode }: CodeSandboxProps) {
  const [code, setCode] = useState(starterCode ?? STARTER);
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [testResults] = useState<TestResult[]>([]);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const pyodideRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current || pyodideLoading) return;
    setPyodideLoading(true);
    try {
      // Load Pyodide from CDN
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide'));
        document.head.appendChild(script);
      });

      const py = await (window as any).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
      });
      pyodideRef.current = py;
      setPyodideReady(true);
    } catch (err) {
      setStderr('Failed to load Python runtime: ' + String(err));
    } finally {
      setPyodideLoading(false);
    }
  }, [pyodideLoading]);

  const runCode = useCallback(async () => {
    if (!pyodideRef.current) {
      await loadPyodide();
      if (!pyodideRef.current) return;
    }

    setRunning(true);
    setStdout('');
    setStderr('');
    setFrames([]);
    setFrameIndex(0);

    // Declare py before try so finally block can access it to reset handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const py: any = pyodideRef.current;

    try {
      // Capture stdout
      let capturedOut = '';
      py.setStdout({ batched: (s: string) => { capturedOut += s + '\n'; } });
      py.setStderr({ batched: (s: string) => { setStderr(prev => prev + s + '\n'); } });

      const instrumentedCode = TRACER_PREAMBLE + '\n' + code + '\n' + TRACER_SUFFIX;

      await py.runPythonAsync(instrumentedCode);

      // Parse trace frames from stdout sentinel
      let displayOut = capturedOut;
      let parsedFrames: TraceFrame[] = [];

      const traceMarker = '__TRACE__';
      const markerIdx = capturedOut.indexOf(traceMarker);
      if (markerIdx !== -1) {
        displayOut = capturedOut.slice(0, markerIdx);
        try {
          const rawFrames: TraceFrame[] = JSON.parse(capturedOut.slice(markerIdx + traceMarker.length));
          // TRACER_PREAMBLE shifts user code by ~35 lines; adjust so editor (1..N) matches trace.
          // instrumentedCode = TRACER_PREAMBLE + '\n' + code + '\n' + TRACER_SUFFIX
          const preambleLineCount = TRACER_PREAMBLE.split('\n').length;
          const codeLineCount = code.split('\n').length;
          parsedFrames = rawFrames
            .map(f => ({ ...f, line: (f.line as number) - preambleLineCount }))
            .filter(f => f.line >= 1 && f.line <= codeLineCount);
        } catch {
          // ignore parse error
        }
      }

      setStdout(displayOut || '(no output)');
      setFrames(parsedFrames);

      // Persist trace to server (non-blocking)
      if (parsedFrames.length > 0) {
        fetch('/api/sandbox/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            frames: parsedFrames,
            stdout: displayOut,
            sourceId,
          }),
        }).catch(() => { /* non-fatal */ });
      }
    } catch (err) {
      setStderr(String(err));
    } finally {
      setRunning(false);
      py.setStdout({ batched: () => {} });
      py.setStderr({ batched: () => {} });
    }

  }, [code, loadPyodide, sourceId]);

  // Highlight current trace line in Monaco (syncs with slider Prev/Next)
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    // Clear when no frames
    if (frames.length === 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }
    const line = frames[frameIndex]?.line;
    if (!line) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'traceLineHighlight',
          glyphMarginClassName: 'traceGlyph',
          overviewRuler: { color: '#7C5CFF', position: 4 },
        },
      },
    ]);
    // Keep line in view
    editor.revealLineInCenter(line);
  }, [frameIndex, frames]);

  // Clear decorations when code is edited (avoid stale highlight)
  useEffect(() => {
    if (frames.length === 0 && editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, [code, frames.length]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gridTemplateRows: '1fr 200px',
      gap: 0,
      height: '100%',
      background: '#0f1117',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Editor pane */}
      <div style={{ gridColumn: '1', gridRow: '1', position: 'relative', minHeight: 0 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '8px 14px', background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1,
        }}>
          <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>Python 3</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!pyodideReady && (
              <button
                onClick={loadPyodide}
                disabled={pyodideLoading}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'rgba(124,92,255,0.2)', color: '#c4b5fd', fontSize: 11,
                }}
              >
                {pyodideLoading ? 'Loading Python...' : 'Load Python Runtime'}
              </button>
            )}
            <button
              onClick={runCode}
              disabled={running}
              style={{
                padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: running ? 'rgba(124,92,255,0.2)' : '#7C5CFF',
                color: '#fff', fontSize: 12, fontWeight: 600,
                transition: 'background 0.2s',
              }}
            >
              {running ? '▶ Running...' : '▶ Run'}
            </button>
          </div>
        </div>
        <div style={{ paddingTop: 40, height: '100%' }}>
          <style>{`.traceLineHighlight { background: rgba(124,92,255,0.22) !important; border-left: 3px solid #7C5CFF; } .traceGlyph { background: #7C5CFF; width: 4px !important; margin-left: 3px; }`}</style>
          <Editor
            height="100%"
            defaultLanguage="python"
            value={code}
            onChange={(v) => setCode(v ?? '')}
            theme="vs-dark"
            onMount={(editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco; }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              glyphMargin: true,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              fontFamily: '"Fira Code", monospace',
              fontLigatures: true,
            }}
          />
        </div>
      </div>

      {/* Trace visualizer pane */}
      <div style={{
        gridColumn: '2', gridRow: '1 / 3',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        padding: 14, overflow: 'auto', background: '#0a0d14',
      }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Execution Trace — Frame {frames.length > 0 ? `${frameIndex + 1} / ${frames.length}` : '—'}
        </div>

        {frames.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setFrameIndex(i => Math.max(0, i - 1))}
              disabled={frameIndex === 0}
              style={stepBtnStyle}
            >◀ Prev</button>
            <input
              type="range" min={0} max={frames.length - 1} value={frameIndex}
              onChange={e => setFrameIndex(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#7C5CFF' }}
            />
            <button
              onClick={() => setFrameIndex(i => Math.min(frames.length - 1, i + 1))}
              disabled={frameIndex === frames.length - 1}
              style={stepBtnStyle}
            >Next ▶</button>
          </div>
        )}

        <TraceVisualizer frames={frames} currentFrameIndex={frameIndex} />
      </div>

      {/* Output pane */}
      <div style={{
        gridColumn: '1', gridRow: '2',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '10px 14px', fontFamily: 'monospace', fontSize: 12,
        overflow: 'auto', background: '#0a0d14',
      }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Output
        </div>
        {stderr && (
          <pre style={{ color: '#f87171', margin: '0 0 6px 0', whiteSpace: 'pre-wrap' }}>{stderr}</pre>
        )}
        {stdout && (
          <pre style={{ color: '#86efac', margin: 0, whiteSpace: 'pre-wrap' }}>{stdout}</pre>
        )}
        {!stdout && !stderr && !running && (
          <span style={{ color: '#475569' }}>Press Run to execute your code.</span>
        )}
      </div>
    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
};
