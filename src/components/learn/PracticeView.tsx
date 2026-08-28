'use client';
import { useState } from 'react';

type PracticeQ = {
  question: string; type: string; options?: string[]; correctIndex?: number; expectedAnswer: string;
  difficulty: string; concept: string; chunkLabel: string;
  steps: Array<{title:string; instruction:string; hint:string}>;
  markingRubric: Array<{criterion:string; marks:number; whatToCheck:string}>;
  hints: string[]; workedSolution: string; commonMistakes: string[]; nextSuggestion: string;
};

export function PracticeView({ sourceId }: { sourceId: string }) {
  const [tab, setTab] = useState<'practice'|'prereq'>('practice');
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex gap-1 p-1 rounded-[12px] bg-[#151922] border border-[#252B36] w-fit">
        <button onClick={()=>setTab('practice')} className={`px-4 py-1.5 rounded-[10px] text-xs font-bold ${tab==='practice' ? 'bg-[#7C5CFF] text-white' : 'text-[#A2A8B5]'}`}>Practice</button>
        <button onClick={()=>setTab('prereq')} className={`px-4 py-1.5 rounded-[10px] text-xs font-bold ${tab==='prereq' ? 'bg-[#f59e0b] text-white' : 'text-[#A2A8B5]'}`}>Prerequisite Check</button>
      </div>
      {tab==='practice' ? <PracticeTab sourceId={sourceId}/> : <PrereqTab sourceId={sourceId}/>}
    </div>
  );
}

