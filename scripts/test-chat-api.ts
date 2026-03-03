/**
 * PayAgent Chat API automated test
 * Tests tool calling flow directly against the API
 *
 * All endpoints require JWT auth. This script builds a mock JWT
 * for local testing (the server uses parseIdToken which doesn't
 * verify signatures, only checks expiry).
 *
 * Usage: npx tsx scripts/test-chat-api.ts
 */

const BASE = "http://localhost:3000";

// Build a mock JWT for local testing (not signature-verified)
function buildMockJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "test-user-script",
      wallet_address: "0xAAAABBBBCCCCDDDD1111222233334444AAAABBBB",
      email: "test@example.com",
      iss: "https://login3.test.example.com",
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  return `${header}.${payload}.mock-signature`;
}

const AUTH_TOKEN = buildMockJwt();
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

let messageId = 0;
function makeUserMessage(text: string): UIMessage {
  return {
    id: `msg-${++messageId}`,
    role: "user",
    parts: [{ type: "text", text }],
  };
}

async function chatRequest(
  messages: UIMessage[],
  connectedAddress?: string
): Promise<{ raw: string; lines: string[] }> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ messages, connectedAddress }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const raw = await res.text();
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return { raw, lines };
}

let passed = 0;
let failed = 0;
function pass(name: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail?: string) {
  failed++;
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

function analyzeStream(lines: string[]) {
  let text = 0, toolStart = 0, toolDelta = 0, toolAvail = 0, toolOutput = 0;
  let steps = 0, finish = 0;
  for (const l of lines) {
    if (l.includes('"type":"text-delta"')) text++;
    if (l.includes('"type":"tool-input-start"')) toolStart++;
    if (l.includes('"type":"tool-input-delta"')) toolDelta++;
    if (l.includes('"type":"tool-input-available"')) toolAvail++;
    if (l.includes('"type":"tool-output-available"')) toolOutput++;
    if (l.includes('"type":"start-step"')) steps++;
    if (l.includes('"type":"finish"')) finish++;
  }
  return { text, toolStart, toolDelta, toolAvail, toolOutput, steps, finish };
}

function extractTextFromStream(lines: string[]): string {
  return lines
    .filter((l) => l.includes("text-delta"))
    .map((l) => {
      const m = l.match(/"delta":"([^"]*)"/);
      return m ? m[1] : "";
    })
    .join("");
}

// ── Wallet API (GET, auto-created) ──────────────────────

