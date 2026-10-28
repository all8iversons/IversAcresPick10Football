import { createHash, randomBytes } from "node:crypto";

export function createInviteCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteCode(inviteCode: string): string {
  return createHash("sha256").update(inviteCode, "utf8").digest("hex");
}
