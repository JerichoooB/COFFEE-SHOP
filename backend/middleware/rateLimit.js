import { isIP } from "node:net";
import { ipKeyGenerator } from "express-rate-limit";

// Vercel's official ipAddress() helper uses x-real-ip, written by its proxy.
// Trust this header only inside Vercel; arbitrary forwarded headers are ignored.
// https://github.com/vercel/vercel/blob/main/packages/functions/src/headers.ts
export function clientRateLimitKey(request, vercel = false) {
  const platformIP = vercel ? request.get("x-real-ip") : undefined;
  const address =
    platformIP && isIP(platformIP) ? platformIP : request.socket?.remoteAddress;
  return address && isIP(address) ? ipKeyGenerator(address) : "unknown-client";
}