function PracticeTab({ sourceId }: { sourceId: string }) {
  const [mode, setMode] = useState<'current'|'covered'|'entire'>('covered');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [completed, setCompleted] = useState('0,1,2');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState<PracticeQ|null>(null);
  const [answer, setAnswer] = useState('');
  const [hintsShown, setHintsShown] = useState(0);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verify, setVerify] = useState<any>(null);
  const [error, setError] = useState<string|null>(null);

  const generate = async () => {
    setLoading(true); setError(null); setVerify(null); setHintsShown(0);
    try {
      const completedIdx = mode==='covered' ? completed.split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n)) : undefined;
      const r = await fetch('/api/practice/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sourceId, mode, chunkIndex: mode==='current'?chunkIndex:undefined, completedChunkIndexes: completedIdx, difficulty })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||'Failed');
      setQ(d.practice); setAnswer('');
    } catch(e){ setError(e instanceof Error? e.message:'Failed'); } finally{ setLoading(false); }
  };

  const submit = async () => {
    if (!q) return;
    setVerifyLoading(true); setError(null);
    try {
      // For MCQ, answer is index string; for others, free text
      let userAnswer = answer;
      if (q.type==='mcq' && q.options) {
        const idx = parseInt(answer);
        if (!isNaN(idx)) userAnswer = q.options[idx] ?? answer;
      }
      const r = await fetch('/api/practice/verify', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sourceId, question: q.question, expectedAnswer: q.expectedAnswer, userAnswer, markingRubric: q.markingRubric, steps: q.steps, type: q.type })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||'Verify failed');
      setVerify(d);
    } catch(e){ setError(e instanceof Error? e.message:'Verify failed'); } finally{ setVerifyLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#151922] rounded-[16px] border border-[#252B36] p-4 space-y-3">
        <p className="text-sm font-bold text-white">Practice — single question, step-marks, suggestive teaching</p>
        <p className="text-xs text-[#A2A8B5]">Choose scope: <b>current chunk</b> (focus) or <b>covered till now</b> (cumulative) — like maths simulator with scaffolded steps.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={mode} onChange={e=>setMode(e.target.value as any)} className="px-2 py-1.5 rounded bg-[#0F1115] border border-[#252B36] text-xs text-white">
            <option value="covered">Covered till now</option>
            <option value="current">Current chunk only</option>
            <option value="entire">Entire source</option>
          </select>
          {mode==='current' && <input type="number" min={0} value={chunkIndex} onChange={e=>setChunkIndex(parseInt(e.target.value)||0)} className="w-16 px-2 py-1 rounded bg-[#0F1115] border border-[#252B36] text-xs text-white" />}
          {mode==='covered' && <input value={completed} onChange={e=>setCompleted(e.target.value)} placeholder="0,1,2" className="w-24 px-2 py-1 rounded bg-[#0F1115] border border-[#252B36] text-xs text-white" />}
          <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="px-2 py-1.5 rounded bg-[#0F1115] border border-[#252B36] text-xs text-white">
            <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
          </select>
          <button onClick={generate} disabled={loading} className="ml-auto px-4 py-1.5 rounded-[10px] bg-[#7C5CFF] text-white text-xs font-bold disabled:opacity-40">{loading?'Generating…':'Generate Question'}</button>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded p-2">{error}</div>}

      {q && (
        <div className="bg-[#151922] rounded-[20px] border border-[#252B36] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#7C5CFF]">{q.concept} · {q.difficulty} · {q.type}</span>
            <span className="text-[10px] text-[#555]">{q.chunkLabel}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{q.question}</p>

          {/* Steps scaffold */}
          <div className="bg-[#0F1115] rounded-[12px] border border-[#252B36] p-3">
            <p className="text-[11px] font-bold text-[#A2A8B5] mb-2">Steps (suggestive teaching scaffold)</p>
            <div className="space-y-2">
              {q.steps?.map((s,i)=>(
                <div key={i} className="flex gap-2 text-xs">
                  <span className="w-6 h-6 rounded-full bg-[#252B36] text-[#A2A8B5] flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span>
                  <div><p className="font-semibold text-white">{s.title}</p><p className="text-[#A2A8B5]">{s.instruction}</p><p className="text-[11px] text-[#7C5CFF] mt-0.5">Hint: {s.hint}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* Options or input */}
          {q.type==='mcq' && q.options ? (
            <div className="space-y-1.5">
              {q.options.map((opt,i)=>(
                <label key={i} className={`flex items-center gap-2 px-3 py-2 rounded-[10px] border cursor-pointer text-xs ${answer===String(i)?'bg-[#7C5CFF] text-white border-[#7C5CFF]':'bg-[#0F1115] text-[#C5C9D3] border-[#252B36]'}`}>
                  <input type="radio" name="practice-mcq" value={i} checked={answer===String(i)} onChange={e=>setAnswer(e.target.value)} className="accent-[#7C5CFF]"/> {String.fromCharCode(65+i)}. {opt}
                </label>
              ))}
            </div>
          ) : (
            <textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={q.type==='code' ? 'Write code / answer here…' : 'Type your answer…'} rows={q.type==='code'?6:3} className="w-full rounded-[12px] bg-[#0F1115] border border-[#252B36] p-3 text-xs text-white outline-none"/>
          )}

          {/* Marking rubric */}
          <div className="bg-[#0F1115] rounded-[12px] border border-[#252B36] p-3">
            <p className="text-[11px] font-bold text-[#A2A8B5] mb-1">Marking rubric — {q.markingRubric?.reduce((s,r)=>s+r.marks,0)||10} marks</p>
            <ul className="space-y-1 text-[11px] text-[#A2A8B5]">
              {q.markingRubric?.map((r,i)=><li key={i} className="flex justify-between"><span>• {r.criterion}</span><span className="font-bold text-white">{r.marks} marks — {r.whatToCheck}</span></li>)}
            </ul>
          </div>

          {/* Hints */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-bold text-[#A2A8B5]">Hints:</span>
            {q.hints?.map((h,i)=>(
              <button key={i} onClick={()=>setHintsShown(s=>Math.max(s,i+1))} className={`px-2 py-1 rounded-full text-[11px] border ${hintsShown>i? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30':'bg-[#0F1115] text-[#A2A8B5] border-[#252B36]'}`}>{hintsShown>i? h : `Reveal hint ${i+1}`}</button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={submit} disabled={!answer || verifyLoading} className="flex-1 py-2.5 rounded-[12px] bg-[#10b981] text-white text-xs font-bold disabled:opacity-40">{verifyLoading?'Checking…':'Submit & Check (step-marks)'}</button>
            <button onClick={generate} className="px-4 py-2 rounded-[10px] bg-[#0F1115] border border-[#252B36] text-xs text-[#A2A8B5]">Next Question →</button>
          </div>

          {verify && (
            <div className={`rounded-[16px] border p-4 ${verify.percentage>=70?'bg-[#0f1f14] border-[#10b981]/30':'bg-[#1c1510] border-[#f59e0b]/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-white">Score {verify.totalAwarded}/{verify.totalMax} ({verify.percentage}%) {verify.isCorrect?'✓':'↻'}</p>
                <span className="text-[11px] px-2 py-1 rounded-full bg-[#0F1115] border border-[#252B36] text-[#A2A8B5]">{verify.weakConcept}</span>
              </div>
              <div className="space-y-1 mb-3">
                {verify.criterionResults?.map((c:any,i:number)=>(
                  <div key={i} className="flex justify-between text-[11px]"><span className="text-[#A2A8B5]">{c.criterion}</span><span className={c.awarded===c.max?'text-[#10b981]':'text-[#f59e0b]'}>{c.awarded}/{c.max} — {c.feedback}</span></div>
                ))}
              </div>
              <p className="text-xs text-[#C5C9D3] mb-1">{verify.overallFeedback}</p>
              <div className="p-2.5 rounded-[10px] bg-[#151922] border border-[#252B36]">
                <p className="text-[11px] font-bold text-[#7C5CFF] mb-1">Suggestive Teaching</p>
                <p className="text-xs text-[#A2A8B5]">{verify.suggestiveTeaching}</p>
                <p className="text-[11px] text-[#555] mt-1">Next: {verify.nextStep}</p>
              </div>
              <details className="mt-2">
                <summary className="text-[11px] text-[#A2A8B5] cursor-pointer">Worked solution</summary>
                <p className="text-xs text-[#C5C9D3] mt-1 whitespace-pre-wrap">{q.workedSolution}</p>
                <p className="text-[11px] text-[#f59e0b] mt-2">Common mistakes: {q.commonMistakes?.join(' • ')}</p>
                <p className="text-[11px] text-[#10b981] mt-1">Next suggestion: {q.nextSuggestion}</p>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrereqTab({ sourceId }: { sourceId: string }) {
  const [qs, setQs] = useState<Array<{id:string; question:string; options:string[]; correctIndex:number; explanation:string; concept:string; difficulty:string}>>([]);
  const [topic, setTopic] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string|null>(null);
  const [phase, setPhase] = useState<'idle'|'quiz'|'analyzing'|'result'>('idle');

  const generate = async () => {
    setLoading(true); setError(null); setAnalysis(null);
    try {
      const r = await fetch('/api/practice/prereq', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sourceId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||'Failed');
      setQs(d.questions||[]); setTopic(d.prereqTopic||''); setAnswers({}); setPhase('quiz');
    } catch(e){ setError(e instanceof Error? e.message:'Failed'); } finally{ setLoading(false); }
  };

  const submit = async () => {
    setPhase('analyzing'); setError(null);
    try {
      const ansArr = qs.map(q=> answers[q.id] ?? -1);
      const r = await fetch('/api/practice/prereq', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sourceId, mode:'submit', answers: ansArr, questions: qs }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||'Failed');
      setAnalysis(d.analysis); setPhase('result');
    } catch(e){ setError(e instanceof Error? e.message:'Failed'); setPhase('quiz'); }
  };

  const answered = Object.keys(answers).length;
  const pct = qs.length? Math.round((Object.values(answers).filter((v,i)=> v===qs[i]?.correctIndex).length/qs.length)*100):0;

  if (phase==='idle') return (
    <div className="bg-[#151922] rounded-[20px] border border-[#252B36] p-8 text-center">
      <div className="text-xl mb-2">🧭</div>
      <h3 className="text-sm font-bold text-white mb-1">Prerequisite Check — Quiz Only</h3>
      <p className="text-xs text-[#A2A8B5] leading-relaxed mb-4">Assesses your <b>current understanding of prerequisites</b> before you start. Quiz-only (6 questions). Based on results we suggest what topics to focus on next.</p>
      <button onClick={generate} disabled={loading} className="px-6 py-2.5 rounded-[12px] bg-[#f59e0b] text-white text-sm font-bold disabled:opacity-40">{loading?'Generating…':'Start Prereq Quiz'}</button>
      {error && <div className="text-xs text-red-400 mt-3">{error}</div>}
    </div>
  );

  if (phase==='analyzing') return (
    <div className="flex flex-col items-center justify-center py-16 gap-3"><span className="w-6 h-6 rounded-full border-2 border-[#252B36] border-t-[#f59e0b] animate-spin"/><p className="text-sm text-[#A2A8B5]">Analyzing gaps…</p></div>
  );

  if (phase==='result' && analysis) return (
    <div className="space-y-4">
      <div className="bg-[#1e1a0f] rounded-[16px] border border-[#f59e0b]/30 p-4">
        <p className="text-sm font-bold text-white mb-1">Diagnostic: {analysis.level} · Score {analysis.score ?? pct}%</p>
        <p className="text-xs text-[#C5C9D3]">{analysis.overall}</p>
        <p className="text-xs font-bold text-[#f59e0b] mt-2">Focus next: {analysis.nextFocus}</p>
      </div>
      <div className="bg-[#151922] rounded-[16px] border border-[#252B36] p-4">
        <p className="text-xs font-bold text-[#f59e0b] mb-2">Weak topics to focus</p>
        <div className="space-y-2">
          {(analysis.weakTopics||[]).map((w:any,i:number)=>(
            <div key={i} className="p-2.5 rounded-[10px] bg-[#0F1115] border border-[#252B36]">
              <p className="text-xs font-bold text-white">{w.concept}</p>
              <p className="text-[11px] text-[#A2A8B5]">{w.why}</p>
              <p className="text-[11px] text-[#10b981] mt-1">→ {w.action}</p>
            </div>
          ))}
          {(analysis.weakTopics||[]).length===0 && <p className="text-xs text-[#10b981]">No weak topics — you are ready! ✓</p>}
        </div>
        {(analysis.strongTopics||[]).length>0 && <p className="text-[11px] text-[#A2A8B5] mt-3">Strong: {(analysis.strongTopics||[]).join(', ')}</p>}
        {(analysis.studyPlan||[]).length>0 && <div className="mt-3"><p className="text-[11px] font-bold text-white mb-1">Study plan</p><ol className="list-decimal pl-4 text-[11px] text-[#A2A8B5] space-y-0.5">{analysis.studyPlan.map((s:string,i:number)=><li key={i}>{s}</li>)}</ol></div>}
        <button onClick={()=>{setPhase('idle'); setAnalysis(null);}} className="mt-4 px-4 py-2 rounded-[10px] bg-[#0F1115] border border-[#252B36] text-xs text-[#A2A8B5]">Retake</button>
      </div>
    </div>
  );

  // quiz phase
  return (
    <div className="space-y-3">
      <div className="bg-[#151922] rounded-[16px] border border-[#252B36] p-3 flex items-center gap-2">
        <span className="text-xs font-bold text-white">{topic || 'Prerequisites'} · {answered}/{qs.length}</span>
        <span className="text-[11px] text-[#A2A8B5]">Quiz only · diagnostic</span>
        <span className="ml-auto text-[11px] font-bold text-[#f59e0b]">{pct}% so far</span>
      </div>
      {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded p-2">{error}</div>}
      <div className="space-y-3">
        {qs.map((q,i)=>(
          <div key={q.id} className="bg-[#151922] rounded-[16px] border border-[#252B36] p-4">
            <p className="text-[10px] font-bold text-[#f59e0b] mb-1">{i+1}. {q.concept} · {q.difficulty}</p>
            <p className="text-xs font-semibold text-white mb-2">{q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt,j)=>(
                <label key={j} className={`flex items-center gap-2 px-3 py-2 rounded-[10px] border cursor-pointer text-xs ${answers[q.id]===j? 'bg-[#f59e0b] text-white border-[#f59e0b]':'bg-[#0F1115] text-[#C5C9D3] border-[#252B36]'}`}>
                  <input type="radio" name={`pre-${q.id}`} checked={answers[q.id]===j} onChange={()=>setAnswers(a=>({...a, [q.id]: j}))}/> {String.fromCharCode(65+j)}. {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={Object.keys(answers).length < qs.length} className="flex-1 py-2.5 rounded-[12px] bg-[#f59e0b] text-white text-xs font-bold disabled:opacity-40">Submit Prereq Quiz → Get Focus Plan</button>
        <button onClick={()=>setPhase('idle')} className="px-4 py-2 rounded-[10px] bg-[#0F1115] border border-[#252B36] text-xs text-[#A2A8B5]">Cancel</button>
      </div>
      <p className="text-[10px] text-center text-[#555]">This is quiz-only; we suggest what topics to focus on next based on your gaps.</p>
    </div>
  );
}
