import { NextResponse } from "next/server";

/**
 * API Route: /api/sign
 * Tanggung Jawab: Anggota A
 *
 * TODO: Dikerjakan oleh Anggota A
 * Endpoint untuk menandatangani hash dokumen dengan private key pengguna (didukung passphrase).
 */
export async function POST() {
  // TODO: Implementasi oleh Anggota A
  return NextResponse.json(
    { message: "Endpoint sign belum diimplementasikan (Anggota A)" },
    { status: 501 }
  );
}
