'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export default function ApiKeysSettingsPage() {
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [hasExistingOpenRouter, setHasExistingOpenRouter] = useState(false);
  const [hasExistingGemini, setHasExistingGemini] = useState(false);
  const [openRouterMasked, setOpenRouterMasked] = useState('');
  const [geminiMasked, setGeminiMasked] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOr, setTestingOr] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/keys');
      const data = await res.json();
      setHasExistingOpenRouter(data.hasOpenRouterKey);
      setOpenRouterMasked(data.openRouterKeyMasked || '');
      setHasExistingGemini(data.hasGeminiKey);
      setGeminiMasked(data.geminiKeyMasked || '');
    } catch {
      setStatusMessage({ text: 'Failed to load key settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleTest = async (provider: 'openrouter' | 'gemini') => {
    const key = provider === 'openrouter' ? openRouterKey.trim() : geminiKey.trim();
    if (!key) {
      setStatusMessage({
        text: `Please enter a ${provider === 'openrouter' ? 'OpenRouter' : 'Google Gemini'} key to test.`,
        type: 'error',
      });
      return;
    }

    if (provider === 'openrouter') setTestingOr(true);
    else setTestingGemini(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/user/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setStatusMessage({ text: `✓ ${data.message || 'Key verified successfully!'}`, type: 'success' });
      } else {
        setStatusMessage({ text: `✗ ${data.error || 'Key validation failed.'}`, type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to test key due to network error.', type: 'error' });
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
      setStatusMessage({ text: 'Please enter at least one API key before saving.', type: 'error' });
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
        setStatusMessage({ text: '✓ API keys saved successfully! LearnLoop is now using your custom keys.', type: 'success' });
        setOpenRouterKey('');
        setGeminiKey('');
        setHasExistingOpenRouter(data.hasOpenRouterKey);
        setOpenRouterMasked(data.openRouterKeyMasked);
        setHasExistingGemini(data.hasGeminiKey);
        setGeminiMasked(data.geminiKeyMasked);
      } else {
        setStatusMessage({ text: data.error || 'Failed to save API keys.', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to save keys due to network error.', type: 'error' });
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
        setStatusMessage({ text: 'Custom keys cleared. Reverted back to system defaults.', type: 'info' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to clear custom keys.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-3 border-gray-200 border-t-[#6c63ff] animate-spin" />
      </div>
    );
  }

  const isUsingCustom = hasExistingOpenRouter || hasExistingGemini;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <SettingsTabs />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900">AI &amp; API Keys</h1>
        <p className="text-sm text-gray-500 mt-1">
          Provide your own OpenRouter or Google Gemini API key to avoid shared AI credit exhaustion.
        </p>
      </motion.div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl p-5 border shadow-sm bg-white flex items-center justify-between gap-4"
        style={{ borderColor: isUsingCustom ? '#bbf7d0' : '#e0d9ff' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: isUsingCustom ? '#f0fdf4' : '#f5f3ff' }}
          >
            {isUsingCustom ? '✨' : '⚡'}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">AI Engine Routing</p>
            <p className="text-base font-bold text-gray-900">
              {isUsingCustom ? 'Using Your Custom API Keys' : 'Using Shared System AI Quota'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isUsingCustom
                ? 'Your requests are authenticated with your own provider credits directly.'
                : 'Free tier shared pool. If requests fail due to credit exhaustion, add your own keys below.'}
            </p>
          </div>
        </div>
        {isUsingCustom && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            Clear Custom Keys
          </button>
        )}
      </motion.div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* OpenRouter Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 border border-gray-200 bg-white shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h2 className="text-base font-bold text-gray-900">OpenRouter API Key</h2>
                {hasExistingOpenRouter && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-medium">
                    Active: {openRouterMasked}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Gives access to Claude 3.5 Sonnet, DeepSeek V3/Flash, GPT-4o-mini, and top-tier models.
              </p>
            </div>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#6c63ff] hover:underline"
            >
              Get OpenRouter Key ↗
            </a>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={hasExistingOpenRouter ? '•••••••• (leave blank to keep current key)' : 'sk-or-v1-...'}
                value={openRouterKey}
                onChange={e => setOpenRouterKey(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c63ff]"
              />
              {openRouterKey.trim() && (
                <button
                  type="button"
                  onClick={() => handleTest('openrouter')}
                  disabled={testingOr}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shrink-0"
                >
                  {testingOr ? 'Testing...' : 'Test Key'}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Google Gemini Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-6 border border-gray-200 bg-white shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h2 className="text-base font-bold text-gray-900">Google Gemini API Key</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-[#6c63ff] font-medium">
                  Free Tier Available
                </span>
                {hasExistingGemini && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-medium">
                    Active: {geminiMasked}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Direct access to Google Gemini 2.0 / 1.5 Flash. Fast, reliable, and completely free on Google AI Studio.
              </p>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#6c63ff] hover:underline"
            >
              Get Free Gemini Key ↗
            </a>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={hasExistingGemini ? '•••••••• (leave blank to keep current key)' : 'AIzaSy...'}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6c63ff]"
              />
              {geminiKey.trim() && (
                <button
                  type="button"
                  onClick={() => handleTest('gemini')}
                  disabled={testingGemini}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shrink-0"
                >
                  {testingGemini ? 'Testing...' : 'Test Key'}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#6c63ff] text-white hover:bg-[#5b52e0] transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save API Keys'}
          </button>
        </div>
      </form>

      {/* Info Callout */}
      <div className="rounded-2xl p-5 bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-2">
        <p className="font-semibold text-gray-800">🔒 Security &amp; Privacy</p>
        <p>
          Your keys are securely stored in your personal browser session cookies and are only sent to authenticate your AI requests (such as mind map generation, AI tutoring, and quiz creation).
        </p>
      </div>
    </div>
  );
}
