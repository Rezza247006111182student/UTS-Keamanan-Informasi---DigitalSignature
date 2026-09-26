import { NextResponse } from "next/server";

/**
 * API Route: /api/verify
 * Tanggung Jawab: Anggota A
 *
 * TODO: Dikerjakan oleh Anggota A
 * Endpoint untuk memverifikasi keabsahan signature terhadap hash dokumen dan public key.
 */
export async function POST() {
  // TODO: Implementasi oleh Anggota A
  return NextResponse.json(
    { message: "Endpoint verify belum diimplementasikan (Anggota A)" },
    { status: 501 }
  );
}
