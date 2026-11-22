import crypto from "node:crypto";

// No 0/O/1/I/L so codes are easy to read aloud and type.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function joinCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}
