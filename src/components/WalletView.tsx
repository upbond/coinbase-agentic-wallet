"use client";

import { useState } from "react";
import type { WalletInfo } from "@/app/page";

interface WalletViewProps {
  wallet: WalletInfo | null;
  onRefreshBalance: () => void;
  loading: boolean;
  idToken: string | null;
}

function formatBalance(val: string | undefined): string {
  if (!val) return "0.00";
  const n = parseFloat(val);
  if (n === 0) return "0.00";
  if (n < 0.0001) return "<0.0001";
  return n.toFixed(4);
}

export default function WalletView({
  wallet,
  onRefreshBalance,
  loading,
  idToken,
}: WalletViewProps) {
  const [faucetLoading, setFaucetLoading] = useState<string | null>(null);
  const [faucetResult, setFaucetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-dismiss notifications after 5 seconds
  const autoDismiss = (clearFn: () => void) => {
    setTimeout(() => clearFn(), 5000);
  };

  const handleFaucet = async (token: "eth" | "usdc") => {
    if (!wallet) return;
    setFaucetLoading(token);
    setFaucetResult(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      const result = {
        success: json.success,
        message: json.success
          ? `${token.toUpperCase()} received!`
          : (json.error || "Faucet request failed. You may be rate limited."),
      };
      setFaucetResult(result);
      autoDismiss(() => setFaucetResult(null));
      if (json.success) onRefreshBalance();
    } catch (err) {
      const result = {
        success: false,
        message: err instanceof Error ? err.message : "Network error. Please try again.",
      };
      setFaucetResult(result);
      autoDismiss(() => setFaucetResult(null));
    } finally {
      setFaucetLoading(null);
    }
  };

  const ethDisplay = formatBalance(wallet?.ethBalance);
  const usdcDisplay = wallet?.usdcBalance
    ? (parseFloat(wallet.usdcBalance) === 0 ? "0.00" : parseFloat(wallet.usdcBalance).toFixed(2))
    : "0.00";

  return (
    <div data-testid="wallet-view" className="animate-fade-in">
      {/* Balance Hero */}
      <div
        className="mx-1 mt-2 rounded-2xl p-6 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0052FF 0%, #1a3a8a 50%, #0d1117 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 30% 20%, white 0%, transparent 60%)" }} />
        <p data-testid="total-balance" className="text-xs font-medium tracking-wide uppercase mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          {wallet ? "Wallet Balance" : "Total Balance"}
        </p>
        <div data-testid="total-balances" className="flex justify-center gap-6 mb-1">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">{ethDisplay}</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>ETH</p>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">{usdcDisplay}</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>USDC</p>
          </div>
        </div>
        <p data-testid="wallet-count" className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
          {wallet ? "1 wallet" : "0 wallets"} &middot; Base Sepolia
        </p>

        {/* Quick Actions */}
        <div className="flex justify-center gap-6">
          {wallet && (
            <button
              onClick={onRefreshBalance}
              disabled={loading}
              className="flex flex-col items-center gap-1.5 transition-opacity"
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <span className={`w-10 h-10 rounded-full flex items-center justify-center ${loading ? "spinner" : ""}`} style={{ background: "rgba(255,255,255,0.15)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </span>
              <span className="text-[10px] text-white/70">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Wallet Card */}
      <div className="mt-5 mx-1 space-y-2">
        {!wallet ? (
          <div data-testid="wallets-empty" className="text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--accent-bg)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="14" rx="3" />
                <path d="M2 10h20" />
                <path d="M6 6V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {loading ? "Loading wallet..." : "No wallet yet"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              {loading ? "Please wait" : "Your wallet will be created automatically"}
            </p>
          </div>
        ) : (
          <div
            data-testid={`wallet-card-${wallet.address}`}
            className="rounded-xl p-4 transition-all duration-200 cursor-pointer animate-slide-up"
            style={{
              background: expanded ? "var(--bg-tertiary)" : "var(--bg-secondary)",
              border: `1px solid ${expanded ? "var(--accent)" : "var(--border)"}`,
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {/* Wallet Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: `hsl(${wallet.name.charCodeAt(0) * 7 % 360}, 60%, 45%)` }}
                >
                  {wallet.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {wallet.name}
                  </p>
                  <p className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRefreshBalance(); }}
                disabled={loading}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-tertiary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "spinner" : ""}>
                  <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </button>
            </div>

            {/* Balances */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg p-2.5" style={{ background: "var(--bg-primary)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-tertiary)" }}>ETH</p>
                <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                  {formatBalance(wallet.ethBalance)}
                </p>
              </div>
              <div className="flex-1 rounded-lg p-2.5" style={{ background: "var(--bg-primary)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-tertiary)" }}>USDC</p>
                <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                  {formatBalance(wallet.usdcBalance)}
                </p>
              </div>
            </div>

            {/* Expanded: Faucet Actions */}
            {expanded && (
              <div data-testid={`faucet-section-${wallet.address}`} className="mt-3 pt-3 animate-slide-up" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                  Faucet
                </p>
                <div className="flex gap-2">
                  {(["eth", "usdc"] as const).map((token) => {
                    const isLoading = faucetLoading === token;
                    return (
                      <button
                        key={token}
                        data-testid={`faucet-${token}-${wallet.address}`}
                        onClick={(e) => { e.stopPropagation(); handleFaucet(token); }}
                        disabled={!!faucetLoading}
                        className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-40"
                        style={{
                          background: "var(--accent-bg)",
                          color: "var(--accent-light)",
                          border: "1px solid rgba(0,82,255,0.2)",
                        }}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full spinner" />
                          </span>
                        ) : (
                          `Get ${token.toUpperCase()}`
                        )}
                      </button>
                    );
                  })}
                </div>
                {faucetResult && (
                  <div
                    data-testid={`faucet-result-${wallet.address}`}
                    className="mt-2 px-3 py-2 rounded-lg text-xs animate-slide-up flex items-center justify-between"
                    style={{
                      background: faucetResult.success ? "var(--success-bg)" : "var(--danger-bg)",
                      color: faucetResult.success ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    <span>{faucetResult.message}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFaucetResult(null); }}
                      className="ml-2 p-1 rounded hover:opacity-70"
                      aria-label="Dismiss"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
