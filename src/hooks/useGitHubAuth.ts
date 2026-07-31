"use client";

import { useCallback, useEffect, useState } from "react";

export type GitHubUser = {
  login:            string;
  name:             string;
  avatar_url:       string;
  bio:              string | null;
  location:         string | null;
  company:          string | null;
  blog:             string | null;
  twitter_username: string | null;
  public_repos:     number;
  followers:        number;
  following:        number;
  html_url:         string;
};

const CACHE_KEY = "ll_gh_user";

function readCache(): GitHubUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GitHubUser) : null;
  } catch { return null; }
}
function writeCache(u: GitHubUser) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(u)); } catch {}
}
function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export function useGitHubAuth() {
  // Initialise from cache immediately — no loading flash
  const [user, setUser]       = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Serve cache first so UI is instant
    const cached = readCache();
    if (cached) { setUser(cached); setLoading(false); }

    try {
      const res  = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json() as { user: GitHubUser | null };
      if (data.user) {
        setUser(data.user);
        writeCache(data.user);
      } else {
        setUser(null);
        clearCache();
      }
    } catch {
      // Keep cached value on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = () => { window.location.href = "/api/auth/github"; };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCache();
    setUser(null);
  };

  return { user, loading, signIn, signOut, refresh };
}

