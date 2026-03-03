import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { isAddress, parseEther } from "viem";
import { getCdpClient } from "@/lib/cdp";
import { publicClient } from "@/lib/viem";
import { getBalances } from "@/lib/balance";
import { executeTransfer } from "@/lib/transfer";
import { authenticateRequest } from "@/lib/auth";
import {
  PAYMENT_REQUIREMENTS,
  MERCHANT_ADDRESS,
  verifyPayment,
  buildProduct,
} from "@/lib/shop";

export const maxDuration = 60;

// Helper to get required env vars (validated at runtime, not build time)
function getEnvConfig() {
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
  const ANTHROPIC_AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!ANTHROPIC_BASE_URL || !ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      "Missing ANTHROPIC_BASE_URL or ANTHROPIC_AUTH_TOKEN. Set them in .env.local"
    );
  }
  return { ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN };
}

// Proxy mangles tool names in streaming: check_balance → CheckBalance_tool
// Build reverse mapping to fix them in the SSE stream
const TOOL_NAMES = [
  "check_balance",
  "request_faucet",
  "send_payment",
  "sign_message",
  "buy_product",
];

function snakeToPascalTool(snake: string): string {
  return (
    snake
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("") + "_tool"
  );
}

const MANGLED_TO_ORIGINAL: Record<string, string> = {};
for (const name of TOOL_NAMES) {
  MANGLED_TO_ORIGINAL[snakeToPascalTool(name)] = name;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProxyMessage = any;

// Fix proxy issue: when the AI SDK sends multiple tool results at once,
// the proxy fails to translate them to Anthropic format (400 error).
// We restructure the messages so each tool call/result is a separate pair.
function fixParallelToolResults(body: string): string {
  try {
    const json = JSON.parse(body);
    const messages: ProxyMessage[] = json.messages;
    if (!messages) return body;

    const fixed: ProxyMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Check if this is an assistant message with multiple tool_calls
      if (
        msg.role === "assistant" &&
        Array.isArray(msg.tool_calls) &&
        msg.tool_calls.length > 1
      ) {
        // Collect all following tool messages
        const toolResults: ProxyMessage[] = [];
        let j = i + 1;
        while (j < messages.length && messages[j].role === "tool") {
          toolResults.push(messages[j]);
          j++;
        }

        // Split into individual assistant+tool pairs
        for (const toolCall of msg.tool_calls) {
          const matchingResult = toolResults.find(
            (tr: ProxyMessage) => tr.tool_call_id === toolCall.id
          );
          fixed.push({
            role: "assistant",
            content: null,
            tool_calls: [toolCall],
          });
          if (matchingResult) {
            fixed.push(matchingResult);
          }
        }

        // Skip the tool messages we already processed
        i = j - 1;
        continue;
      }

      fixed.push(msg);
    }

    json.messages = fixed;
    return JSON.stringify(json);
  } catch {
    return body;
  }
}

