"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { walletProviderName } from "@/hooks/useWallet";

type InjectedProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  walletOptions: InjectedProvider[];
  selectedWallet: string;
  setSelectedWallet: (v: string) => void;
  connectWallet: (providerIndex?: number) => Promise<void>;
  connecting: boolean;
  error: string;
}

/* ── wallet display config ─────────────────────────────────────────────── */
const KNOWN_WALLETS = [
  {
    id: "metamask",
    name: "MetaMask",
    description: "The most popular Ethereum wallet",
    installUrl: "https://metamask.io/download/",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect width="40" height="40" rx="10" fill="#F6851B" fillOpacity="0.15"/>
        <path d="M31.9 8L22.1 15.2l1.8-4.2L31.9 8z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.1 8l9.7 7.3-1.7-4.3L8.1 8z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M28.5 26.5l-2.6 4 5.6 1.5 1.6-5.4-4.6-.1z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.9 26.6l1.6 5.4 5.6-1.5-2.6-4-4.6.1z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.8 20.2l-1.6 2.4 5.7.3-.2-6.1-3.9 3.4z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M26.2 20.2l-4-3.5-.1 6.2 5.7-.3-1.6-2.4z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14.1 30.5l3.4-1.7-3-2.3-.4 4z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22.5 28.8l3.4 1.7-.4-4-3 2.3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    check: (p: InjectedProvider) => !!p.isMetaMask && !p.isRabby,
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    description: "The next-gen wallet for DeFi users",
    installUrl: "https://rabby.io/",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect width="40" height="40" rx="10" fill="#8697FF" fillOpacity="0.15"/>
        <path d="M20 8C13.37 8 8 13.37 8 20s5.37 12 12 12 12-5.37 12-12S26.63 8 20 8z" fill="#7084FF" fillOpacity="0.3"/>
        <path d="M16 17c0-2.21 1.79-4 4-4s4 1.79 4 4v1h-8v-1z" fill="#8697FF"/>
        <path d="M13 18h14v2a7 7 0 01-14 0v-2z" fill="#8697FF"/>
        <circle cx="17" cy="21" r="1.5" fill="white"/>
        <circle cx="23" cy="21" r="1.5" fill="white"/>
      </svg>
    ),
    check: (p: InjectedProvider) => !!p.isRabby,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    description: "The easiest self-custody wallet",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect width="40" height="40" rx="10" fill="#1652F0" fillOpacity="0.15"/>
        <circle cx="20" cy="20" r="12" fill="#1652F0" fillOpacity="0.25"/>
        <path d="M20 12a8 8 0 100 16 8 8 0 000-16z" fill="#1652F0" fillOpacity="0.4"/>
        <rect x="15" y="17.5" width="10" height="5" rx="2.5" fill="#1652F0"/>
      </svg>
    ),
    check: (p: InjectedProvider) => !!p.isCoinbaseWallet,
  },
];

function getWalletConfig(provider: InjectedProvider) {
  return KNOWN_WALLETS.find((w) => w.check(provider)) ?? null;
}

/* ── shimmer line ─────────────────────────────────────────────────────── */
function ShimmerLine() {
  return (
    <div className="h-px w-full overflow-hidden bg-white/[0.06]">
      <motion.div
        className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        animate={{ x: ["-100%", "400%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export function WalletConnectModal({
  open,
  onClose,
  walletOptions,
  selectedWallet,
  setSelectedWallet,
  connectWallet,
  connecting,
  error,
}: WalletConnectModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSelect = async (idx: number) => {
    setSelectedWallet(String(idx));
    connectWallet(idx).then(onClose);
  };

  const installedCount = walletOptions.length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[9001] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl"
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Connect a wallet</h2>
                  <p className="mt-0.5 text-xs text-[#555]">
                    {installedCount > 0
                      ? `${installedCount} wallet${installedCount > 1 ? "s" : ""} detected`
                      : "No wallet extensions found"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#444] transition hover:bg-white/[0.06] hover:text-[#aaa]"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path d="M12 4 4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <ShimmerLine />

              {/* Wallet list */}
              <div className="flex flex-col gap-1.5 p-4">
                {KNOWN_WALLETS.map((wallet, i) => {
                  const providerIdx = walletOptions.findIndex((p) => wallet.check(p));
                  const isInstalled = providerIdx !== -1;
                  const isSelected = String(providerIdx) === selectedWallet;

                  return (
                    <motion.div
                      key={wallet.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.25 }}
                    >
                      {isInstalled ? (
                        <button
                          type="button"
                          onClick={() => handleSelect(providerIdx)}
                          disabled={connecting}
                          className={[
                            "group relative flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-150",
                            isSelected
                              ? "border-cyan-400/40 bg-cyan-400/[0.06]"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]",
                          ].join(" ")}
                        >
                          <span className="shrink-0">{wallet.icon}</span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-medium text-white">{wallet.name}</span>
                            <span className="text-[11px] text-[#555]">{wallet.description}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                            <span className="text-[10px] font-medium text-emerald-400">
                              {connecting && isSelected ? "Connecting…" : "Detected"}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <a
                          href={wallet.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex w-full items-center gap-3.5 rounded-xl border border-white/[0.04] bg-transparent px-4 py-3 opacity-40 transition hover:opacity-60"
                        >
                          <span className="shrink-0">{wallet.icon}</span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-medium text-white">{wallet.name}</span>
                            <span className="text-[11px] text-[#555]">{wallet.description}</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-[#444]">
                            Install
                            <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                              <path d="M2 10 10 2M5 2h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        </a>
                      )}
                    </motion.div>
                  );
                })}

                {/* Injected wallets not in KNOWN_WALLETS */}
                {walletOptions
                  .filter((p) => !KNOWN_WALLETS.some((w) => w.check(p)))
                  .map((provider, i) => {
                    const actualIdx = walletOptions.indexOf(provider);
                    const name = walletProviderName(provider);
                    return (
                      <motion.button
                        key={`unknown-${i}`}
                        type="button"
                        onClick={() => handleSelect(actualIdx)}
                        disabled={connecting}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (KNOWN_WALLETS.length + i) * 0.06 }}
                        className="flex w-full items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-base">
                          🔗
                        </span>
                        <span className="flex flex-1 flex-col">
                          <span className="text-sm font-medium text-white">{name}</span>
                          <span className="text-[11px] text-[#555]">Browser extension wallet</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                          <span className="text-[10px] font-medium text-emerald-400">Detected</span>
                        </span>
                      </motion.button>
                    );
                  })}
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-4 mb-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-[11px] text-rose-400"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="border-t border-white/[0.04] px-6 py-3">
                <p className="text-center text-[10px] text-[#818181]">
                  By connecting you agree to the{" "}
                  <span className="cursor-pointer text-[#555] underline underline-offset-2 hover:text-[#888]">
                    Terms of Service
                  </span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

