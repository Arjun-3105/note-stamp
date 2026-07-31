"use client";

import { motion } from "framer-motion";

export default function NFTCard({
  topic,
  txHash,
  metadataURI,
}: {
  topic: string;
  txHash: string;
  metadataURI: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 p-5 shadow-[0_20px_60px_rgba(6,182,212,0.2)]"
    >
      <h3 className="mb-2 text-lg font-semibold text-emerald-200">Proof Minted: {topic}</h3>
      <p className="mb-1 text-sm text-slate-200">Tx: {txHash}</p>
      <p className="text-xs text-slate-300">Metadata: {metadataURI}</p>
    </motion.div>
  );
}

