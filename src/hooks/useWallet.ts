"use client";

import { useEffect, useMemo, useState } from "react";

type InjectedProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type EthereumLike = InjectedProvider & { providers?: InjectedProvider[] };

export function walletProviderName(provider: InjectedProvider): string {
  if (provider.isRabby) return "Rabby";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return "Injected Wallet";
}

export function useWallet() {
  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [walletOptions, setWalletOptions] = useState<InjectedProvider[]>([]);
  const [selectedWallet, setSelectedWallet] = useState("0");
  const [error, setError] = useState("");

  const activeProvider = useMemo(() => {
    const idx = Number(selectedWallet);
    if (Number.isNaN(idx) || idx < 0 || idx >= walletOptions.length) return walletOptions[0];
    return walletOptions[idx];
  }, [selectedWallet, walletOptions]);

  useEffect(() => {
    const savedAddress = window.localStorage.getItem("learnloop_wallet_address") || "";
    const savedWalletIndex = window.localStorage.getItem("learnloop_wallet_index") || "0";
    if (savedAddress) setWalletAddress(savedAddress);
    setSelectedWallet(savedWalletIndex);

    const checkEagerConnect = async (providers: InjectedProvider[]) => {
      const idx = Number(savedWalletIndex);
      const provider = providers[idx] || providers[0];
      if (provider) {
        try {
          const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
          if (Array.isArray(accounts) && accounts[0]) {
            setWalletAddress(accounts[0]);
            window.localStorage.setItem("learnloop_wallet_address", accounts[0]);
          } else if (savedAddress) {
            // Address was disconnected in extension
            window.localStorage.removeItem("learnloop_wallet_address");
            setWalletAddress("");
          }
        } catch {}
      }
    };

    const detect = () => {
      const ethereum = (window as Window & { ethereum?: EthereumLike }).ethereum;
      if (!ethereum) return false;
      const providers = ethereum.providers && ethereum.providers.length > 0 ? ethereum.providers : [ethereum];
      setWalletOptions(providers);
      checkEagerConnect(providers);
      return true;
    };

    if (!detect()) {
      const timer = window.setInterval(() => {
        if (detect()) window.clearInterval(timer);
      }, 500);
      return () => window.clearInterval(timer);
    }
  }, []);

  useEffect(() => {
    if (!activeProvider?.on || !activeProvider?.removeListener) return;
    const onAccountsChanged = (accountsValue: unknown) => {
      const accounts = Array.isArray(accountsValue) ? (accountsValue as string[]) : [];
      const next = accounts[0] || "";
      setWalletAddress(next);
      if (next) window.localStorage.setItem("learnloop_wallet_address", next);
      else window.localStorage.removeItem("learnloop_wallet_address");
    };
    activeProvider.on("accountsChanged", onAccountsChanged);
    return () => activeProvider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [activeProvider]);

  const connectWallet = async (providerIndex?: number) => {
    try {
      setConnecting(true);
      setError("");
      const idx = providerIndex !== undefined ? providerIndex : Number(selectedWallet);
      const provider = walletOptions[idx] ?? activeProvider;
      if (!provider) {
        setError("No wallet extension found. Install MetaMask, Rabby, or Coinbase Wallet.");
        return;
      }
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (Array.isArray(accounts) && accounts[0]) {
        setWalletAddress(accounts[0]);
        window.localStorage.setItem("learnloop_wallet_address", accounts[0]);
        window.localStorage.setItem("learnloop_wallet_index", String(idx));
      }
    } catch {
      setError("Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress("");
    setError("");
    window.localStorage.removeItem("learnloop_wallet_address");
  };

  return {
    walletAddress,
    connecting,
    walletOptions,
    selectedWallet,
    setSelectedWallet,
    connectWallet,
    disconnectWallet,
    error,
  };
}
