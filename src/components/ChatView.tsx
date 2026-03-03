"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, FormEvent } from "react";
import { useLogin3Auth } from "@/contexts/Login3AuthContext";
import { loadStripe } from "@stripe/stripe-js";

interface CardSummary {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface ChatViewProps {
  onRefreshBalance: () => void;
  connectedAddress?: string;
}

// Helper to extract tool name from part type (e.g., "tool-check_balance" → "check_balance")
function getToolName(partType: string): string | null {
  if (partType.startsWith("tool-")) return partType.slice(5);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPart = any;

export default function ChatView({
  onRefreshBalance,
  connectedAddress,
}: ChatViewProps) {
  const { idToken } = useLogin3Auth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  // Stripe state
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<CardSummary | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Keep refs so the transport body/headers always have latest data
  const connectedRef = useRef(connectedAddress);
  const idTokenRef = useRef(idToken);
  const stripeCustomerIdRef = useRef(stripeCustomerId);

  // Update refs in useLayoutEffect to avoid lint errors about accessing refs during render
  useLayoutEffect(() => {
    connectedRef.current = connectedAddress;
    idTokenRef.current = idToken;
    stripeCustomerIdRef.current = stripeCustomerId;
  }, [connectedAddress, idToken, stripeCustomerId]);

  // Fetch card info from Stripe
  const fetchCardInfo = useCallback(async (customerId: string) => {
    if (!idTokenRef.current) return;
    try {
      const res = await fetch(
        `/api/stripe/payment-status?customer_id=${encodeURIComponent(customerId)}`,
        { headers: { Authorization: `Bearer ${idTokenRef.current}` } }
      );
      const json = await res.json();
      if (json.has_payment_method && json.card_summary) {
        setCardInfo(json.card_summary);
      }
    } catch {
      // ignore
    }
  }, []);

  // Handle Stripe setup redirect on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupResult = params.get("stripe_setup");
    const customerId = params.get("customer_id");

    if (setupResult === "success" && customerId) {
      localStorage.setItem("stripe_customer_id", customerId);
      setStripeCustomerId(customerId);
      window.history.replaceState({}, "", "/");
      fetchCardInfo(customerId);
    } else {
      const saved = localStorage.getItem("stripe_customer_id");
      if (saved) {
        setStripeCustomerId(saved);
        fetchCardInfo(saved);
      }
    }
  }, [fetchCardInfo]);

