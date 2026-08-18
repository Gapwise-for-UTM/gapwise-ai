import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MAX_PLAINTEXT_BYTES = 768 * 1024;
const MAX_CIPHERTEXT_BYTES = MAX_PLAINTEXT_BYTES + TAG_BYTES;

export type CipherEnvelope = {
  ciphertext: string;
  nonce: string;
  cryptoVersion: 1;
};

function decodeBase64Url(value: string, maximumBytes: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Encrypted payload encoding is invalid.");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength > maximumBytes) throw new Error("Encrypted payload is too large.");
  return bytes;
}

export function parseDataKey(value: string): Buffer {
  const trimmed = value.trim();
  // Secret generators commonly emit either RFC 4648 Base64 or Base64url and
  // may retain padding. Both represent the same random bytes. Accept those
  // standard encodings, but reject whitespace/quotes/other text and require
  // exactly 256 bits after decoding.
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/u.test(trimmed)) {
    throw new Error("GAPWISE_AI_DATA_KEY encoding is invalid.");
  }
  const normalized = trimmed.replace(/-/gu, "+").replace(/_/gu, "/");
  const key = Buffer.from(normalized, "base64");
  if (key.byteLength !== KEY_BYTES) throw new Error("GAPWISE_AI_DATA_KEY must contain exactly 32 bytes.");
  return key;
}

function aad(purpose: "snapshot" | "action", userId: string, revision: number): Buffer {
  return Buffer.from(`gapwise-ai|v1|${purpose}|${userId}|${revision}`, "utf8");
}

export function encryptJson(
  keyValue: string,
  purpose: "snapshot" | "action",
  userId: string,
  revision: number,
  value: unknown,
): CipherEnvelope {
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Delegated payload is too large.");
  const key = parseDataKey(keyValue);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(purpose, userId, revision));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cryptoVersion: 1,
    nonce: nonce.toString("base64url"),
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64url"),
  };
}

export function decryptJson(
  keyValue: string,
  purpose: "snapshot" | "action",
  userId: string,
  revision: number,
  envelope: Pick<CipherEnvelope, "ciphertext" | "nonce">,
): unknown {
  const key = parseDataKey(keyValue);
  const nonce = decodeBase64Url(envelope.nonce, NONCE_BYTES);
  if (nonce.byteLength !== NONCE_BYTES) throw new Error("Encrypted payload nonce is invalid.");
  const combined = decodeBase64Url(envelope.ciphertext, MAX_CIPHERTEXT_BYTES);
  if (combined.byteLength <= TAG_BYTES) throw new Error("Encrypted payload is malformed.");
  const ciphertext = combined.subarray(0, combined.byteLength - TAG_BYTES);
  const tag = combined.subarray(combined.byteLength - TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad(purpose, userId, revision));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Decrypted payload is too large.");
  try {
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } catch {
    throw new Error("Decrypted payload is malformed.");
  }
}
