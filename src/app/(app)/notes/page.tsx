'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

interface SourceNoteItem {
  sourceId: string;
  sourceTitle: string;
  workspaceId: string;
  sourceType: string;
  noteContent: string | null;
  updatedAt?: string;
}

export default function NotesPage() {
  const { userId } = useAuth();
  const [sourcesNotes, setSourcesNotes] = useState<SourceNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<SourceNoteItem | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function loadNotesData() {
      try {
        const wsRes = await fetch('/api/workspaces');
        if (!wsRes.ok) throw new Error('Failed to load workspaces');
        const wsData = await wsRes.json();
        const workspaces = wsData.workspaces || [];

        const items: SourceNoteItem[] = [];

        for (const ws of workspaces) {
          const sourcesRes = await fetch(`/api/sources?workspaceId=${ws.$id}`);
          if (sourcesRes.ok) {
            const sourcesData = await sourcesRes.json();
            const sources = sourcesData.sources || [];

            for (const s of sources) {
              const noteRes = await fetch(`/api/notes?sourceId=${s.$id}`);
              let noteContent: string | null = null;
              let updatedAt = s.createdAt;
              if (noteRes.ok) {
                const noteData = await noteRes.json();
                if (noteData.note) {
                  noteContent = noteData.note.content || null;
                  updatedAt = noteData.note.updatedAt || s.createdAt;
                }
              }
              items.push({
                sourceId: s.$id,
                sourceTitle: s.title || 'Untitled Source',
                workspaceId: ws.$id,
                sourceType: s.type || s.sourceType || 'text',
                noteContent,
                updatedAt,
              });
            }
          }
        }
        setSourcesNotes(items);
      } catch (err) {
        console.error('Error loading notes:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotesData();
  }, [userId]);

  const filteredNotes = sourcesNotes.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.sourceTitle.toLowerCase().includes(q) ||
      (item.noteContent && item.noteContent.toLowerCase().includes(q))
    );
  });

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
              <span className="font-semibold text-gray-800">Notes</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              My Study Notes &amp; Summaries
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Access, view, and organize notes generated across all your learning sources.
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm shrink-0"
          >
            Go to Workspaces →
          </Link>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-gray-400 pl-2">🔍</span>
          <input
            type="text"
            placeholder="Search notes by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600 pr-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Notes Content */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            Loading your study notes...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl space-y-3">
            <span className="text-4xl block">📝</span>
            <p className="text-gray-800 font-bold text-lg">No notes found</p>
            <p className="text-gray-500 text-xs max-w-sm mx-auto">
              Import a PDF, YouTube video, or text source into a workspace to generate and write notes.
            </p>
            <Link
              href="/import"
              className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              + Create New Note Source
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNotes.map((item) => {
              const plainText = item.noteContent
                ? item.noteContent.replace(/<[^>]*>/g, '').trim()
                : 'No custom notes added yet. Click to view and editor in workspace.';

              return (
                <div
                  key={item.sourceId}
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        {item.sourceType}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.updatedAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base line-clamp-1">
                      {item.sourceTitle}
                    </h3>

                    <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed bg-gray-50 p-3 rounded-xl">
                      {plainText}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedNote(item)}
                      className="text-xs font-bold text-gray-600 hover:text-gray-900"
                    >
                      Quick View 👁️
                    </button>
                    <Link
                      href={`/workspace/${item.workspaceId}/${item.sourceId}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Open in Workspace →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal for Quick View */}
        {selectedNote && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-gray-100">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-lg text-gray-900">{selectedNote.sourceTitle}</h3>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-xl text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {selectedNote.noteContent
                  ? selectedNote.noteContent.replace(/<[^>]*>/g, '')
                  : 'No custom note written for this source yet.'}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Close
                </button>
                <Link
                  href={`/workspace/${selectedNote.workspaceId}/${selectedNote.sourceId}`}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  Edit Note in Workspace
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
