import crypto from "node:crypto";

/**
 * Modul Kriptografi Inti — Key Generation
 * Tanggung Jawab: Anggota A
 *
 * Membangkitkan pasangan kunci asimetris menggunakan algoritma Ed25519
 * dengan CSPRNG built-in dari `node:crypto`.
 * Format output:
 * - Public Key: PEM string (SubjectPublicKeyInfo / SPKI)
 * - Private Key: PEM string (PKCS#8)
 *
 * Kontrak: generateKeyPair(): { publicKey: string; privateKey: string }
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey,
    privateKey,
  };
}

