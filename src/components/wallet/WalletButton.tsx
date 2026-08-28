"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { WalletConnectModal } from "@/components/wallet/WalletConnectModal";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type Variant = "header" | "hero" | "compact" | "card";

const variantStyles: Record<Variant, string> = {
  header: "px-4 py-2 rounded-[12px] text-[13px] font-bold",
  hero: "px-6 py-3.5 rounded-[12px] text-[14px] font-bold shadow-sm",
  compact: "px-3 py-1.5 rounded-full text-xs font-bold",
  card: "px-4 py-2.5 rounded-xl text-sm font-bold w-full",
};

export function WalletButton({
  variant = "header",
  labelConnected = "",
  labelConnect = "Connect Wallet",
  className = "",
  showAddress = true,
}: {
  variant?: Variant;
  labelConnected?: string;
  labelConnect?: string;
  className?: string;
  showAddress?: boolean;
}) {
  const {
    walletAddress,
    connecting,
    walletOptions,
    selectedWallet,
    setSelectedWallet,
    connectWallet,
    disconnectWallet,
    error,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = !!walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress);

  const copy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  if (isConnected && showAddress) {
    return (
      <>
        <div
          className={`inline-flex items-center gap-2 border ${variant === "card" ? "bg-white border-[#e5e7eb]" : variant === "compact" ? "bg-white border-[#e5e7eb]" : "bg-white border-[#e5e7eb]"} ${variantStyles[variant]} ${className}`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] shrink-0" />
          <span className="font-mono truncate" title={walletAddress}>
            {labelConnected || truncateAddr(walletAddress)}
          </span>
          <button
            onClick={copy}
            className="ml-1 px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb] transition text-[11px] font-bold"
            aria-label="Copy address"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={disconnectWallet}
            className="ml-1 text-[#9ca3af] hover:text-[#111827] text-[11px] underline underline-offset-2"
          >
            Disconnect
          </button>
        </div>
        {error && <p className="text-[11px] text-amber-600 mt-1">{error}</p>}
      </>
    );
  }

  if (isConnected && !showAddress) {
    return (
      <div className={`inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 ${variantStyles[variant]} ${className}`}>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {truncateAddr(walletAddress)}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={connecting}
        className={`inline-flex items-center justify-center gap-2 bg-[#6c63ff] hover:bg-[#5a52e6] text-white transition disabled:opacity-50 ${variantStyles[variant]} ${className}`}
      >
        {connecting ? (
          <>
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <span className="text-base leading-none">🦊</span>
            {labelConnect}
          </>
        )}
      </button>
      <WalletConnectModal
        open={open}
        onClose={() => setOpen(false)}
        walletOptions={walletOptions}
        selectedWallet={selectedWallet}
        setSelectedWallet={setSelectedWallet}
        connectWallet={connectWallet}
        connecting={connecting}
        error={error}
      />
    </>
  );
}

export function WalletBadge({ className = "" }: { className?: string }) {
  const { walletAddress } = useWallet();
  const isConnected = !!walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
  if (!isConnected) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] font-bold ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {truncateAddr(walletAddress)} • Sepolia
    </span>
  );
}

export function WalletInlineStatus() {
  const { walletAddress, connecting } = useWallet();
  if (connecting) return <span className="text-xs text-[#6b7280]">Connecting wallet…</span>;
  if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {truncateAddr(walletAddress)} linked
      </span>
    );
  }
  return <span className="text-xs text-[#9ca3af]">No wallet linked</span>;
}
