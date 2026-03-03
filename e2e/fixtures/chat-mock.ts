import type { Page } from "@playwright/test";
import { WALLETS } from "./api-mocks";

/**
 * UIMessageStream SSE format builder for AI SDK v6.
 *
 * The Vercel AI SDK `useChat` with `DefaultChatTransport` consumes SSE:
 *   Content-Type: text/event-stream
 *   x-vercel-ai-ui-message-stream: v1
 *
 * Each event: `data: <JSON object>\n\n`
 * End of stream: `data: [DONE]\n\n`
 *
 * Part types used:
 *   start              - message start
 *   start-step         - step start
 *   text-start         - text part begin (id)
 *   text-delta         - text chunk (id, delta)
 *   text-end           - text part end (id)
 *   tool-input-start   - tool call begin (toolCallId, toolName)
 *   tool-input-delta   - tool input streaming (toolCallId, inputTextDelta)
 *   tool-input-available - tool input ready (toolCallId, toolName, input)
 *   tool-output-available - tool result (toolCallId, output)
 *   finish-step        - step end
 *   finish             - message end (finishReason)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sseEvent(obj: Record<string, any>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function sseDone(): string {
  return `data: [DONE]\n\n`;
}

function msgStart(messageId?: string): string {
  return sseEvent({ type: "start", ...(messageId ? { messageId } : {}) });
}

function stepStart(): string {
  return sseEvent({ type: "start-step" });
}

function textStart(id: string): string {
  return sseEvent({ type: "text-start", id });
}

function textDelta(id: string, delta: string): string {
  return sseEvent({ type: "text-delta", id, delta });
}

function textEnd(id: string): string {
  return sseEvent({ type: "text-end", id });
}

function toolInputStart(toolCallId: string, toolName: string): string {
  return sseEvent({ type: "tool-input-start", toolCallId, toolName });
}

function toolInputAvailable(
  toolCallId: string,
  toolName: string,
  input: unknown
): string {
  return sseEvent({ type: "tool-input-available", toolCallId, toolName, input });
}

function toolOutputAvailable(toolCallId: string, output: unknown): string {
  return sseEvent({ type: "tool-output-available", toolCallId, output });
}

function stepFinish(): string {
  return sseEvent({ type: "finish-step" });
}

function msgFinish(finishReason = "stop"): string {
  return sseEvent({ type: "finish", finishReason });
}

/** Build a complete SSE body for a "check balance" scenario */
export function checkBalanceStream(
  address = WALLETS.myAgent.address,
  eth = "0.0001",
  usdc = "10.0"
): string {
  const toolCallId = "call_check_balance_1";
  const textId = "text_1";
  const abbrev = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "check_balance"),
    toolInputAvailable(toolCallId, "check_balance", { address }),
    toolOutputAvailable(toolCallId, { success: true, address, eth, usdc }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(textId, `Balance for \`${abbrev}\`:\n- **${eth} ETH**\n- **${usdc} USDC**`),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "request faucet" (ETH or USDC) — no address param (server-side) */
export function faucetStream(
  token: "eth" | "usdc" = "eth"
): string {
  const toolCallId = "call_faucet_1";
  const textId = "text_1";
  const txHash = "0xabc123def456789012345678901234567890123456789012345678901234abcd";
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "request_faucet"),
    toolInputAvailable(toolCallId, "request_faucet", { token }),
    toolOutputAvailable(toolCallId, {
      success: true,
      token,
      transactionHash: txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(
      textId,
      `${token.toUpperCase()} received! [View on BaseScan](https://sepolia.basescan.org/tx/${txHash})`
    ),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "send payment" — no fromWalletName param (server-side) */
export function sendPaymentStream(
  toAddress = WALLETS.bob.address,
  amount = "0.00001",
  token: "eth" | "usdc" = "eth"
): string {
  const toolCallId = "call_send_1";
  const textId = "text_1";
  const txHash = "0xabc123def456789012345678901234567890123456789012345678901234abcd";
  const abbrev = `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`;
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "send_payment"),
    toolInputAvailable(toolCallId, "send_payment", {
      toAddress,
      amount,
      token,
    }),
    toolOutputAvailable(toolCallId, {
      success: true,
      from: WALLETS.myAgent.address,
      to: toAddress,
      amount,
      token,
      transactionHash: txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(
      textId,
      `Sent **${amount} ${token.toUpperCase()}** to \`${abbrev}\`. [View on BaseScan](https://sepolia.basescan.org/tx/${txHash})`
    ),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "sign message" scenario */
export function signMessageStream(
  message = "Hello CDP!",
  address = WALLETS.myAgent.address
): string {
  const toolCallId = "call_sign_1";
  const textId = "text_1";
  const mockSignature = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab1c";
  const abbrevSig = `${mockSignature.slice(0, 10)}...${mockSignature.slice(-8)}`;
  const abbrevAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "sign_message"),
    toolInputAvailable(toolCallId, "sign_message", { message }),
    toolOutputAvailable(toolCallId, {
      success: true,
      walletAddress: address,
      message,
      signature: mockSignature,
    }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(
      textId,
      `Signed with \`${abbrevAddr}\`:\n\nMessage: "${message}"\nSignature: \`${abbrevSig}\``
    ),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "buy with Stripe" scenario */
export function buyWithStripeStream(): string {
  const toolCallId = "call_stripe_buy_1";
  const textId = "text_1";
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "buy_with_stripe"),
    toolInputAvailable(toolCallId, "buy_with_stripe", {
      stripe_customer_id: "cus_mock123",
    }),
    toolOutputAvailable(toolCallId, {
      success: true,
      amount_charged: "$1.00 USD",
      payment_intent_id: "pi_mock456",
      product: "Premium AI Market Report",
      data: {
        report_id: "RPT-MOCK1234",
        title: "AI Market Analysis Report",
        executive_summary:
          "Strong bullish momentum detected across tech and DeFi sectors.",
        key_findings: [
          "AI infrastructure spending up 42% YoY",
          "Base ecosystem TVL growing at record pace",
        ],
      },
    }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(
      textId,
      `Purchased **Premium AI Market Report** for $1.00!\n\nKey findings:\n- AI infrastructure spending up 42% YoY\n- Base ecosystem TVL growing at record pace`
    ),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "buy product" scenario (x402-style payment) */
export function buyProductStream(): string {
  const toolCallId = "call_buy_1";
  const textId = "text_1";
  const txHash = "0xabc123def456789012345678901234567890123456789012345678901234abcd";
  return [
    msgStart(),
    stepStart(),
    toolInputStart(toolCallId, "buy_product"),
    toolInputAvailable(toolCallId, "buy_product", {}),
    toolOutputAvailable(toolCallId, {
      success: true,
      product: "Premium Weather Data",
      data: {
        location: "Base Sepolia Network",
        temperature: "23°C",
        condition: "Partly Cloudy",
        humidity: "62%",
        wind: "12 km/h NW",
        forecast: "Clear skies expected over the next 24 hours",
      },
      payment: {
        paid_wei: "10000000000000",
        tx_hash: txHash,
        explorer: `https://sepolia.basescan.org/tx/${txHash}`,
      },
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    }),
    stepFinish(),
    stepStart(),
    textStart(textId),
    textDelta(
      textId,
      `Purchased **Premium Weather Data** for 0.00001 ETH!\n\n- Temperature: 23°C\n- Condition: Partly Cloudy\n- Humidity: 62%\n\n[View transaction](https://sepolia.basescan.org/tx/${txHash})`
    ),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for "what is my wallet address?" — plain text response */
export function walletInfoStream(
  address = WALLETS.myAgent.address
): string {
  const textId = "text_1";
  const abbrev = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return [
    msgStart(),
    stepStart(),
    textStart(textId),
    textDelta(textId, `Your agent wallet address is \`${abbrev}\`.`),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for a general text response (no tools) */
export function generalResponseStream(text: string): string {
  const textId = "text_1";
  return [
    msgStart(),
    stepStart(),
    textStart(textId),
    textDelta(textId, text),
    textEnd(textId),
    stepFinish(),
    msgFinish(),
    sseDone(),
  ].join("");
}

/** Build SSE body for a slow response (multiple text deltas) */
export function slowResponseStream(fullText: string): string {
  const textId = "text_1";
  const words = fullText.split(" ");
  const parts: string[] = [msgStart(), stepStart(), textStart(textId)];
  for (let i = 0; i < words.length; i += 3) {
    parts.push(textDelta(textId, words.slice(i, i + 3).join(" ") + " "));
  }
  parts.push(textEnd(textId), stepFinish(), msgFinish(), sseDone());
  return parts.join("");
}

type ChatScenario =
  | "wallet-info"
  | "check-balance"
  | "faucet-eth"
  | "faucet-usdc"
  | "send-eth"
  | "send-usdc"
  | "sign-message"
  | "buy-product"
  | "buy-with-stripe"
  | "general-response"
  | "slow-response";

const scenarioBuilders: Record<ChatScenario, () => string> = {
  "wallet-info": () => walletInfoStream(),
  "check-balance": () => checkBalanceStream(),
  "faucet-eth": () => faucetStream("eth"),
  "faucet-usdc": () => faucetStream("usdc"),
  "send-eth": () =>
    sendPaymentStream(WALLETS.bob.address, "0.00001", "eth"),
  "send-usdc": () =>
    sendPaymentStream(WALLETS.bob.address, "1", "usdc"),
  "sign-message": () => signMessageStream(),
  "buy-product": () => buyProductStream(),
  "buy-with-stripe": () => buyWithStripeStream(),
  "general-response": () =>
    generalResponseStream(
      "I'm PayAgent, your AI payment assistant on Base Sepolia. How can I help?"
    ),
  "slow-response": () =>
    slowResponseStream(
      "Let me think about that for a moment. This is a longer response to test streaming behavior."
    ),
};

/**
 * Mock the /api/chat endpoint to return a predetermined SSE stream.
 * Pass a queue of scenarios to serve them in order; when exhausted, falls back to general-response.
 */
export async function mockChatRoute(
  page: Page,
  scenarios: ChatScenario | ChatScenario[]
) {
  const queue = Array.isArray(scenarios) ? [...scenarios] : [scenarios];
  let callIndex = 0;

  await page.route("**/api/chat", async (route) => {
    const scenario = queue[callIndex] ?? "general-response";
    callIndex++;
    const body = scenarioBuilders[scenario]();

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
        "x-accel-buffering": "no",
      },
      body,
    });
  });
}
