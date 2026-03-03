"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import WalletView from "@/components/WalletView";
import ChatView from "@/components/ChatView";
import BottomNav from "@/components/BottomNav";
import { useLogin3Auth } from "@/contexts/Login3AuthContext";

export interface WalletInfo {
  name: string;
  address: string;
  ethBalance?: string;
  usdcBalance?: string;
}

export type TabType = "wallet" | "chat";

export default function Home() {
  const { idToken, isLoading: authLoading, isAuthenticated, startLogin, clearSession } = useLogin3Auth();
  const { address: connectedAddress, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const idTokenRef = useRef(idToken);
  useLayoutEffect(() => { idTokenRef.current = idToken; }, [idToken]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Auto-fetch wallet on mount
  useEffect(() => {
    if (!isAuthenticated || !idToken) return;
    setWalletLoading(true);
    fetch("/api/wallet", {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setWallet(json.data);
      })
      .catch((err) => console.error("Wallet fetch error:", err))
      .finally(() => setWalletLoading(false));
  }, [isAuthenticated, idToken]);

  const refreshBalance = useCallback(async () => {
    if (!wallet || balanceLoading) return;
    setBalanceLoading(true);
    try {
      const res = await fetch(
        `/api/balance?address=${encodeURIComponent(wallet.address)}`,
        {
          headers: idTokenRef.current
            ? { Authorization: `Bearer ${idTokenRef.current}` }
            : {},
        }
      );
      const json = await res.json();
      if (json.success) {
        setWallet((prev) =>
          prev
            ? { ...prev, ethBalance: json.data.eth, usdcBalance: json.data.usdc }
            : prev
        );
      }
    } catch (err) {
      console.error("Balance refresh error:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [wallet, balanceLoading]);

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // ── Login screen ──
  if (!isAuthenticated) {
    return (
      <div
        data-testid="login-screen"
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="2" fill="white" />
            </svg>
          </div>
          <span
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            PayAgent
          </span>
        </div>
        <p
          className="text-sm text-center max-w-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Sign in to manage your agentic wallets
        </p>
        <button
          data-testid="login-button"
          onClick={startLogin}
          className="px-6 py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: "#0052FF" }}
        >
          Sign In with Login 3.0
        </button>
      </div>
    );
  }

  const abbrevAddress = wallet
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <header
        data-testid="app-header"
        className="sticky top-0 z-30 px-5 pt-4 pb-3 flex items-center justify-between"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="2" fill="white" />
            </svg>
          </div>
          <span
            data-testid="header-title"
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            PayAgent
          </span>
          {abbrevAddress && (
            <span
              data-testid="header-wallet-address"
              className="text-xs font-mono ml-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {abbrevAddress}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConnectButton
            chainStatus="icon"
            accountStatus="avatar"
            showBalance={false}
          />
          <button
            data-testid="sign-out-button"
            onClick={clearSession}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main data-testid="main-content" className="flex-1 overflow-hidden">
        <div className="max-w-lg mx-auto px-4 h-full">
          <div
            className="overflow-y-auto pb-24"
            style={{ height: "calc(100vh - 120px)", display: activeTab === "wallet" ? undefined : "none" }}
          >
            <WalletView
              wallet={wallet}
              onRefreshBalance={refreshBalance}
              loading={balanceLoading || walletLoading}
              idToken={idToken}
            />
          </div>
          <div style={{ display: activeTab === "chat" ? undefined : "none", height: "100%" }}>
            <ChatView
              onRefreshBalance={refreshBalance}
              connectedAddress={isConnected ? connectedAddress : undefined}
            />
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
