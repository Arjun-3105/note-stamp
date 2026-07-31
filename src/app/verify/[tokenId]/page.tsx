"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

export default function VerifyPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const [certData, setCertData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;
    fetch(`/api/nft/verify/${tokenId}`)
      .then(r => {
        if (!r.ok) throw new Error("Certificate not found or invalid token.");
        return r.json();
      })
      .then(setCertData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tokenId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg-base)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", marginBottom: 40 }}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--color-brand-light)", color: "var(--color-brand)",
          padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
          marginBottom: 16,
        }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Blockchain Verified
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Credential Verification
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", marginTop: 6 }}>
          Token ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{tokenId}</span>
        </p>
      </motion.div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, border: "3px solid var(--color-border)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin-slow 0.8s linear infinite" }} />
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Querying blockchain…</p>
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card"
          style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
        >
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 28, height: 28, color: "#f87171" }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 style={{ fontWeight: 700, fontSize: 18, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Verification Failed</h2>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>{error}</p>
        </motion.div>
      ) : certData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card"
          style={{ maxWidth: 460, width: "100%" }}
        >
          {/* Icon */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--color-brand-light)", border: "2px solid var(--color-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width: 36, height: 36, color: "var(--color-brand)" }}>
                <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-success)", marginBottom: 6 }}>
              ✓ Valid Credential
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
              {certData.title || "Learning Badge"}
            </h2>
            <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>{certData.skill || "General"}</p>
          </div>

          <div className="divider" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 4 }}>Score</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{certData.score ?? "—"}%</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 4 }}>Issued</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", paddingTop: 4 }}>
                {certData.mintedAt ? new Date(certData.mintedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
