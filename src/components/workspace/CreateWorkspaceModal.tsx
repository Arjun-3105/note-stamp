'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newWorkspace: any) => void;
}

export function CreateWorkspaceModal({ isOpen, onClose, onSuccess }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Workspace title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create workspace');
      }

      const workspace = await response.json();
      setTitle('');
      setDescription('');
      onClose();
      if (onSuccess) {
        onSuccess(workspace);
      } else {
        router.push(`/workspace/${workspace.$id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-5">
        <div className="flex items-center justify-between border-b pb-3 border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📂</span>
            <h2 className="text-lg font-extrabold text-gray-900">Create New Workspace</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs font-semibold rounded-xl bg-red-50 text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Workspace Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Data Structures & Algorithms, Physics 101"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-sm outline-none transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Description <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Add learning goals or topic notes for this workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-sm outline-none transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