// Custom fetch that fixes proxy quirks:
// 1. Request: Split parallel tool results into sequential pairs
// 2. Response: Fix mangled tool names (CheckBalance_tool → check_balance)
// 3. Response: Fix wrong tool_calls index (1 → 0)
function createFixedFetch(): typeof globalThis.fetch {
  return async (input, init) => {
    // Fix the request body if it contains parallel tool results
    if (init?.body) {
      const bodyStr =
        typeof init.body === "string"
          ? init.body
          : new TextDecoder().decode(init.body as BufferSource);
      const fixedBody = fixParallelToolResults(bodyStr);
      init = { ...init, body: fixedBody };
    }

    const res = await globalThis.fetch(input, init);
    if (!res.body) return res;

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        let text = new TextDecoder().decode(chunk);

        // Fix mangled tool names
        for (const [mangled, original] of Object.entries(MANGLED_TO_ORIGINAL)) {
          text = text.replaceAll(`"${mangled}"`, `"${original}"`);
        }

        // Fix tool_calls index: proxy sends index:1 instead of 0
        if (text.includes("tool_calls")) {
          text = text.replace(/"index":1/g, '"index":0');
        }

        controller.enqueue(new TextEncoder().encode(text));
      },
    });

    return new Response(res.body.pipeThrough(transformStream), {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

function isValidAddress(addr: string): addr is `0x${string}` {
  return isAddress(addr, { strict: false });
}

function buildSystemPrompt(
  agentWalletName: string,
  agentWalletAddress: string,
  connectedAddress: string | undefined
): string {
  let walletSection = "";
  if (connectedAddress) {
    walletSection += `Connected browser wallet: ${connectedAddress}\n`;
  }
  walletSection += `Agent wallet: "${agentWalletName}" (${agentWalletAddress})`;

  return `You are PayAgent, an AI payment assistant on Base Sepolia testnet.

=== USER'S WALLETS (you know this) ===
${walletSection}
=== END WALLETS ===

When the user asks "what wallets do I have", "my address", "my wallet", or similar, answer using the wallet info above. Never say you don't have this info.

Tools available:
- check_balance: Check ETH and USDC balance of a wallet
- send_payment: Send ETH or USDC from the user's agent wallet to any address
- request_faucet: Get testnet ETH or USDC from the faucet
- sign_message: Sign an arbitrary text message with the user's agent wallet (EIP-191)
- buy_product: Purchase premium weather data using x402-style ETH payment (costs ${PAYMENT_REQUIREMENTS.price_eth} ETH)

Guidelines:
- IMPORTANT: Call only ONE tool at a time. Never make parallel/simultaneous tool calls. If you need multiple operations (e.g., request both ETH and USDC), call them one at a time sequentially.
- Be concise and friendly. Use short responses.
- Always confirm the details before sending a payment (amount, token, recipient).
- When showing addresses, abbreviate them (0x1234...abcd).
- The user has exactly one agent wallet. Use it for all operations.
- Proactively suggest getting faucet funds if the wallet has zero balance.
- After successful transactions, share the BaseScan explorer link.
- You work on Base Sepolia testnet - remind users this is testnet if they seem confused about real funds.
- Format currency amounts nicely (e.g., "0.001 ETH", "5.00 USDC").`;
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req.headers.get("authorization"));
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages: uiMessages, connectedAddress } = await req.json();
    const modelMessages = await convertToModelMessages(uiMessages);

    const sanitizedConnectedAddress =
      typeof connectedAddress === "string" && isValidAddress(connectedAddress)
        ? connectedAddress
        : undefined;

    const systemPrompt = buildSystemPrompt(
      user.agentWalletName,
      user.agentWalletAddress,
      sanitizedConnectedAddress
    );

    // Inject wallet context into the first user message as a hidden prefix,
    // because some proxies strip or ignore system messages.
    let walletContext = "";
    if (sanitizedConnectedAddress) {
      walletContext += `[Context: User's connected browser wallet is ${sanitizedConnectedAddress}] `;
    }
    walletContext += `[Context: User's agent wallet is "${user.agentWalletName}" at ${user.agentWalletAddress}] `;
    if (walletContext && modelMessages.length > 0) {
      const first = modelMessages[0];
      if (first.role === "user" && Array.isArray(first.content)) {
        const textPart = first.content.find(
          (p: { type: string }) => p.type === "text"
        ) as { type: string; text: string } | undefined;
        if (textPart) {
          textPart.text = walletContext + textPart.text;
        }
      }
    }

    const { ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN } = getEnvConfig();
    const provider = createOpenAI({
      baseURL: ANTHROPIC_BASE_URL + "/v1",
      apiKey: ANTHROPIC_AUTH_TOKEN,
      fetch: createFixedFetch(),
    });

    const tools = {
      check_balance: {
        description:
          "Check the ETH and USDC balance of a wallet address on Base Sepolia",
        inputSchema: z.object({
          address: z.string().describe("The wallet address to check"),
        }),
        execute: async ({ address }: { address: string }) => {
          if (!isValidAddress(address)) {
            return { success: false, error: "Invalid address format" };
          }
          const balances = await getBalances(address);
          return {
            success: true,
            address,
            ...balances,
          };
        },
      },

      request_faucet: {
        description:
          "Request testnet ETH or USDC from the Base Sepolia faucet for the user's agent wallet",
        inputSchema: z.object({
          token: z.enum(["eth", "usdc"]).describe("Which token to request"),
        }),
        execute: async ({ token }: { token: "eth" | "usdc" }) => {
          const cdp = getCdpClient();
          const { transactionHash } = await cdp.evm.requestFaucet({
            address: user.agentWalletAddress,
            network: "base-sepolia",
            token,
          });
          await publicClient.waitForTransactionReceipt({
            hash: transactionHash,
          });
          return {
            success: true,
            token,
            transactionHash,
            explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}`,
          };
        },
      },

      send_payment: {
        description:
          "Send ETH or USDC from the user's agent wallet to a recipient address on Base Sepolia",
        inputSchema: z.object({
          toAddress: z
            .string()
            .describe("Recipient wallet address (0x...)"),
          amount: z
            .string()
            .describe("Amount to send as a decimal string, e.g. '0.001'"),
          token: z.enum(["eth", "usdc"]).describe("Token to send"),
        }),
        execute: async ({
          toAddress,
          amount,
          token,
        }: {
          toAddress: string;
          amount: string;
          token: "eth" | "usdc";
        }) => {
          if (!isValidAddress(toAddress)) {
            return { success: false, error: "Invalid recipient address" };
          }
          const result = await executeTransfer({
            fromWalletName: user.agentWalletName,
            toAddress,
            amount,
            token,
          });
          return result;
        },
      },

      sign_message: {
        description:
          "Sign an arbitrary text message with the user's agent wallet (EIP-191 signature)",
        inputSchema: z.object({
          message: z.string().describe("The text message to sign"),
        }),
        execute: async ({ message }: { message: string }) => {
          const cdp = getCdpClient();
          const { signature } = await cdp.evm.signMessage({
            address: user.agentWalletAddress as `0x${string}`,
            message,
          });
          return {
            success: true,
            walletAddress: user.agentWalletAddress,
            message,
            signature,
          };
        },
      },

      buy_product: {
        description: `Purchase premium weather data by sending ${PAYMENT_REQUIREMENTS.price_eth} ETH to the merchant on Base Sepolia (x402-style payment)`,
        inputSchema: z.object({}),
        execute: async () => {
          const cdp = getCdpClient();
          const account = await cdp.evm.getOrCreateAccount({
            name: user.agentWalletName,
          });
          const baseAccount = await account.useNetwork("base-sepolia");

          // Send ETH to merchant
          const { transactionHash } = await baseAccount.sendTransaction({
            transaction: {
              to: MERCHANT_ADDRESS,
              value: parseEther(PAYMENT_REQUIREMENTS.price_eth),
            },
          });

          // Wait for confirmation
          await publicClient.waitForTransactionReceipt({
            hash: transactionHash,
          });

          // Verify payment and get product
          const verification = await verifyPayment(transactionHash);
          if (!verification.valid) {
            return {
              success: false,
              error: verification.reason ?? "Payment verification failed",
              transactionHash,
              explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}`,
            };
          }

          const product = buildProduct(transactionHash, verification.value);
          return {
            success: true,
            ...product,
            explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}`,
          };
        },
      },
    };

    const result = streamText({
      model: provider.chat("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      tools,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
