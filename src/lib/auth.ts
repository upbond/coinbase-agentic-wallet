import { parseIdToken, isTokenExpired } from "@/lib/login3";
import { getCdpClient } from "@/lib/cdp";

export interface AuthenticatedUser {
  sub: string;
  walletAddress: string | null;
  agentWalletAddress: string;
  agentWalletName: string;
  email: string | null;
}

export function walletNameForUser(sub: string): string {
  return `user_${sub}_wallet`;
}

// Process-level cache to avoid CDP round-trips on every request
const addressCache = new Map<string, string>();

/**
 * Validate Bearer token and resolve the user's CDP agent wallet.
 * Returns user info if valid, null otherwise.
 */
export async function authenticateRequest(
  authHeader: string | null
): Promise<AuthenticatedUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token.trim()) return null;

  try {
    if (isTokenExpired(token)) return null;
    const claims = parseIdToken(token);

    const walletName = walletNameForUser(claims.sub);
    let agentWalletAddress = addressCache.get(walletName);
    if (!agentWalletAddress) {
      const cdp = getCdpClient();
      const account = await cdp.evm.getOrCreateAccount({ name: walletName });
      agentWalletAddress = account.address;
      addressCache.set(walletName, agentWalletAddress);
    }

    return {
      sub: claims.sub,
      walletAddress: claims.wallet_address ?? null,
      agentWalletAddress,
      agentWalletName: walletName,
      email: claims.email ?? null,
    };
  } catch {
    return null;
  }
}
