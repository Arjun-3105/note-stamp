'use client';

import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';

export interface SourceViewerProps {
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
}

function extractYouTubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const SourceViewer = forwardRef<SourceViewerHandle, SourceViewerProps>(({ sourceType, url, title, checkpoints, onCheckpointReached }, ref) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [lastPassedCheckpoint, setLastPassedCheckpoint] = useState<number>(-1);

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