async function test_walletApi() {
  console.log("\n── Wallet API (GET /api/wallet) ──");

  // Authenticated request returns user's auto-created wallet
  const res1 = await fetch(`${BASE}/api/wallet`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  const json1 = await res1.json();
  if (json1.success && json1.data?.address) pass("Wallet API returns auto-created wallet");
  else fail("Wallet API failed", JSON.stringify(json1));

  if (/^0x[a-fA-F0-9]{40}$/.test(json1.data?.address || "")) pass("Returns valid address format");
  else fail("Invalid address format", json1.data?.address);

  if (json1.data?.name?.startsWith("user_")) pass("Wallet name follows user_ convention");
  else fail("Wallet name does not follow convention", json1.data?.name);

  // Unauthenticated request returns 401
  const res2 = await fetch(`${BASE}/api/wallet`);
  if (res2.status === 401) pass("Wallet API rejects unauthenticated (401)");
  else fail(`Wallet API did not reject unauthenticated (got ${res2.status})`);
}

// ── Wallet Context (AI knows the wallet) ─────────────────

async function test_walletContext() {
  console.log("\n── Wallet context (AI knows user's auto-created wallet) ──");
  const { raw, lines } = await chatRequest(
    [makeUserMessage("What wallets do I have? Just tell me from what you know.")],
  );

  const allText = extractTextFromStream(lines);
  console.log(`  📋 AI response: ${allText.slice(0, 300)}`);

  if (raw.includes("user_test-user-script_wallet") || raw.includes("0x")) pass("Response mentions user wallet");
  else fail("Response does NOT mention wallet");
}

// ── Connected Wallet ──────────────────────────────────

async function test_connectedWallet() {
  console.log("\n── Connected wallet recognition ──");
  const { raw, lines } = await chatRequest(
    [makeUserMessage("What is my connected browser wallet address?")],
    "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
  );

  const allText = extractTextFromStream(lines);
  console.log(`  📋 AI response: ${allText.slice(0, 300)}`);

  if (raw.toLowerCase().includes("abcdef") || raw.toLowerCase().includes("0xab")) pass("Connected address recognized");
  else fail("Connected address NOT recognized");
}

// ── Check Balance ──────────────────────────────────

async function test_checkBalance() {
  console.log("\n── check_balance ──");
  const { raw, lines } = await chatRequest(
    [makeUserMessage("Check my wallet balance. Use the check_balance tool.")],
  );
  const s = analyzeStream(lines);
  console.log(`  📊 stream: text=${s.text} steps=${s.steps} toolStart=${s.toolStart} toolAvail=${s.toolAvail} toolOutput=${s.toolOutput}`);

  if (s.toolOutput > 0) pass("check_balance executed");
  else fail("check_balance NOT executed");

  if (s.steps >= 2) pass(`Multi-step: ${s.steps} steps`);
  else fail(`Only ${s.steps} step(s) — no follow-up response`);

  const hasETH = raw.includes("ETH") || raw.includes("eth");
  if (hasETH) pass("ETH mentioned in response");
  else fail("ETH not mentioned");

  const hasUSDC = raw.includes("USDC") || raw.includes("usdc");
  if (hasUSDC) pass("USDC mentioned in response");
  else fail("USDC not mentioned");
}

// ── Balance API ──────────────────────────────────────

async function test_balanceApi() {
  console.log("\n── Balance API endpoint ──");

  // Valid address (with auth)
  const res1 = await fetch(`${BASE}/api/balance?address=0x0000000000000000000000000000000000000000`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  const json1 = await res1.json();
  if (json1.success && json1.data) pass("Balance API returns data for valid address");
  else fail("Balance API failed for valid address", JSON.stringify(json1));

  if (json1.data?.eth !== undefined) pass("ETH balance field present");
  else fail("ETH balance field missing");

  if (json1.data?.usdc !== undefined) pass("USDC balance field present");
  else fail("USDC balance field missing");

  // Invalid address (with auth)
  const res2 = await fetch(`${BASE}/api/balance?address=invalid`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (res2.status === 400) pass("Balance API rejects invalid address (400)");
  else fail(`Balance API did not reject invalid address (got ${res2.status})`);

  // Unauthenticated
  const res3 = await fetch(`${BASE}/api/balance?address=0x0000000000000000000000000000000000000000`);
  if (res3.status === 401) pass("Balance API rejects unauthenticated (401)");
  else fail(`Balance API did not reject unauthenticated (got ${res3.status})`);
}

// ── Edge Cases ──────────────────────────────────────

async function test_edgeCases() {
  console.log("\n── Edge cases ──");

  // Unauthenticated chat returns 401
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    if (res.status === 401) pass("Chat API rejects unauthenticated (401)");
    else fail(`Chat API did not reject unauthenticated (got ${res.status})`);
  } catch {
    fail("Chat API unauthenticated check failed with network error");
  }

  // Transfer API validation (with auth) — to and amount required
  const res1 = await fetch(`${BASE}/api/transfer`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ to: "", amount: "" }),
  });
  if (res1.status === 400) pass("Transfer API rejects empty params (400)");
  else fail(`Transfer API did not reject empty params (got ${res1.status})`);

  // Transfer API invalid address
  const res2 = await fetch(`${BASE}/api/transfer`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ to: "not-an-address", amount: "1.0", token: "eth" }),
  });
  if (res2.status === 400) pass("Transfer API rejects invalid address (400)");
  else fail(`Transfer API did not reject invalid address (got ${res2.status})`);

  // Transfer API invalid amount
  const res3 = await fetch(`${BASE}/api/transfer`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      to: "0x0000000000000000000000000000000000000000",
      amount: "abc",
      token: "eth",
    }),
  });
  if (res3.status === 400) pass("Transfer API rejects invalid amount (400)");
  else fail(`Transfer API did not reject invalid amount (got ${res3.status})`);

  // Transfer API unsupported token
  const res4 = await fetch(`${BASE}/api/transfer`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      to: "0x0000000000000000000000000000000000000000",
      amount: "1.0",
      token: "btc",
    }),
  });
  if (res4.status === 400) pass("Transfer API rejects unsupported token (400)");
  else fail(`Transfer API did not reject unsupported token (got ${res4.status})`);

  // Faucet API unsupported token (with auth)
  const res5 = await fetch(`${BASE}/api/faucet`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ token: "btc" }),
  });
  if (res5.status === 400) pass("Faucet API rejects unsupported token (400)");
  else fail(`Faucet API did not reject unsupported token (got ${res5.status})`);

  // Faucet API unauthenticated
  const res6 = await fetch(`${BASE}/api/faucet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "eth" }),
  });
  if (res6.status === 401) pass("Faucet API rejects unauthenticated (401)");
  else fail(`Faucet API did not reject unauthenticated (got ${res6.status})`);
}

// ── Main ──────────────────────────────────────────────

async function main() {
  console.log("🧪 PayAgent QA Test Suite (User-Scoped Wallets)");
  console.log(`   Target: ${BASE}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pass("Server reachable");
  } catch (e) {
    fail("Server NOT reachable", String(e));
    process.exit(1);
  }

  // REST API tests
  await test_walletApi();
  await test_balanceApi();

  // Chat API tests
  await test_walletContext();
  await test_connectedWallet();
  await test_checkBalance();

  // Edge cases
  await test_edgeCases();

  console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