  // Handle "Add Card" click
  const handleAddCard = async () => {
    if (!idToken || setupLoading) return;
    setSetupLoading(true);
    try {
      const res = await fetch("/api/stripe/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      const json = await res.json();
      if (json.success && json.url) {
        window.location.href = json.url;
      }
    } catch {
      // ignore
    } finally {
      setSetupLoading(false);
    }
  };

  // Handle 3DS popup
  const handle3DS = useCallback(async (clientSecret: string, paymentIntentId: string) => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) return;

    const stripeJs = await loadStripe(publishableKey);
    if (!stripeJs) return;

    const { error } = await stripeJs.handleCardAction(clientSecret);
    if (error) {
      sendMessage({
        text: `3D Secure authentication failed: ${error.message}. The payment was not completed.`,
      });
    } else {
      sendMessage({
        text: `3D Secure authentication complete. Please verify the payment with intent ID: ${paymentIntentId}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        headers: () => ({
          ...(idTokenRef.current
            ? { Authorization: `Bearer ${idTokenRef.current}` }
            : {}),
        }),
        body: () => ({
          connectedAddress: connectedRef.current,
          stripeCustomerId: stripeCustomerIdRef.current ?? undefined,
        }),
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Track which tool outputs we've already processed to avoid re-firing side effects
  const processedToolsRef = useRef<Set<string>>(new Set());

  const handleToolOutput = useCallback(
    (toolKey: string, toolName: string, output: unknown) => {
      if (processedToolsRef.current.has(toolKey)) return;
      processedToolsRef.current.add(toolKey);

      if (toolName === "check_balance" || toolName === "request_faucet" || toolName === "send_payment" || toolName === "buy_product") {
        onRefreshBalance();
      }

      // Handle 3DS requirement from buy_with_stripe
      if (toolName === "buy_with_stripe" && output && typeof output === "object") {
        const data = output as Record<string, unknown>;
        if (
          data.requires_stripe_action &&
          typeof data.client_secret === "string" &&
          typeof data.payment_intent_id === "string"
        ) {
          handle3DS(data.client_secret, data.payment_intent_id);
        }
      }
    },
    [onRefreshBalance, handle3DS]
  );

  // Sync balance refreshes and 3DS from tool calls
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (const part of msg.parts) {
        const toolName = getToolName(part.type);
        if (!toolName) continue;
        const p = part as AnyPart;

        if (p.state === "output-available") {
          const toolKey = `${msg.id}-${toolName}-${p.toolCallId ?? ""}`;
          handleToolOutput(toolKey, toolName, p.output);
        }
      }
    }
  }, [messages, handleToolOutput]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    sendMessage({ text });
  };

  const handleSuggestion = (text: string) => {
    setInput("");
    sendMessage({ text });
  };

  return (
    <div data-testid="chat-view" className="animate-fade-in flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      {/* Messages */}
      <div data-testid="messages-container" ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-3 space-y-3">
        {messages.length === 0 && (
          <div data-testid="chat-welcome" className="text-center py-12">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--accent-bg)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              PayAgent
            </h3>
            <p className="text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
              Your AI payment assistant on Base Sepolia
            </p>

            {/* Stripe card info */}
            {cardInfo && (
              <div
                data-testid="card-info"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 text-xs"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                {cardInfo.brand} ****{cardInfo.last4}
              </div>
            )}

            {/* Add Card button */}
            {!cardInfo && (
              <button
                data-testid="add-card-button"
                onClick={handleAddCard}
                disabled={setupLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-4 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {setupLoading ? "Redirecting..." : "+ Add Card"}
              </button>
            )}

            {/* Quick Actions */}
            <div className="space-y-2 max-w-xs mx-auto">
              {[
                "What is my wallet address?",
                "Check my balance",
                "Get testnet ETH from faucet",
              ].map((suggestion, index) => (
                <button
                  key={suggestion}
                  data-testid={`suggestion-${index}`}
                  onClick={() => handleSuggestion(suggestion)}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all duration-200"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          if (message.role !== "user" && message.role !== "assistant") return null;

          // Extract text content and tool parts
          const textParts: string[] = [];
          const toolParts: { name: string; state: string; result?: unknown }[] = [];

          if (message.parts) {
            for (const part of message.parts) {
              if (part.type === "text" && (part as AnyPart).text) {
                textParts.push((part as AnyPart).text);
              }
              const toolName = getToolName(part.type);
              if (toolName) {
                const p = part as AnyPart;
                toolParts.push({
                  name: toolName,
                  state: p.state,
                  result: p.state === "output-available" ? p.output : undefined,
                });
              }
            }
          }

          const textContent = textParts.join("");
          const isUser = message.role === "user";

          return (
            <div key={message.id}>
              {/* Tool indicators */}
              {toolParts.map((tp, i) => (
                <div key={`${message.id}-tool-${i}`} data-testid={`tool-indicator-${tp.name}`} className="flex justify-start mb-1.5">
                  <div
                    className="px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5"
                    style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {tp.state === "output-available" ? (
                      <svg data-testid="tool-checkmark" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : tp.state === "output-error" ? (
                      <svg data-testid="tool-error" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error, red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    ) : (
                      <span data-testid="tool-spinner" className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full spinner" />
                    )}
                    {tp.name.replace(/_/g, " ")}
                  </div>
                </div>
              ))}

              {/* Text bubble */}
              {textContent && (
                <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isUser ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                    style={{
                      background: isUser ? "var(--accent)" : "var(--bg-secondary)",
                      color: isUser ? "white" : "var(--text-primary)",
                      border: isUser ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <MessageContent content={textContent} />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading */}
        {isLoading && messages.length > 0 && (() => {
          const lastMsg = messages[messages.length - 1];
          const hasActiveToolCall = lastMsg?.parts?.some((p: AnyPart) => {
            const tn = getToolName(p.type);
            return tn && p.state !== "output-available" && p.state !== "output-error";
          });
          return !hasActiveToolCall;
        })() && (
          <div data-testid="chat-loading" className="flex justify-start animate-slide-up">
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-md"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--accent)", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--accent)", animationDelay: "200ms" }} />
                <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--accent)", animationDelay: "400ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex justify-start animate-slide-up">
            <div
              className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm"
              style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}
            >
              {error?.message || "An error occurred. Please try again."}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-1 pb-2 pt-2">
        <form
          data-testid="chat-form"
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-xl p-1.5"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message PayAgent..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            data-testid="chat-submit"
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-20"
            style={{ background: "var(--accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const parts = content.split(/(https:\/\/sepolia\.basescan\.org\/tx\/\S+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("https://sepolia.basescan.org")) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              className="underline break-all" style={{ color: "var(--accent-light)" }}>
              View on BaseScan
            </a>
          );
        }
        const codeParts = part.split(/(`[^`]+`)/g);
        return codeParts.map((cp, j) => {
          if (cp.startsWith("`") && cp.endsWith("`")) {
            return (
              <code key={`${i}-${j}`} className="px-1 py-0.5 rounded text-xs font-mono"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                {cp.slice(1, -1)}
              </code>
            );
          }
          const boldParts = cp.split(/(\*\*[^*]+\*\*)/g);
          return boldParts.map((bp, k) => {
            if (bp.startsWith("**") && bp.endsWith("**")) {
              return <strong key={`${i}-${j}-${k}`}>{bp.slice(2, -2)}</strong>;
            }
            return <span key={`${i}-${j}-${k}`}>{bp}</span>;
          });
        });
      })}
    </>
  );
}
