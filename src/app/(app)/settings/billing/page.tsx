"use client";
import React, { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { motion } from "framer-motion";
import Link from "next/link";

const FREE_FEATURES = [
  "1 workspace",
  "20 AI generations / mo",
  "50 assistant messages / mo",
  "2 PDF uploads / mo",
  "1 badge mint",
  "3 sources per workspace",
];
const PRO_FEATURES = [
  "Unlimited workspaces",
  "1,000 AI generations / mo",
  "2,500 assistant messages / mo",
  "100 PDF uploads / mo",
  "50 badge mints",
  "20 sources per workspace",
  "Advanced AI models (Claude Sonnet)",
  "Priority support",
];

export default function BillingPage() {
  const { plan, loading } = usePlan();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // handle error
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
    } finally {
      setPortalLoading(false);
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
      <motion.div className="page-header" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Billing &amp; Plans</h1>
        <p className="page-subtitle">Your current plan and available upgrades.</p>
      </motion.div>

      {/* Current plan banner */}
      <motion.div
        className="card"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 32 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", marginBottom: 4 }}>Active Plan</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", textTransform: "capitalize" }}>{plan || "free"}</span>
            <span className={`badge ${plan === "pro" ? "badge-green" : "badge-blue"}`}>
              {plan === "pro" ? "✓ Active" : "Free tier"}
            </span>
          </div>
        </div>
        <div>
          {plan === "pro" ? (
            <button onClick={handleManage} disabled={portalLoading} className="btn btn-secondary">
              {portalLoading ? "Loading..." : "Manage Subscription"}
            </button>
          ) : (
            <button onClick={handleUpgrade} disabled={checkoutLoading} className="btn btn-primary">
              {checkoutLoading ? "Redirecting..." : "Upgrade to Pro — ₹499/mo"}
            </button>
          )}
        </div>
      </motion.div>

      {/* Plans comparison */}
      <motion.div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 700 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Free */}
        <div className="card" style={{ opacity: plan === "pro" ? 0.6 : 1 }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)", marginBottom: 4 }}>Free</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
            ₹0<span style={{ fontSize: 14, fontWeight: 400, color: "var(--color-text-muted)" }}>/mo</span>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {FREE_FEATURES.map(f => <FeatureItem key={f} text={f} />)}
          </ul>
          {plan !== "pro" && <div style={{ marginTop: 20 }}><span className="badge badge-blue">Your plan</span></div>}
        </div>

        {/* Pro */}
        <div className="card" style={{ borderColor: "var(--color-brand)", boxShadow: "0 0 0 1px var(--color-brand), var(--shadow-card)" }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: "var(--color-brand)", marginBottom: 4 }}>Pro</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
            ₹499<span style={{ fontSize: 14, fontWeight: 400, color: "var(--color-text-muted)" }}>/mo</span>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {PRO_FEATURES.map(f => <FeatureItem key={f} text={f} highlight />)}
          </ul>
          {plan === "pro" ? (
            <div style={{ marginTop: 20 }}><span className="badge badge-green">✓ Current plan</span></div>
          ) : (
            <button onClick={handleUpgrade} disabled={checkoutLoading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }}>
              {checkoutLoading ? "..." : "Upgrade Now"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function FeatureItem({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, flexShrink: 0, color: highlight ? "var(--color-success)" : "var(--color-text-muted)" }}>
        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ color: "var(--color-text-secondary)" }}>{text}</span>
    </li>
  );
}
