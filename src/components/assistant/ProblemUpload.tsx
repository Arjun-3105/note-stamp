'use client';

import { useState, useRef } from 'react';

interface UploadResult {
  solution: string;
  fileInfo: { name: string; size: number; type: string };
  sessionId: string;
}

interface ProblemUploadProps {
  contextId: string;
  onResult: (result: UploadResult) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_MB = 5;

export function ProblemUpload({ contextId, onResult }: ProblemUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Only JPEG, PNG, WebP images and PDFs are supported.';
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large — max ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contextId', contextId);
      if (description.trim()) formData.append('description', description.trim());

      const res = await fetch('/api/ai/assistant/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const result = await res.json();
      onResult(result);
      // Reset after success
      setFile(null);
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors
          ${isDragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div>
            <p className="text-sm font-medium text-slate-200">{file.name}</p>
            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <>
            <p className="text-2xl mb-2">📎</p>
            <p className="text-sm text-slate-300">Drop image or PDF here</p>
            <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP, PDF · max {MAX_SIZE_MB}MB</p>
          </>
        )}
      </div>

      {/* Optional description */}
      {file && (
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the problem or what you need help with… (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500"
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {file && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {loading ? 'Analyzing…' : 'Analyze Problem'}
        </button>
      )}
    </div>
  );
}
