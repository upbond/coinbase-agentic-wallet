/**
 * Transfer spending policy — application-layer enforcement.
 *
 * CDP SDK does not provide a server-side spending limit API,
 * so we enforce limits here before executing any transfer.
 */

export const TRANSFER_LIMITS = {
  eth: { max_per_tx: 0.001, label: "0.001 ETH" },
  usdc: { max_per_tx: 5, label: "5 USDC" },
} as const;

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a transfer amount is within the per-transaction spending limit.
 */
export function checkTransferPolicy(
  amount: string,
  token: "eth" | "usdc"
): PolicyCheckResult {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    return { allowed: false, reason: "Invalid amount" };
  }

  const limit = TRANSFER_LIMITS[token];
  if (parsed > limit.max_per_tx) {
    return {
      allowed: false,
      reason: `Amount ${amount} ${token.toUpperCase()} exceeds the per-transaction limit of ${limit.label}. Please reduce the amount.`,
    };
  }

  return { allowed: true };
}
