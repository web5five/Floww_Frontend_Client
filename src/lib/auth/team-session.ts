import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { WalletSession } from "./types";
export interface TeamSession extends WalletSession { accessToken: string; userId: string }
export const teamMode = () => process.env.FLOWW_WALLET_AUTH_MODE !== "local-session";
export const businessJwtReady = () => process.env.FLOWW_BUSINESS_JWT_ENABLED === "true";
export function sessionKey() {
  const value = process.env.FLOWW_SESSION_SECRET ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("AUTH_SESSION_NOT_CONFIGURED");
  return Buffer.from(value, "hex");
}
const aad = Buffer.from("floww-wallet-session-v1");
export function sealSession(session: TeamSession) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  cipher.setAAD(aad);
  const payload = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), payload.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
export function cookieValue(request: Request, name: string) {
  const pairs = (request.headers.get("cookie") ?? "").split(";").map(p => p.trim().split("="));
  const matches = pairs.filter(([key]) => key === name);
  return matches.length === 1 ? matches[0][1] ?? "" : "";
}
export function openSession(request: Request): TeamSession | null {
  try {
    const raw = cookieValue(request, "floww_wallet_session");
    if (raw.length > 3800 || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw)) return null;
    const [, iv, payload, tag] = raw.split(".");
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const session: TeamSession = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8"));
    return Date.parse(session.expiresAt) > Date.now() ? session : null;
  } catch { return null; }
}
