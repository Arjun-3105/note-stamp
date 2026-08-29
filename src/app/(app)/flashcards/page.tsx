'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { FlashcardsView } from '@/components/learn/FlashcardsView';

interface SourceDeckItem {
  sourceId: string;
  sourceTitle: string;
  workspaceId: string;
  sourceType: string;
  cardCount: number;
}

export default function FlashcardsPage() {
  const { userId } = useAuth();
  const [decks, setDecks] = useState<SourceDeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function loadDecks() {
      try {
        const wsRes = await fetch('/api/workspaces');
        if (!wsRes.ok) throw new Error('Failed to load workspaces');
        const wsData = await wsRes.json();
        const workspaces = wsData.workspaces || [];

        const items: SourceDeckItem[] = [];

        for (const ws of workspaces) {
          const sourcesRes = await fetch(`/api/sources?workspaceId=${ws.$id}`);
          if (sourcesRes.ok) {
            const sourcesData = await sourcesRes.json();
            const sources = sourcesData.sources || [];

            for (const s of sources) {
              let cardCount = 0;
              try {
                const fcRes = await fetch(`/api/flashcards?sourceId=${s.$id}`);
                if (fcRes.ok) {
                  const fcData = await fcRes.json();
                  cardCount = fcData.cards?.length || 0;
                }
              } catch {}

              items.push({
                sourceId: s.$id,
                sourceTitle: s.title || 'Untitled Source',
                workspaceId: ws.$id,
                sourceType: s.type || s.sourceType || 'text',
                cardCount,
              });
            }
          }
        }
        setDecks(items);
        if (items.length > 0) {
          setActiveSourceId(items[0].sourceId);
        }
      } catch (err) {
        console.error('Failed to load flashcard decks:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDecks();
  }, [userId]);

  const activeDeck = decks.find((d) => d.sourceId === activeSourceId);

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-10 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-800">Flashcards</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Anki Flashcards &amp; Spaced Recall
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Master concepts with AI-generated, source-grounded active recall decks.
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shrink-0"
          >
            Manage Sources →
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            Loading your flashcard decks...
          </div>
        ) : decks.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl space-y-3">
            <span className="text-4xl block">🎴</span>
            <p className="text-gray-800 font-bold text-lg">No active decks found</p>
            <p className="text-gray-500 text-xs max-w-sm mx-auto">
              Add a YouTube video, PDF, or document to your workspace to generate AI flashcards.
            </p>
            <Link
              href="/import"
              className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              + Add Source to Generate Decks
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Deck Picker */}
            <div className="space-y-3 lg:col-span-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider px-2">
                Available Decks ({decks.length})
              </h3>
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {decks.map((deck) => {
                  const isActive = deck.sourceId === activeSourceId;
                  return (
                    <button
                      key={deck.sourceId}
                      onClick={() => setActiveSourceId(deck.sourceId)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 text-xs font-semibold ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="uppercase text-[9px] font-bold tracking-wider opacity-80">
                          {deck.sourceType}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {deck.cardCount > 0 ? `${deck.cardCount} cards` : 'New'}
                        </span>
                      </div>
                      <span className="line-clamp-1 font-bold">{deck.sourceTitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flashcard Study Area */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              {activeSourceId && activeDeck ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase">
                        {activeDeck.sourceType}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900 mt-1">
                        {activeDeck.sourceTitle}
                      </h2>
                    </div>
                    <Link
                      href={`/workspace/${activeDeck.workspaceId}/${activeDeck.sourceId}`}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Open in Workspace ↗
                    </Link>
                  </div>

                  <FlashcardsView sourceId={activeSourceId} />
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">Select a deck from the sidebar to start studying.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
