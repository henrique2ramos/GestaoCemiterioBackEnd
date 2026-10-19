import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(senha, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const partes = hashArmazenado.split("$");

  if (partes.length !== 6 || partes[0] !== "scrypt") {
    return false;
  }

  const [, n, r, p, saltB64, hashB64] = partes;
  const salt = Buffer.from(saltB64, "base64");
  const esperado = Buffer.from(hashB64, "base64");

  let derived: Buffer;

  try {
    derived = scryptSync(senha, salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  return derived.length === esperado.length && timingSafeEqual(derived, esperado);
}