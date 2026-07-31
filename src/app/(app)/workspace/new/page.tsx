'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewWorkspacePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
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
      router.push(`/workspace/${workspace.$id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/workspace" className="text-blue-600 hover:text-blue-700 text-sm">
          ← Back to Workspaces
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Workspace</h1>
        <p className="text-gray-600 mb-8">
          Organize your learning with dedicated workspaces for each topic or project.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-600 mb-6">
            Error: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg p-8 shadow">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Workspace Title *
            </label>
            <input
              id="title"
              type="text"
              placeholder="e.g., Advanced TypeScript, Machine Learning Fundamentals"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <p className="mt-1 text-sm text-gray-500">
              Give your workspace a clear, descriptive name
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              placeholder="Optional: Add goals, notes, or context for this workspace..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
            <Link
              href="/workspace"
              className="flex-1 rounded-lg border border-gray-300 px-6 py-2 text-gray-700 font-medium hover:bg-gray-50 text-center"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="font-semibold text-blue-900 mb-3">Workspace Tips</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Create separate workspaces for different courses, books, or projects</li>
            <li>• Use descriptive titles so you can easily find them later</li>
            <li>• You can add sources (videos, PDFs, URLs) to your workspace once created</li>
            <li>• Track progress and earn badges as you complete learning goals</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

