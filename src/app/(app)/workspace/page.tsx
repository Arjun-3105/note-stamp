"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { motion } from "framer-motion";
import { Workspace } from "@/lib/db/workspaces";

export default function WorkspaceListPage() {
  const { userId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/workspaces")
      .then(r => r.ok ? r.json() : Promise.reject("failed"))
      .then(d => setWorkspaces(d.workspaces || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 48 }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ height: 130, background: "rgba(255,255,255,0.03)", animation: "pulse 2s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div
        className="page-header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="page-title">My Workspaces</h1>
          <p className="page-subtitle">{workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/workspace/new" className="btn btn-primary">
          + New Workspace
        </Link>
      </motion.div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {workspaces.length === 0 ? (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontWeight: 600, fontSize: 16, color: "var(--color-text-primary)", margin: 0 }}>No workspaces yet</p>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>Create a workspace to start organising your learning</p>
          <Link href="/workspace/new" className="btn btn-primary" style={{ marginTop: 8 }}>
            Create your first workspace
          </Link>
        </motion.div>
      ) : (
        <motion.div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.$id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/workspace/${ws.$id}`} className="workspace-card">
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)", margin: 0, lineHeight: 1.3 }}>
                    {ws.title}
                  </h3>
                  <span className={`badge ${ws.status === "active" ? "badge-green" : "badge-blue"}`}>
                    {ws.status}
                  </span>
                </div>

                {ws.description && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                    {ws.description}
                  </p>
                )}

                {/* Progress */}
                <div style={{ marginTop: 16 }}>
                  <div className="progress-track">
                    <div
                      className="progress-fill green"
                      style={{ width: ws.totalUnits > 0 ? `${(ws.completedUnits / ws.totalUnits) * 100}%` : "0%" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
                    <span>{ws.sourceCount} source{ws.sourceCount !== 1 ? "s" : ""}</span>
                    <span>{ws.completedUnits}/{ws.totalUnits} units</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
