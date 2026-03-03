import { publicClient } from "./viem";

/**
 * Simplified x402 merchant configuration.
 * The merchant address receives ETH payments for product purchases.
 */
export const MERCHANT_ADDRESS =
  "0x557925d2C45793a678F94D4B638251E537Fa6dB8" as const;

const PRICE_WEI = 10_000_000_000_000n; // 0.00001 ETH

export const PAYMENT_REQUIREMENTS = {
  protocol: "x402-simplified",
  description: "Premium weather data for Base Sepolia",
  price_eth: "0.00001",
  price_wei: PRICE_WEI.toString(),
  recipient: MERCHANT_ADDRESS,
  chain: "Base Sepolia (84532)",
  instructions:
    "Send exactly 0.00001 ETH to the recipient address on Base Sepolia, then provide the transaction hash.",
};

/**
 * Verify an on-chain ETH payment to the merchant.
 */
export async function verifyPayment(
  txHash: `0x${string}`
): Promise<{ valid: boolean; reason?: string; value?: bigint }> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { valid: false, reason: "Transaction reverted" };
    }

    const tx = await publicClient.getTransaction({ hash: txHash });
    if (tx.to?.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
      return {
        valid: false,
        reason: `Wrong recipient: expected ${MERCHANT_ADDRESS}, got ${tx.to}`,
      };
    }
    if (tx.value < PRICE_WEI) {
      return {
        valid: false,
        reason: `Insufficient payment: expected >= ${PRICE_WEI} wei, got ${tx.value} wei`,
      };
    }

    return { valid: true, value: tx.value };
  } catch (error) {
    return {
      valid: false,
      reason:
        error instanceof Error
          ? error.message
          : "Failed to verify transaction",
    };
  }
}

/**
 * Build the product data returned after a verified payment.
 */
export function buildProduct(txHash: string, value?: bigint) {
  return {
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
      paid_wei: value?.toString() ?? PRICE_WEI.toString(),
      tx_hash: txHash,
      explorer: `https://sepolia.basescan.org/tx/${txHash}`,
    },
  };
}
