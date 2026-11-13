'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialMessage?: string;
}

export function ApiKeyModal({ isOpen, onClose, onSaved, initialMessage }: ApiKeyModalProps) {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [hasExistingOpenRouter, setHasExistingOpenRouter] = useState(false);
  const [hasExistingGemini, setHasExistingGemini] = useState(false);
  const [openRouterMasked, setOpenRouterMasked] = useState('');
  const [geminiMasked, setGeminiMasked] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingOr, setTestingOr] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    initialMessage ? { text: initialMessage, type: 'info' } : null
  );

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/user/keys')
      .then(r => r.json())
      .then(data => {
        if (data.hasOpenRouterKey) {
          setHasExistingOpenRouter(true);
          setOpenRouterMasked(data.openRouterKeyMasked || '');
        }
        if (data.hasGeminiKey) {
          setHasExistingGemini(true);
          setGeminiMasked(data.geminiKeyMasked || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const testKey = async (provider: 'openrouter' | 'gemini') => {
    const key = provider === 'openrouter' ? openRouterKey.trim() : geminiKey.trim();
    if (!key) {
      setStatusMessage({
        text: `Please enter a ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} API key to test.`,
        type: 'error',
      });
      return;
    }

    if (provider === 'openrouter') setTestingOr(true);
    else setTestingGemini(true);

    try {
      const res = await fetch('/api/user/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json();
      if (data.valid) {
        setStatusMessage({ text: `✓ ${data.message || 'Key is valid!'}`, type: 'success' });
      } else {
        setStatusMessage({ text: `✗ ${data.error || 'Key validation failed.'}`, type: 'error' });
      }
    } catch (e) {
      setStatusMessage({ text: 'Failed to test API key', type: 'error' });
    } finally {
      if (provider === 'openrouter') setTestingOr(false);
      else setTestingGemini(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const payload: { openRouterApiKey?: string; geminiApiKey?: string } = {};
    if (openRouterKey.trim()) payload.openRouterApiKey = openRouterKey.trim();
    if (geminiKey.trim()) payload.geminiApiKey = geminiKey.trim();

    if (Object.keys(payload).length === 0 && !hasExistingOpenRouter && !hasExistingGemini) {
      setStatusMessage({ text: 'Please enter at least one API key (OpenRouter or Gemini).', type: 'error' });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ text: '✓ API keys saved successfully! LearnLoop is now using your keys.', type: 'success' });
        setOpenRouterKey('');
        setGeminiKey('');
        setHasExistingOpenRouter(data.hasOpenRouterKey);
        setOpenRouterMasked(data.openRouterKeyMasked);
        setHasExistingGemini(data.hasGeminiKey);
        setGeminiMasked(data.geminiKeyMasked);

        if (onSaved) {
          setTimeout(() => {
            onSaved();
            onClose();
          }, 800);
        }
      } else {
        setStatusMessage({ text: data.error || 'Failed to save API keys.', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Network error saving API keys.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Revert back to shared system AI? Your custom keys will be removed.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/keys', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setHasExistingOpenRouter(false);
        setHasExistingGemini(false);
        setOpenRouterMasked('');
        setGeminiMasked('');
        setStatusMessage({ text: 'Custom keys removed. Reverted to shared system AI.', type: 'info' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to reset keys.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-lg rounded-2xl bg-[#151922] border border-[#252B36] p-6 shadow-2xl text-white relative max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#A2A8B5] hover:text-white p-1 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#7C5CFF]/15 border border-[#7C5CFF]/30 flex items-center justify-center text-xl">
                🔑
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Add Your Own API Keys</h2>
                <p className="text-xs text-[#A2A8B5]">
                  Use your own OpenRouter or Google Gemini credits for unlimited AI learning.
                </p>
              </div>
            </div>

            {/* Quota Notice Banner */}
            <div className="bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 rounded-xl p-3 mb-4 text-xs text-[#d1c4e9] leading-relaxed">
              💡 <strong>Why add your key?</strong> When shared system AI credits run out or hit quota limits, adding your own key ensures your mind maps, quizzes, and AI tutor continue working seamlessly.
            </div>

            {/* Status Feedback */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs font-medium ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : statusMessage.type === 'error'
                    ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                    : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* OpenRouter Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>OpenRouter API Key</span>
                    {hasExistingOpenRouter && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        Active: {openRouterMasked}
                      </span>
                    )}
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#7C5CFF] hover:underline"
                  >
                    Get OpenRouter Key ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={hasExistingOpenRouter ? 'Enter new key to replace...' : 'sk-or-v1-...'}
                    value={openRouterKey}
                    onChange={e => setOpenRouterKey(e.target.value)}
                    className="flex-1 bg-[#0F1115] border border-[#252B36] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7C5CFF]"
                  />
                  {openRouterKey.trim() && (
                    <button
                      type="button"
                      onClick={() => testKey('openrouter')}
                      disabled={testingOr}
                      className="px-3 py-2 bg-[#252B36] hover:bg-[#2e3542] rounded-xl text-xs font-medium text-white transition-colors"
                    >
                      {testingOr ? 'Testing...' : 'Test'}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#A2A8B5] mt-1">
                  Supports Claude 3.5 Sonnet, DeepSeek V3, GPT-4o-mini, and Gemini models.
                </p>
              </div>

              {/* Google Gemini Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Google Gemini API Key</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7C5CFF]/20 text-[#a78bfa]">
                      Free tier available
                    </span>
                    {hasExistingGemini && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        Active: {geminiMasked}
                      </span>
                    )}
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#7C5CFF] hover:underline"
                  >
                    Get Free Gemini Key ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={hasExistingGemini ? 'Enter new key to replace...' : 'AIzaSy...'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    className="flex-1 bg-[#0F1115] border border-[#252B36] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7C5CFF]"
                  />
                  {geminiKey.trim() && (
                    <button
                      type="button"
                      onClick={() => testKey('gemini')}
                      disabled={testingGemini}
                      className="px-3 py-2 bg-[#252B36] hover:bg-[#2e3542] rounded-xl text-xs font-medium text-white transition-colors"
                    >
                      {testingGemini ? 'Testing...' : 'Test'}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#A2A8B5] mt-1">
                  100% free with Gemini Flash on Google AI Studio. Perfect emergency or primary key!
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#252B36]">
                {(hasExistingOpenRouter || hasExistingGemini) ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={saving}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Clear custom keys
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-[#252B36] text-[#A2A8B5] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#7C5CFF] text-white hover:bg-[#6c4fe0] transition-colors shadow-lg shadow-[#7C5CFF]/20"
                  >
                    {saving ? 'Saving...' : 'Save Keys'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
