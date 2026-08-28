'use client';

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback, useMemo } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';
import { useProgress } from '@/hooks/useProgress';

export interface SourceViewerProps {
  sourceId?: string;
  workspaceId?: string;
  sourceType: string;
  url?: string;
  title: string;
  checkpoints?: number[];
  onCheckpointReached?: (timestamp: number) => void;
}

export interface SourceViewerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => Promise<number | null>;
  play: () => void;
  pause: () => void;
  goToPage: (page: number) => void;
  goToChunk: (chunkIndex: number) => void;
}

const CHUNK_BATCH_SIZE = 24;

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface ChunkItem {
  chunkIndex: number;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  sectionTitle?: string;
  headingPath?: string[];
}

interface SourceContentPreview {
  textPreview?: string;
  totalPages?: number;
  currentPage?: number;
  page?: {
    pageNumber: number;
    text: string;
  } | null;
  hasStructuredPages?: boolean;
  needsReimport?: boolean;
  totalChunks?: number;
  chunks?: ChunkItem[];
  chunkCoverage?: {
    startPage?: number;
    endPage?: number;
  } | null;
}

export const SourceViewer = forwardRef<SourceViewerHandle, SourceViewerProps>(({ sourceId, workspaceId, sourceType, url, title, checkpoints, onCheckpointReached }, ref) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const initializedSourceRef = useRef<string | null>(null);
  const [lastPassedCheckpoint, setLastPassedCheckpoint] = useState<number>(-1);
  const [contentPreview, setContentPreview] = useState<SourceContentPreview | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const [chunkList, setChunkList] = useState<ChunkItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [chunksLoading, setChunksLoading] = useState(false);

  const { completedChunks, completedPages, toggleChunk, togglePage, setTotals, progress } = useProgress(sourceId || '', workspaceId || '');

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(seconds, true);
        playerRef.current.playVideo();
      }
    },
    getCurrentTime: async () => {
      if (playerRef.current) {
        return playerRef.current.getCurrentTime();
      }
      return null;
    },
    play: () => {
      playerRef.current?.playVideo();
    },
    pause: () => {
      playerRef.current?.pauseVideo();
    },
    goToPage: (page: number) => {
      setPdfPage(page);
      setPageInput(String(page));
    },
    goToChunk: (chunkIndex: number) => {
      const chunk = chunkList.find(c => c.chunkIndex === chunkIndex);
      if (chunk && chunk.pageStart) {
        setPdfPage(chunk.pageStart);
        setPageInput(String(chunk.pageStart));
      }
    }
  }));

  useEffect(() => {
    if (!checkpoints || checkpoints.length === 0) return;
    
    const interval = setInterval(async () => {
      if (playerRef.current && playerRef.current.getPlayerState() === 1) { // 1 is playing
        const time = await playerRef.current.getCurrentTime();
        if (time !== undefined && time !== null) {
          const reached = checkpoints.find(cp => Math.abs(time - cp) < 1 && cp > lastPassedCheckpoint);
          if (reached !== undefined) {
            playerRef.current.pauseVideo();
            setLastPassedCheckpoint(reached);
            if (onCheckpointReached) {
              onCheckpointReached(reached);
            }
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [checkpoints, lastPassedCheckpoint, onCheckpointReached]);

  const onReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
  };

  const loadSourceContent = useCallback(async (page = 1) => {
    if (!sourceId || sourceType === 'youtube') return;

    const includeChunks = initializedSourceRef.current !== sourceId;
    setPdfLoading(true);
    setContentError(null);

    try {
      const params = new URLSearchParams();
      if (sourceType === 'pdf') params.set('page', String(page));
      params.set('chunkLimit', includeChunks ? String(CHUNK_BATCH_SIZE) : '0');

      const response = await fetch(`/api/sources/${sourceId}/content?${params.toString()}`);
      if (!response.ok) throw new Error('Preview unavailable');
      const data = await response.json() as SourceContentPreview;
      setContentPreview(data);
      setTotalChunks(data.totalChunks ?? 0);
      if (includeChunks) {
        setChunkList(data.chunks ?? []);
        initializedSourceRef.current = sourceId;
      }
      if (sourceType === 'pdf') {
        setPdfPage(data.currentPage ?? page);
        setPdfTotalPages(data.totalPages ?? 0);
        setPageInput(String(data.currentPage ?? page));
      }
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'Preview unavailable');
    } finally {
      setPdfLoading(false);
    }
  }, [sourceId, sourceType]);

  const loadMoreChunks = useCallback(async () => {
    if (!sourceId || sourceType === 'youtube' || chunksLoading) return;

    setChunksLoading(true);
    setContentError(null);

    try {
      const params = new URLSearchParams({
        chunkOffset: String(chunkList.length),
        chunkLimit: String(CHUNK_BATCH_SIZE),
      });
      const response = await fetch(`/api/sources/${sourceId}/content?${params.toString()}`);
      if (!response.ok) throw new Error('Could not load more chunks');
      const data = await response.json() as SourceContentPreview;
      setTotalChunks(data.totalChunks ?? 0);
      const incoming = data.chunks ?? [];
      setChunkList(prev => {
        const seen = new Set(prev.map(chunk => chunk.chunkIndex));
        return [...prev, ...incoming.filter(chunk => !seen.has(chunk.chunkIndex))];
      });
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'Could not load more chunks');
    } finally {
      setChunksLoading(false);
    }
  }, [sourceId, sourceType, chunksLoading, chunkList.length]);

  useEffect(() => {
    setPdfPage(1);
    setPageInput('1');
    setChunkList([]);
    setTotalChunks(0);
    initializedSourceRef.current = null;
  }, [sourceId]);

  // sync totals to progress store
  useEffect(() => {
    if (!workspaceId || !sourceId) return;
    const patch: Record<string, number> = {};
    if (totalChunks) patch.totalChunks = totalChunks;
    if (pdfTotalPages) patch.totalPages = pdfTotalPages;
    if (Object.keys(patch).length) setTotals(patch);
  }, [totalChunks, pdfTotalPages, workspaceId, sourceId, setTotals]);

  useEffect(() => {
    if (!sourceId || sourceType === 'youtube') return;
    loadSourceContent(sourceType === 'pdf' ? pdfPage : 1);
  }, [sourceId, sourceType, pdfPage, loadSourceContent]);

  const loadedEndPage = useMemo(() => {
    let end = 0;
    for (const chunk of chunkList) {
      if (typeof chunk.pageEnd === 'number') end = Math.max(end, chunk.pageEnd);
      else if (typeof chunk.pageStart === 'number') end = Math.max(end, chunk.pageStart);
    }
    return end || null;
  }, [chunkList]);

  const hasMoreChunks = totalChunks > chunkList.length;
  const remainingChunks = Math.max(0, totalChunks - chunkList.length);
  const nextBatchSize = Math.min(CHUNK_BATCH_SIZE, remainingChunks);
  const passedLoadedChunks = Boolean(
    sourceType === 'pdf' &&
    loadedEndPage !== null &&
    pdfPage > loadedEndPage &&
    hasMoreChunks
  );

  if (sourceType === 'youtube' && url) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return (
        <div className="w-full h-full flex flex-col bg-black relative group">
          <YouTube
            videoId={videoId}
            onReady={onReady}
            opts={{
              height: '100%',
              width: '100%',
              playerVars: {
                autoplay: 0,
                rel: 0,
                modestbranding: 1,
                color: 'white',
              },
            }}
            className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
          />
        </div>
      );
    }
  }

  if ((sourceType === 'pdf' || sourceType === 'url' || sourceType === 'text') && sourceId) {
    const isPdf = sourceType === 'pdf';

    return (
      <div className="w-full h-full overflow-y-auto p-5" style={{ background: '#1c1c1e', scrollbarWidth: 'thin' }}>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="sticky top-0 z-10 py-3 space-y-3" style={{ background: '#1c1c1e' }}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#A2A8B5] font-bold">
                {sourceType === 'pdf' ? 'PDF Reader' : sourceType === 'url' ? 'Article Preview' : 'Source Preview'}
              </p>
              <h2 className="text-lg font-bold text-[#F5F6F8] mt-1">{title}</h2>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="text-[12px] text-[#52ebcf] hover:underline">
                  Open original
                </a>
              )}
            </div>

            {/* Chunk/Page progress header */}
            {(totalChunks > 0 || pdfTotalPages > 0) && workspaceId && (
              <div className="rounded-[10px] p-3 flex items-center gap-3 flex-wrap" style={{ background: '#151922', border: '1px solid #252B36' }}>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#7C5CFF]">Progress</span>
                {totalChunks > 0 && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${completedChunks.length >= totalChunks ? 'bg-[#42C67A]/15 text-[#42C67A] border-[#42C67A]/30' : 'bg-[#252B36] text-[#A2A8B5] border-[#343B47]'}`}>
                    Chunks {completedChunks.length}/{totalChunks} {completedChunks.length >= totalChunks ? '✓' : ''}
                  </span>
                )}
                {pdfTotalPages > 0 && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${completedPages.length >= pdfTotalPages ? 'bg-[#42C67A]/15 text-[#42C67A] border-[#42C67A]/30' : 'bg-[#252B36] text-[#A2A8B5] border-[#343B47]'}`}>
                    Pages {completedPages.length}/{pdfTotalPages}
                  </span>
                )}
                <div className="flex-1 min-w-[80px] h-1.5 rounded-full overflow-hidden bg-[#0F1115] border border-[#252B36]">
                  <div className="h-full bg-[#7C5CFF] transition-all" style={{ width: `${totalChunks ? Math.round((completedChunks.length/totalChunks)*100) : pdfTotalPages ? Math.round((completedPages.length/pdfTotalPages)*100) : 0}%` }} />
                </div>
              </div>
            )}

            {isPdf && pdfTotalPages > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={pdfPage <= 1 || pdfLoading}
                  onClick={() => setPdfPage(current => Math.max(1, current - 1))}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                  style={{ background: '#252B36', color: '#F5F6F8' }}
                >
                  Previous
                </button>
                <span className="text-xs text-[#A2A8B5]">
                  Page {pdfPage} of {pdfTotalPages}
                </span>
                <button
                  type="button"
                  disabled={pdfPage >= pdfTotalPages || pdfLoading}
                  onClick={() => setPdfPage(current => Math.min(pdfTotalPages, current + 1))}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                  style={{ background: '#252B36', color: '#F5F6F8' }}
                >
                  Next
                </button>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const parsed = Number.parseInt(pageInput, 10);
                    if (!Number.isFinite(parsed)) return;
                    setPdfPage(Math.min(Math.max(parsed, 1), pdfTotalPages));
                  }}
                >
                  <input
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="w-16 px-2 py-1.5 rounded-md text-xs"
                    style={{ background: '#252B36', color: '#F5F6F8', border: '1px solid #343B47' }}
                    aria-label="Jump to page"
                  />
                  <button
                    type="submit"
                    disabled={pdfLoading}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                    style={{ background: '#252B36', color: '#F5F6F8' }}
                  >
                    Go
                  </button>
                </form>
              </div>
            )}
            {totalChunks > 0 && (
              <div
                className="flex items-center justify-between gap-2 flex-wrap rounded-md px-3 py-2"
                style={{ background: '#151922', border: '1px solid #252B36' }}
              >
                <p className="text-[11px] text-[#A2A8B5]">
                  {sourceType === 'pdf' ? (
                    <>
                      {'Chunked through page '}
                      <span className="font-semibold text-[#F5F6F8]">{loadedEndPage ?? '—'}</span>
                      {pdfTotalPages > 0 ? ` of ${pdfTotalPages}` : ''}
                      {` · ${chunkList.length}/${totalChunks} chunks loaded`}
                    </>
                  ) : (
                    <>
                      {`${chunkList.length} of ${totalChunks} chunks loaded`}
                      {loadedEndPage !== null ? ` · through page ${loadedEndPage}` : ''}
                    </>
                  )}
                </p>
                {hasMoreChunks ? (
                  <button
                    type="button"
                    onClick={loadMoreChunks}
                    disabled={chunksLoading || pdfLoading}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
                    style={{ background: '#252B36', color: '#52ebcf', border: '1px solid #343B47' }}
                  >
                    {chunksLoading ? 'Loading…' : `Load next ${nextBatchSize} chunks`}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#A2A8B5]">All chunks loaded</span>
                )}
              </div>
            )}

            {passedLoadedChunks && (
              <div
                className="flex items-center justify-between gap-3 flex-wrap rounded-md px-3 py-2"
                style={{ background: 'rgba(245, 185, 66, 0.08)', border: '1px solid rgba(245, 185, 66, 0.35)' }}
              >
                <p className="text-xs text-amber-300">
                  You&apos;re past the loaded preview chunks (loaded through page {loadedEndPage}).
                </p>
                <button
                  type="button"
                  onClick={loadMoreChunks}
                  disabled={chunksLoading}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-amber-300 disabled:opacity-40"
                  style={{ background: '#252B36', border: '1px solid rgba(245, 185, 66, 0.35)' }}
                >
                  {chunksLoading ? 'Loading…' : `Load next ${nextBatchSize} chunks`}
                </button>
              </div>
            )}
          </div>

          {!contentPreview && !contentError && (
            <p className="text-sm text-[#A2A8B5]">Loading source preview...</p>
          )}

          {contentError && (
            <p className="text-sm text-red-400">{contentError}</p>
          )}

          {contentPreview?.needsReimport && (
            <p className="text-sm text-amber-300">
              Re-import this PDF to enable full page-by-page reading and cleaner formatting.
            </p>
          )}

          {isPdf && contentPreview?.page?.text && (
            <section
              className="rounded-[8px] p-5"
              style={{ background: workspaceId && completedPages.includes(contentPreview.page.pageNumber) ? '#0f1f14' : '#151922', border: `1px solid ${workspaceId && completedPages.includes(contentPreview.page.pageNumber) ? 'rgba(66,198,122,0.3)' : '#252B36'}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A2A8B5]">
                  Page {contentPreview.page.pageNumber}
                </p>
                {workspaceId && (
                  <button
                    onClick={() => togglePage(contentPreview.page!.pageNumber)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${completedPages.includes(contentPreview.page.pageNumber) ? 'bg-[#42C67A] text-white border-[#42C67A]' : 'bg-[#252B36] text-[#A2A8B5] border-[#343B47] hover:border-[#7C5CFF]/40'}`}
                  >
                    {completedPages.includes(contentPreview.page.pageNumber) ? '✓ Completed' : 'Mark done'}
                  </button>
                )}
              </div>
              <div className="text-sm leading-7 text-[#D8DBE3] whitespace-pre-wrap space-y-4">
                {contentPreview.page.text.split(/\n\n+/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {!isPdf && chunkList.length > 0 ? (
            <div className="space-y-3">
              {chunkList.map(chunk => {
                const isDone = completedChunks.includes(chunk.chunkIndex);
                return (
                  <section
                    key={chunk.chunkIndex}
                    className="rounded-[8px] p-4"
                    style={{ background: isDone ? '#0f1f14' : '#151922', border: `1px solid ${isDone ? 'rgba(66,198,122,0.3)' : '#252B36'}` }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        {chunk.headingPath && chunk.headingPath.length > 1 ? (
                          <p className="text-[11px] text-[#52ebcf]">{chunk.headingPath.join(' › ')}</p>
                        ) : chunk.sectionTitle ? (
                          <p className="text-[11px] text-[#52ebcf]">{chunk.sectionTitle}</p>
                        ) : null}
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A2A8B5]">
                          {chunk.pageStart ? `Page ${chunk.pageStart}${chunk.pageEnd && chunk.pageEnd !== chunk.pageStart ? `-${chunk.pageEnd}` : ''}` : `Chunk ${chunk.chunkIndex + 1}`}
                        </p>
                      </div>
                      {workspaceId && (
                        <button
                          onClick={() => toggleChunk(chunk.chunkIndex)}
                          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-all ${isDone ? 'bg-[#42C67A] text-white border-[#42C67A]' : 'bg-[#252B36] text-[#A2A8B5] border-[#343B47] hover:border-[#7C5CFF]/40'}`}
                        >
                          {isDone ? '✓ Done' : 'Mark done'}
                        </button>
                      )}
                    </div>
                    <div className="text-sm leading-7 text-[#D8DBE3] whitespace-pre-wrap space-y-3">
                      {chunk.text.split(/\n\n+/).map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                );
              })}
              {hasMoreChunks && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={loadMoreChunks}
                    disabled={chunksLoading}
                    className="px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-40"
                    style={{ background: '#252B36', color: '#F5F6F8', border: '1px solid #343B47' }}
                  >
                    {chunksLoading
                      ? 'Loading…'
                      : `Load next ${nextBatchSize} chunks (${remainingChunks} remaining)`}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {!isPdf && chunkList.length === 0 && contentPreview?.textPreview ? (
            <div className="text-sm leading-7 text-[#D8DBE3] whitespace-pre-wrap space-y-3">
              {contentPreview.textPreview.split(/\n\n+/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center p-10 text-center"
      style={{ background: '#1c1c1e' }}
    >
      <div>
        <div className="text-5xl mb-4 opacity-30">
          {sourceType === 'pdf' ? '⬜' : sourceType === 'url' ? '⬡' : '✎'}
        </div>
        <p className="text-sm text-[#555] mb-1 font-medium">{title}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#52ebcf] hover:underline mt-3 block"
          >
            Open original ↗
          </a>
        )}
      </div>
    </div>
  );
});

SourceViewer.displayName = 'SourceViewer';
