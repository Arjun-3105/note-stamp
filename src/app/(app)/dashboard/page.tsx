'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

/* ─── Types (mirror the API shape) ────────────────────────────── */
interface DashboardData {
  plan: string;
  usage: { totalTokens: number; freeLimit: number; isPro: boolean };
  workspaces: {
    id: string; title: string; description?: string;
    sourceCount: number; completedUnits: number; totalUnits: number;
    pct: number; updatedAt: string;
  }[];
  recentSources: {
    id: string; title: string; sourceType: string;
    workspaceId: string; workspaceTitle: string;
    notesCount: number; createdAt: string;
  }[];
  badges: {
    id: string; title: string; skill: string; type: string;
    score: number; mintedAt?: string; createdAt: string;
  }[];
  streak: { current: number; best: number; last7: boolean[] };
  todayCheckpoints: number;
  todayGoal: number;
  recommended: { id: string; title: string; pct: number }[];
  activity: {
    type: 'quiz' | 'source';
    title: string; sourceId: string; time: string;
    score?: number; passed?: boolean;
    workspaceId?: string; sourceType?: string;
  }[];
  totalWorkspaces: number;
  totalBadges: number;
  totalQuizAttempts: number;
}

/* ─── Helpers ──────────────────────────────────────────────────── */
const SOURCE_COLORS: Record<string, string> = {
  youtube: '#ef4444', pdf: '#3b82f6', url: '#10b981',
  text: '#a855f7', audio: '#f59e0b', github: '#6366f1',
};
const SOURCE_ICONS: Record<string, string> = {
  youtube: '▶', pdf: '📄', url: '🔗', text: '✎', audio: '🎧', github: '⊞',
};
const WS_PALETTE = ['#6c63ff', '#10b981', '#f59e0b', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ─── Empty state ──────────────────────────────────────────────── */
function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>{desc}</p>
      {action}
    </div>
  );
}

