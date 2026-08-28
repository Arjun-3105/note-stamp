'use client';
import { useEffect, useState, useCallback } from 'react';

interface Card {
  id?: string;
  front?: string;
  back?: string;
  title: string;
  explanation: string;
  example: string;
  checkpoint: string;
  timestamp?: number;
  confidenceScore?: number;
  chunkLabel?: string;
  pageStart?: number;
}

export function FlashcardsView({ sourceId }: { sourceId: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [topic, setTopic] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [scope, setScope] = useState<'entire' | 'chunk'>('entire');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [chunksCount, setChunksCount] = useState<number | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const r = await fetch(`/api/flashcards?sourceId=${sourceId}`);
      const d = await r.json();
      if (d.cards?.length) {
        setCards(d.cards);
        setTopic(d.topic || '');
        setIdx(0);
      }
    } catch {}
  }, [sourceId]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  // Try to fetch chunks count for chunk selector
  useEffect(() => {
    fetch(`/api/sources/${sourceId}/content`).then(r=>r.json()).then(d=>{
      if (d.totalChunks) setChunksCount(d.totalChunks);
      else if (Array.isArray(d.chunks)) setChunksCount(d.chunks.length);
    }).catch(()=>{});
  }, [sourceId]);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          scope: scope === 'chunk' ? 'chunk' : 'entire',
          chunkIndex: scope === 'chunk' ? chunkIndex : undefined,
          includeNotes,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setCards(d.cards || []);
      setTopic(d.topic || '');
      setIdx(0); setFlipped(false); setKnown(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  };

  const current = cards[idx];
  const front = current?.front || current?.checkpoint || current?.title || '';
  const back = current?.back || current?.explanation || '';
  const progressPct = cards.length ? Math.round((known.size / cards.length) * 100) : 0;

  const mark = (know: boolean) => {
    if (!current) return;
    if (know) setKnown(s => new Set(s).add(idx));
    // FSRS-like: move to next, flip back
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.min(i + 1, cards.length - 1)), 180);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <span className="w-6 h-6 rounded-full border-2 border-[#252B36] border-t-[#7C5CFF] animate-spin" />
      <p className="text-sm text-[#A2A8B5]">Generating Anki cards from {scope === 'chunk' ? `chunk ${chunkIndex}` : 'entire source + notes'}…</p>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      {/* Controls */}
      <div className="bg-[#151922] rounded-[16px] border border-[#252B36] p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[#0F1115] border border-[#252B36]">
          <button onClick={() => setScope('entire')} className={`px-3 py-1 text-xs font-bold rounded-[8px] ${scope === 'entire' ? 'bg-[#7C5CFF] text-white' : 'text-[#A2A8B5]'}`}>Entire source</button>
          <button onClick={() => setScope('chunk')} className={`px-3 py-1 text-xs font-bold rounded-[8px] ${scope === 'chunk' ? 'bg-[#7C5CFF] text-white' : 'text-[#A2A8B5]'}`}>Single chunk</button>
        </div>
        {scope === 'chunk' && (
          <input type="number" min={0} max={chunksCount ? chunksCount-1 : 99} value={chunkIndex} onChange={e=>setChunkIndex(Math.max(0, parseInt(e.target.value)||0))} className="w-20 px-2 py-1 rounded bg-[#0F1115] border border-[#252B36] text-xs text-white" placeholder="Idx" />
        )}
        <label className="flex items-center gap-1.5 text-xs text-[#A2A8B5] cursor-pointer">
          <input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)} /> Include my notes
        </label>
        <button onClick={generate} className="ml-auto px-4 py-2 rounded-[10px] bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6b4fe0]">Generate</button>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded p-2">{error}</div>}

      {cards.length === 0 ? (
        <div className="bg-[#151922] rounded-[20px] border border-[#252B36] p-10 text-center">
          <div className="text-2xl mb-2">🃏</div>
          <p className="text-sm font-bold text-white mb-1">{topic || 'No flashcards yet'}</p>
          <p className="text-xs text-[#A2A8B5] mb-4">Cards are Anki-style: front = question, back = answer — built from {scope==='chunk' ? 'selected chunk' : 'all chunks/pages'} + transcript (YT) + your notes.</p>
          <button onClick={generate} className="px-5 py-2 rounded-[12px] bg-[#7C5CFF] text-white text-xs font-bold">Generate Anki Deck</button>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center gap-3 bg-[#151922] rounded-[14px] border border-[#252B36] px-4 py-2.5">
            <div className="flex-1 h-1.5 rounded-full bg-[#0F1115] overflow-hidden"><div className="h-full bg-[#7C5CFF] transition-all" style={{ width: `${progressPct}%` }} /></div>
            <span className="text-[11px] font-bold text-[#A2A8B5]">{idx+1}/{cards.length} • {known.size} known • {progressPct}%</span>
            <span className="text-[11px] text-[#7C5CFF] font-semibold truncate max-w-[150px]">{topic}</span>
          </div>

          {/* Anki card */}
          <div
            onClick={() => setFlipped(f=>!f)}
            className="relative bg-[#151922] rounded-[20px] border border-[#252B36] p-6 min-h-[240px] cursor-pointer select-none shadow-sm overflow-hidden group"
            style={{ perspective: 1000 }}
          >
            <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full bg-[#0F1115] border border-[#252B36] text-[#A2A8B5]">
              {(current?.chunkLabel || (current?.pageStart ? `Page ${current.pageStart}` : 'Source'))} {current?.timestamp ? `@ ${current.timestamp}s` : ''}
            </div>
            {!flipped ? (
              <div className="pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7C5CFF] mb-2">Front — Prompt</p>
                <p className="text-[18px] font-semibold text-white leading-snug">{front}</p>
                {current?.title && current.title !== front && <p className="text-xs text-[#A2A8B5] mt-3">{current.title}</p>}
                <p className="text-[10px] text-[#555] mt-6">Click to reveal →</p>
              </div>
            ) : (
              <div className="pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#10b981] mb-2">Back — Answer</p>
                <p className="text-[15px] text-[#E8E8EA] leading-relaxed">{back}</p>
                {current?.example && <div className="mt-3 p-2.5 rounded-[10px] bg-[#0F1115] border border-[#252B36] font-mono text-xs text-[#A2A8B5] whitespace-pre-wrap">{current.example}</div>}
                {current?.explanation && current.explanation !== back && <p className="text-xs text-[#A2A8B5] mt-2">{current.explanation}</p>}
                {typeof current?.confidenceScore === 'number' && <p className="text-[10px] text-[#555] mt-2">Confidence {(current.confidenceScore as number)}%</p>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setFlipped(false); setIdx(i=>Math.max(0,i-1)); }} disabled={idx===0} className="px-4 py-2 rounded-[10px] bg-[#151922] border border-[#252B36] text-xs font-bold text-[#A2A8B5] disabled:opacity-40">← Prev</button>
            <button onClick={() => setFlipped(f=>!f)} className="flex-1 py-2.5 rounded-[12px] bg-[#0F1115] border border-[#252B36] text-xs font-bold text-white">{flipped ? 'Show Front' : 'Reveal Answer'}</button>
            <div className="flex gap-1.5">
              <button onClick={() => mark(false)} className="px-4 py-2 rounded-[10px] bg-[#2a1a1a] border border-red-900/40 text-xs font-bold text-red-400">Again</button>
              <button onClick={() => mark(true)} className="px-4 py-2 rounded-[10px] bg-[#10b981] text-xs font-bold text-white">Known ✓</button>
            </div>
            <button onClick={() => { setFlipped(false); setIdx(i=>Math.min(cards.length-1,i+1)); }} disabled={idx===cards.length-1} className="px-4 py-2 rounded-[10px] bg-[#151922] border border-[#252B36] text-xs font-bold text-[#A2A8B5] disabled:opacity-40">Next →</button>
          </div>

          {/* List */}
          <div className="bg-[#151922] rounded-[16px] border border-[#252B36] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#A2A8B5] mb-2">Deck (click to jump)</p>
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {cards.map((c,i)=>(
                <div key={i} onClick={()=>{setIdx(i); setFlipped(false);}} className={`px-3 py-1.5 rounded-[8px] cursor-pointer flex items-center gap-2 text-xs ${i===idx ? 'bg-[#7C5CFF]/15 text-white border border-[#7C5CFF]/30' : 'text-[#A2A8B5] hover:bg-[#0F1115]'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${known.has(i) ? 'bg-[#10b981] text-white' : 'bg-[#252B36] text-[#A2A8B5]'}`}>{i+1}</span>
                  <span className="truncate flex-1">{c.front || c.title}</span>
                  {typeof c.confidenceScore==='number' && <span className="text-[10px] text-[#555]">{c.confidenceScore}%</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
