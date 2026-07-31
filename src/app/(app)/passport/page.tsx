"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import { PassportView, Badge } from "@/components/badges/PassportView";

export default function PassportPage() {
  const { userId } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mintingBadgeId, setMintingBadgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/badges")
      .then(r => r.ok ? r.json() : Promise.reject("failed"))
      .then(d => setBadges(d.badges || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleMintClick = async (badge: Badge) => {
    if (badge.tokenId) return;
    setMintingBadgeId(badge.$id);
    try {
      const res = await fetch(`/api/badges/${badge.$id}/mint`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to mint badge");
      }
      const d = await res.json();
      // Refresh badges list
      const refresh = await fetch("/api/badges");
      if (refresh.ok) setBadges((await refresh.json()).badges || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMintingBadgeId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--color-border)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin-slow 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div className="page-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Learning Passport</h1>
        <p className="page-subtitle">Your verifiable record of skills and achievements on-chain.</p>
      </motion.div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Passport view */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ marginBottom: 24 }}
      >
        <PassportView
          badges={badges}
          userId={userId || ""}
          onMintClick={handleMintClick}
          loading={mintingBadgeId !== null}
        />
      </motion.div>

      {/* Info section */}
      <motion.div
        className="card"
        style={{ borderLeft: "3px solid var(--color-brand)" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 12 }}>How badges work</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Micro Badges", desc: "Earned by completing individual sources (videos, articles, etc.)" },
            { label: "Skill Badges", desc: "Earned by mastering all sources in a workspace and passing the quiz." },
            { label: "Master Certificates", desc: "Earned by completing your entire learning journey with excellence." },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-brand)", marginTop: 7, flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>{item.label}: </span>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