/* ─── Skeleton loader ───────────────────────────────────────────── */
function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: r, background: '#f0f0f5' }}
    />
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useUser();
  const firstName = user?.firstName || 'there';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(d => setData(d))
      .catch(() => setError('Could not load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  // Featured workspace = the one with highest pct progress (most recent if tie)
  const featured = data?.workspaces[0] ?? null;
  const featuredColor = featured ? WS_PALETTE[0] : '#6c63ff';

  return (
    <div
      className="h-full flex overflow-hidden"
      style={{ background: '#f8f8fc', fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      {/* ── Main scroll area ── */}
      <div className="flex-1 overflow-y-auto px-8 py-7">

        {/* Welcome */}
        <div className="mb-6">
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>
            Welcome back, {firstName}! 👋
          </h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Continue your learning journey. You&apos;ve got this!
          </p>
        </div>

        {/* Featured course card */}
        <div
          className="rounded-2xl p-5 mb-6 flex items-center gap-5"
          style={{ background: '#fff', border: '1px solid #eeeef6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          {loading ? (
            <div className="flex items-center gap-5 w-full">
              <Skeleton w={96} h={80} r={12} />
              <div className="flex-1 space-y-2">
                <Skeleton w="40%" h={12} />
                <Skeleton w="60%" h={20} />
                <Skeleton w="100%" h={8} />
                <div className="flex gap-5 pt-1">
                  <Skeleton w={80} h={32} />
                  <Skeleton w={80} h={32} />
                  <Skeleton w={80} h={32} />
                </div>
              </div>
            </div>
          ) : featured ? (
            <>
              {/* Thumbnail */}
              <div
                className="w-24 h-20 rounded-xl flex flex-col items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${featuredColor}, ${featuredColor}99)` }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>📚</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '0.06em', textAlign: 'center', padding: '0 4px' }}>
                  {featured.title.slice(0, 12).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>
                  {featured.sourceCount} source{featured.sourceCount !== 1 ? 's' : ''} • {featured.description || 'Your workspace'}
                </p>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {featured.title}
                </h2>
                {/* Progress */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: '#f0f0f5' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${featured.pct}%`, background: featuredColor }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: featuredColor, width: 36 }}>{featured.pct}%</span>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-5">
                  {[
                    { icon: '🕐', label: 'Last updated', val: timeAgo(featured.updatedAt) },
                    { icon: '📁', label: 'Sources', val: String(featured.sourceCount) },
                    { icon: '✅', label: 'Completed', val: `${featured.completedUnits}/${featured.totalUnits}` },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={{ fontSize: 10, color: '#aaa', marginBottom: 1 }}>{s.icon} {s.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <Link
                href={`/workspace/${featured.id}`}
                className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${featuredColor}, ${featuredColor}bb)`, color: '#fff', textDecoration: 'none' }}
              >
                Continue Learning
              </Link>
            </>
          ) : (
            <EmptyState
              icon="🚀"
              title="Create your first workspace"
              desc="Import a YouTube video, PDF, or URL to get started."
              action={
                <Link href="/import" className="px-4 py-2 rounded-xl text-sm font-bold text-white no-underline" style={{ background: '#6c63ff' }}>
                  + Import Source
                </Link>
              }
            />
          )}
        </div>

        {/* Pick up where you left off */}
        <div className="mb-6">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>
            Pick up where you left off
          </h2>
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} h={140} r={16} />)}
            </div>
          ) : data && data.workspaces.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {data.workspaces.slice(0, 3).map((ws, i) => {
                const color = WS_PALETTE[i % WS_PALETTE.length];
                return (
                  <Link
                    key={ws.id}
                    href={`/workspace/${ws.id}`}
                    className="rounded-2xl p-4 hover:shadow-md transition-all block no-underline"
                    style={{ background: '#fff', border: '1px solid #eeeef6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}1a` }}>
                        📚
                      </div>
                      <span style={{ color: '#ccc', fontSize: 16, lineHeight: 1 }}>⋯</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
                      {ws.sourceCount} source{ws.sourceCount !== 1 ? 's' : ''}
                    </p>
                    <div className="h-1 rounded-full mb-1.5" style={{ background: '#f0f0f5' }}>
                      <div className="h-full rounded-full" style={{ width: `${ws.pct}%`, background: color }} />
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: color }}>{ws.pct}%</p>
                  </Link>
                );
              })}
              {/* Browse all */}
              <Link
                href="/workspace"
                className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:shadow-md transition-all no-underline"
                style={{ background: '#fff', border: '1px dashed #ddd' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#f5f5f8' }}>+</div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Browse all</p>
                <p style={{ fontSize: 11, color: '#bbb' }}>{data.totalWorkspaces} workspace{data.totalWorkspaces !== 1 ? 's' : ''}</p>
              </Link>
            </div>
          ) : (
            <EmptyState
              icon="📂"
              title="No workspaces yet"
              desc="Create a workspace to start learning."
              action={
                <Link href="/import" className="px-4 py-2 rounded-xl text-sm font-bold text-white no-underline" style={{ background: '#6c63ff' }}>
                  + Create Workspace
                </Link>
              }
            />
          )}
        </div>

        {/* AI Modes */}
        <div className="mb-6">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>
            Learn with AI in different ways
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {[
              { id: 'teacher',        label: 'Teacher',       icon: '🧑‍🏫', color: '#6c63ff', desc: 'Ask questions and get explanations.' },
              { id: 'corrector',      label: 'Corrector',     icon: '✏️',  color: '#10b981', desc: 'Get feedback and improve your work.' },
              { id: 'quiz_hint',      label: 'Quiz Hint',     icon: '💡',  color: '#f59e0b', desc: 'Get a nudge without the answer.' },
              { id: 'roadmap_guide',  label: 'Roadmap Guide', icon: '🗺️', color: '#3b82f6', desc: 'See what to learn next and why.' },
              { id: 'problem_solver', label: 'Problem Solver',icon: '🔧',  color: '#f97316', desc: 'Solve problems step by step.' },
            ].map(m => (
              <div
                key={m.id}
                className="rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all group"
                style={{ background: '#fff', border: '1px solid #eeeef6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: `${m.color}18` }}>
                  {m.icon}
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4, marginBottom: 10 }}>{m.desc}</p>
                <span className="text-sm font-bold transition-all group-hover:translate-x-1 inline-block" style={{ color: m.color }}>→</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>
            Recent Activity
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton h={72} r={16} />
              <Skeleton h={72} r={16} />
            </div>
          ) : data && data.activity.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {data.activity.slice(0, 4).map((a, i) => {
                const color = a.type === 'quiz' ? (a.passed ? '#10b981' : '#f59e0b') : SOURCE_COLORS[a.sourceType ?? 'text'] ?? '#6c63ff';
                const icon = a.type === 'quiz' ? (a.passed ? '✅' : '📝') : SOURCE_ICONS[a.sourceType ?? 'text'] ?? '📄';
                const label = a.type === 'quiz'
                  ? `Quiz ${a.passed ? 'passed' : 'attempted'} · ${a.score}%`
                  : a.title;
                const sublabel = a.type === 'quiz' ? a.title : (a.sourceType ?? 'source');
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: '#fff', border: '1px solid #eeeef6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${color}1a` }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </p>
                      <p style={{ fontSize: 11, color: '#aaa' }}>{sublabel} · {timeAgo(a.time)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="📋" title="No activity yet" desc="Start a quiz or import a source to see your history." />
          )}
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div
        className="shrink-0 overflow-y-auto py-7 px-5"
        style={{ width: 260, borderLeft: '1px solid #f0f0f5', background: '#fff' }}
      >
        {loading ? (
          <div className="space-y-4">
            {[80, 100, 120, 140].map(h => <Skeleton key={h} h={h} r={16} />)}
          </div>
        ) : data ? (
          <>
            {/* Learning Streak */}
            <div className="mb-6">
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Learning Streak</p>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 22 }}>🔥</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#1a1a2e', lineHeight: 1 }}>
                  {data.streak.current}
                </span>
                <span style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>days</span>
              </div>

              {/* Day dots */}
              <div className="flex items-center gap-1.5 mb-3">
                {DAY_LABELS.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span style={{ fontSize: 10, color: '#aaa', fontWeight: 600 }}>{d}</span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: data.streak.last7[i] ? '#6c63ff' : '#f0f0f5' }}
                    >
                      {data.streak.last7[i] && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {data.streak.best > 0 && (
                <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                  🏆 Best: {data.streak.best} days
                </p>
              )}
            </div>

            <div className="mb-5" style={{ height: 1, background: '#f0f0f5' }} />

            {/* Today's Goal */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Today&apos;s Goal</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f0f5" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#6c63ff" strokeWidth="3"
                      strokeDasharray={`${Math.min(data.todayCheckpoints / data.todayGoal, 1) * 87.96} 87.96`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span style={{ fontSize: 10, color: '#888' }}>
                      {data.todayCheckpoints >= data.todayGoal ? '✓' : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#1a1a2e', lineHeight: 1 }}>
                    {data.todayCheckpoints} / {data.todayGoal}
                  </p>
                  <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    Checkpoints<br />today
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 8 }}>
                {data.todayCheckpoints >= data.todayGoal
                  ? '🎉 Goal reached!'
                  : data.todayCheckpoints > 0
                    ? 'Keep going! You\'re on track.'
                    : 'Start a quiz to make progress!'}
              </p>
            </div>

            <div className="mb-5" style={{ height: 1, background: '#f0f0f5' }} />

            {/* Recommended Next */}
            {data.recommended.length > 0 && (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Recommended Next</p>
                    <Link href="/workspace" style={{ fontSize: 11, color: '#6c63ff', fontWeight: 600, textDecoration: 'none' }}>
                      View all
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.recommended.map((r, i) => {
                      const color = WS_PALETTE[i % WS_PALETTE.length];
                      return (
                        <Link
                          key={r.id}
                          href={`/workspace/${r.id}`}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors no-underline"
                          style={{ border: '1px solid #f0f0f5' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${color}1a` }}>
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                            </div>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                                {r.title}
                              </p>
                              <p style={{ fontSize: 10, color: '#aaa' }}>{r.pct}% complete</p>
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <div className="mb-5" style={{ height: 1, background: '#f0f0f5' }} />
              </>
            )}

            {/* Badges / Achievements */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Achievements</p>
                <Link href="/passport" style={{ fontSize: 11, color: '#6c63ff', fontWeight: 600, textDecoration: 'none' }}>
                  View all
                </Link>
              </div>
              {data.badges.length === 0 ? (
                <div className="text-center py-4">
                  <p style={{ fontSize: 12, color: '#aaa' }}>No badges yet — complete quizzes to earn them!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.badges.slice(0, 3).map((b, i) => {
                    const color = b.type === 'master' ? '#f59e0b' : b.type === 'skill' ? '#a855f7' : '#6c63ff';
                    const icon = b.type === 'master' ? '🏆' : b.type === 'skill' ? '🥇' : '🏅';
                    return (
                      <div key={b.id} className="rounded-2xl p-3" style={{ background: '#f8f8fc', border: '1px solid #eeeef6' }}>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span style={{ fontSize: 20 }}>{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.title}
                            </p>
                            <p style={{ fontSize: 10, color: '#aaa' }}>{b.skill}</p>
                          </div>
                          <span className="text-xs font-bold shrink-0" style={{ color }}>
                            {b.score}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: '#ebebf0' }}>
                          <div className="h-full rounded-full" style={{ width: `${b.score}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : error ? (
          <p style={{ fontSize: 13, color: '#f87171', textAlign: 'center', marginTop: 24 }}>{error}</p>
        ) : null}
      </div>
    </div>
  );
}
