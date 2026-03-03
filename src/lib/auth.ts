import { parseIdToken, isTokenExpired } from "@/lib/login3";

export interface AuthenticatedUser {
  sub: string;
  walletAddress: string | null;
  email: string | null;
}

/**
 * Validate Bearer token from Authorization header.
 * Returns user info if valid, null otherwise.
 */
export function authenticateRequest(
  authHeader: string | null
): AuthenticatedUser | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token.trim()) return null;

  try {
    if (isTokenExpired(token)) return null;
    const claims = parseIdToken(token);
    return {
      sub: claims.sub,
      walletAddress: claims.wallet_address ?? null,
      email: claims.email ?? null,
    };
  } catch {
    return null;
  }
}
