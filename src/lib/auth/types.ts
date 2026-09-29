/** Wallet identity and login contracts are separate from mandate authorization. */
export interface WalletIdentity { namespace: "eip155"; address: string }
export interface WalletSession {
  identity: WalletIdentity;
  chainId: string;
  expiresAt: string;
}
/** Adapter shape only, NOT an agreed HTTP API or a client-generated challenge. */
export interface LoginChallenge {
  format?: "team-jwt" | "local-session";
  id: string;
  message: string;
  expiresAt: string;
}
export interface WalletAuthAdapter {
  getSession(signal?: AbortSignal): Promise<WalletSession | null>;
  getChallenge(input: { address: string; chainId: string }, signal?: AbortSignal): Promise<LoginChallenge>;
  verify(input: { challengeId: string; message: string; signature: string }, signal?: AbortSignal): Promise<WalletSession>;
  logout(signal?: AbortSignal): Promise<void>;
}
/** Future compliance metadata references identity; never grants login/spending rights. */
export interface IdentityComplianceReference { identity: WalletIdentity; referenceId: string }
export type AuthenticationState =
  | { status: "unavailable"; reason: "AUTH_CONTRACT_PENDING" }
  | { status: "anonymous" | "requesting_challenge" | "awaiting_signature" | "verifying" }
  | { status: "authenticated"; session: WalletSession }
  | { status: "error"; code: string };
