import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { isAddress } from "viem";
import { getCdpClient } from "@/lib/cdp";
import { publicClient } from "@/lib/viem";
import { getBalances } from "@/lib/balance";
import { executeTransfer } from "@/lib/transfer";
import { authenticateRequest } from "@/lib/auth";

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

// Proxy mangles tool names in streaming: create_wallet → CreateWallet_tool
// Build reverse mapping to fix them in the SSE stream
const TOOL_NAMES = [
  "create_wallet",
  "check_balance",
  "request_faucet",
  "send_payment",
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
// 2. Response: Fix mangled tool names (CreateWallet_tool → create_wallet)
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

        // Fix mangled tool names: CreateWallet_tool → create_wallet
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
  knownWallets: { name: string; address: string }[] | undefined,
  connectedAddress: string | undefined
): string {
  let walletSection = "";
  if (connectedAddress) {
    walletSection += `Connected browser wallet: ${connectedAddress}\n`;
  }
  if (knownWallets && knownWallets.length > 0) {
    walletSection += "Agent wallets:\n";
    walletSection += knownWallets
      .map((w) => `- "${w.name}": ${w.address}`)
      .join("\n");
  } else {
    walletSection += "Agent wallets: none yet";
  }

  return `You are PayAgent, an AI payment assistant on Base Sepolia testnet.

=== USER'S WALLETS (you know this) ===
${walletSection}
=== END WALLETS ===

When the user asks "what wallets do I have", "my address", "my wallet", or similar, answer using the wallet info above. Never say you don't have this info.

Tools available:
- create_wallet: Create a new agent wallet
- check_balance: Check ETH and USDC balance of a wallet
- send_payment: Send ETH or USDC from an agent wallet to any address
- request_faucet: Get testnet ETH or USDC from the faucet

Guidelines:
- IMPORTANT: Call only ONE tool at a time. Never make parallel/simultaneous tool calls. If you need multiple operations (e.g., request both ETH and USDC), call them one at a time sequentially.
- Be concise and friendly. Use short responses.
- Always confirm the details before sending a payment (amount, token, recipient).
- When showing addresses, abbreviate them (0x1234...abcd).
- When a user says "send X to Y", figure out which wallet to send from. If they only have one wallet, use that. If multiple, ask which one.
- Proactively suggest getting faucet funds if a wallet has zero balance.
- After successful transactions, share the BaseScan explorer link.
- You work on Base Sepolia testnet - remind users this is testnet if they seem confused about real funds.
- Format currency amounts nicely (e.g., "0.001 ETH", "5.00 USDC").`;
}

export async function POST(req: Request) {
  const user = authenticateRequest(req.headers.get("authorization"));
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages: uiMessages, wallets, connectedAddress } =
      await req.json();
    const modelMessages = await convertToModelMessages(uiMessages);

    // Sanitize inputs
    const knownWallets = Array.isArray(wallets)
      ? (wallets as { name: string; address: string }[]).filter(
          (w) =>
            typeof w.name === "string" &&
            typeof w.address === "string" &&
            isValidAddress(w.address)
        )
      : undefined;

    const sanitizedConnectedAddress =
      typeof connectedAddress === "string" && isValidAddress(connectedAddress)
        ? connectedAddress
        : undefined;

    const systemPrompt = buildSystemPrompt(
      knownWallets,
      sanitizedConnectedAddress
    );

    // Also inject wallet context into the first user message as a hidden prefix,
    // because some proxies strip or ignore system messages.
    let walletContext = "";
    if (sanitizedConnectedAddress) {
      walletContext += `[Context: User's connected browser wallet is ${sanitizedConnectedAddress}] `;
    }
    if (knownWallets && knownWallets.length > 0) {
      const list = knownWallets
        .map((w) => `"${w.name}": ${w.address}`)
        .join(", ");
      walletContext += `[Context: User's agent wallets are: ${list}] `;
    }
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
      create_wallet: {
        description: "Create a new agent wallet with a given name",
        inputSchema: z.object({
          name: z.string().describe("Name for the wallet, e.g. 'My Agent'"),
        }),
        execute: async ({ name }: { name: string }) => {
          const cdp = getCdpClient();
          const account = await cdp.evm.getOrCreateAccount({ name });
          return { success: true, name, address: account.address };
        },
      },

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
          "Request testnet ETH or USDC from the Base Sepolia faucet for a wallet",
        inputSchema: z.object({
          address: z.string().describe("The wallet address to fund"),
          token: z.enum(["eth", "usdc"]).describe("Which token to request"),
        }),
        execute: async ({
          address,
          token,
        }: {
          address: string;
          token: "eth" | "usdc";
        }) => {
          if (!isValidAddress(address)) {
            return { success: false, error: "Invalid address format" };
          }
          const cdp = getCdpClient();
          const { transactionHash } = await cdp.evm.requestFaucet({
            address,
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
          "Send ETH or USDC from an agent wallet to a recipient address on Base Sepolia",
        inputSchema: z.object({
          fromWalletName: z
            .string()
            .describe("Name of the sender agent wallet"),
          toAddress: z
            .string()
            .describe("Recipient wallet address (0x...)"),
          amount: z
            .string()
            .describe("Amount to send as a decimal string, e.g. '0.001'"),
          token: z.enum(["eth", "usdc"]).describe("Token to send"),
        }),
        execute: async ({
          fromWalletName,
          toAddress,
          amount,
          token,
        }: {
          fromWalletName: string;
          toAddress: string;
          amount: string;
          token: "eth" | "usdc";
        }) => {
          if (!isValidAddress(toAddress)) {
            return { success: false, error: "Invalid recipient address" };
          }
          const result = await executeTransfer({
            fromWalletName,
            toAddress,
            amount,
            token,
          });
          return result;
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
