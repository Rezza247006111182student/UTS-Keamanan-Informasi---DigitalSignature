"use client";

/**
 * Halaman Tanda Tangani Dokumen
 * Tanggung Jawab: Anggota C
 *
 * Alur:
 *  1. User upload PDF + isi passphrase + metadata (role, institusi)
 *  2. Client hash PDF dengan SHA-256 (Web Crypto API)
 *  3. POST ke /api/sign (Modul A) → dapat signature base64
 *  4. generateQrPayload → QR preview ditampilkan (dengan border seal)
 *  5. embedQrToPdf → download PDF dengan QR tersematkan
 *  6. POST ke /api/documents → simpan metadata ke DB
 *
 * Catatan: logic kriptografi (sign) sepenuhnya di Modul A (/api/sign).
 * Halaman ini hanya mengatur UI & orkestrasi pemanggilan API.
 *
 * Guard RequireAuth (Modul B) memastikan hanya user yang login bisa sign.
 */

import { useState, useRef, useCallback } from "react";
import RequireAuth from "@/lib/auth/RequireAuth";
import { getCurrentUser, getAccessToken } from "@/lib/auth/session";
import { generateQrPayload, dataUrlToBuffer } from "@/lib/qrcode/generateQr";
import { embedQrToPdf } from "@/lib/pdf/embedQrToPdf";

// ─── Tipe state ───────────────────────────────────────────────────────────────

type Step = "idle" | "hashing" | "signing" | "generating_qr" | "embedding" | "done" | "error";

interface SignResult {
  qrDataUrl: string;         // base64 PNG QR untuk ditampilkan
  signedPdfBytes: Uint8Array; // PDF dengan QR tersematkan
  documentId: string;        // ID dokumen yang tersimpan di DB
}

// ─── Helper: hash file dengan Web Crypto API ──────────────────────────────────

async function hashFileSHA256(file: File): Promise<{ hex: string; buffer: ArrayBuffer }> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hex, buffer };
}

// ─── Komponen form (hanya ditampilkan setelah login) ─────────────────────────

function SignForm() {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [result, setResult] = useState<SignResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop handlers
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setResult(null);
      setErrorMsg(null);
    }
  }, []);

  // ── Proses tanda tangan ────────────────────────────────────────────────

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !passphrase.trim()) return;

    setStep("hashing");
    setStepLabel("Menghitung hash dokumen…");
    setErrorMsg(null);
    setResult(null);

    try {
      // 1. Hash PDF
      const { hex: docHash, buffer: pdfBuffer } = await hashFileSHA256(file);

      // 2. Ambil user (nama, role, institusi dari profil Modul B)
      const user = await getCurrentUser();
      if (!user) throw new Error("Sesi habis. Muat ulang halaman dan masuk kembali.");

      // 3. POST /api/sign (Modul A) — jangan reimplementasi sign di sini
      setStep("signing");
      setStepLabel("Menandatangani dokumen…");

      const token = await getAccessToken();
      const signRes = await fetch("/api/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          documentHash: docHash,
          passphrase: passphrase,
        }),
      });

      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Tanda tangan gagal (${signRes.status})`);
      }

      const { signature, signerName, role, institution } = await signRes.json();

      // 4. Generate QR
      setStep("generating_qr");
      setStepLabel("Membuat QR-Code meterai…");

      const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const qrDataUrl = await generateQrPayload({
        signature,
        publicKey: user.publicKey,
        signerName: signerName ?? user.fullName ?? "Penandatangan",
        role: role ?? user.role ?? "Signer",
        date: now,
        institution: institution ?? user.institution ?? "",
      });

      // 5. Embed QR ke PDF
      setStep("embedding");
      setStepLabel("Menyematkan QR ke PDF…");

      const pdfBytes = new Uint8Array(pdfBuffer);
      const qrPngBytes = dataUrlToBuffer(qrDataUrl);
      const signedPdfBytes = await embedQrToPdf(pdfBytes, qrPngBytes, {
        label: signerName ?? user.fullName,
      });

      // 6. Simpan metadata dokumen ke DB
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: file.name.replace(/\.pdf$/i, ""),
          file_path: `${user.id}/${docHash}.pdf`,
          document_hash: docHash,
        }),
      });

      const docBody = await docRes.json().catch(() => ({}));
      const documentId: string = docBody?.document?.id ?? "";

      setResult({ qrDataUrl, signedPdfBytes, documentId });
      setStep("done");
      setStepLabel("");
      setPassphrase(""); // Bersihkan passphrase dari state secepatnya
    } catch (err) {
      setStep("error");
      setStepLabel("");
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan tidak terduga.");
    }
  }

  // ── Download PDF bertanda tangan ─────────────────────────────────────────

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.signedPdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? `signed_${file.name}` : "signed_document.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  const isProcessing = ["hashing", "signing", "generating_qr", "embedding"].includes(step);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Form upload & passphrase ─────────────────────────────────── */}
      {step !== "done" && (
        <form onSubmit={handleSign} className="space-y-5">

          {/* Drop zone PDF */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Dokumen PDF
            </label>
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded px-6 py-8 text-center cursor-pointer
                transition-colors select-none
                ${isDragging
                  ? "border-seal bg-seal/5"
                  : file
                    ? "border-valid/50 bg-valid-bg/30"
                    : "border-border hover:border-seal/40 bg-paper"
                }
              `}
            >
              {file ? (
                <div>
                  <svg className="mx-auto mb-2 w-8 h-8 text-valid" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {(file.size / 1024).toFixed(1)} KB — klik untuk ganti
                  </p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto mb-2 w-8 h-8 text-ink-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-ink-muted">
                    Seret PDF ke sini atau <span className="text-seal">pilih file</span>
                  </p>
                  <p className="text-xs text-ink-muted/70 mt-1">Hanya file .pdf</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                aria-label="Pilih file PDF"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setResult(null); setErrorMsg(null); }
                }}
              />
            </div>
          </div>

          {/* Passphrase */}
          <div>
            <label htmlFor="passphrase" className="block text-sm font-medium text-ink mb-1.5">
              Passphrase kunci privat
            </label>
            <input
              id="passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Masukkan passphrase kunci digital Anda"
              className="w-full px-3 py-2.5 border border-border rounded bg-white text-ink text-sm
                         placeholder:text-ink-muted/60 focus:outline-none focus:ring-2
                         focus:ring-seal/40 focus:border-seal transition-colors"
            />
            <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
              Passphrase digunakan sementara untuk membuka kunci privat di server dan langsung dibuang dari memori setelah tanda tangan dibuat.
            </p>
          </div>

          {/* Pesan error */}
          {errorMsg && (
            <div className="border border-invalid/30 rounded bg-invalid-bg px-4 py-3">
              <p className="text-sm font-medium text-invalid mb-0.5">Tanda tangan gagal</p>
              <p className="text-sm text-invalid/80">{errorMsg}</p>
            </div>
          )}

          {/* Tombol submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!file || !passphrase.trim() || isProcessing}
              className="px-6 py-2.5 bg-seal hover:bg-seal-dark disabled:opacity-50
                         disabled:cursor-not-allowed text-white text-sm font-medium
                         rounded transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {stepLabel}
                </span>
              ) : (
                "Tanda tangani dokumen"
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Hasil tanda tangan ────────────────────────────────────────── */}
      {step === "done" && result && (
        <div className="space-y-6">
          {/* Banner sukses */}
          <div className="border border-valid/30 rounded bg-valid-bg px-5 py-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-valid shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-valid">Dokumen berhasil ditandatangani</p>
              <p className="text-xs text-valid/80 mt-0.5">
                QR-Code meterai sudah tersematkan. Unduh PDF untuk menyimpan dokumen bertanda tangan.
              </p>
            </div>
          </div>

          {/* Preview QR */}
          <div className="border border-border rounded bg-paper px-6 py-6 flex flex-col items-center">
            <p className="text-xs font-medium text-ink-muted mb-4 uppercase tracking-wide">
              QR-Code meterai digital
            </p>
            {/* Border seal sesuai DESIGN_GUIDE Bagian 4 */}
            <div className="border-2 border-seal p-3 rounded inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.qrDataUrl}
                alt="QR-Code tanda tangan digital"
                width={200}
                height={200}
                className="block"
              />
            </div>
            <p className="text-xs text-ink-muted mt-3">
              Scan QR ini di halaman Verifikasi untuk membuktikan keaslian dokumen.
            </p>
          </div>

          {/* Tombol aksi */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors"
            >
              Unduh PDF bertanda tangan
            </button>
            <button
              onClick={() => {
                setStep("idle");
                setFile(null);
                setResult(null);
                setErrorMsg(null);
              }}
              className="px-5 py-2.5 border border-border text-ink text-sm font-medium rounded hover:bg-black/5 transition-colors"
            >
              Tanda tangani dokumen lain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SignPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="font-serif text-3xl font-semibold text-ink mb-1">
        Tanda Tangani Dokumen
      </h1>
      <p className="text-sm text-ink-muted mb-8">
        Unggah dokumen PDF dan masukkan passphrase untuk membubuhkan tanda tangan digital.
      </p>

      <RequireAuth
        title="Masuk untuk menandatangani dokumen"
        description="Penandatanganan membutuhkan kunci privat terenkripsi milik Anda. Masuk terlebih dahulu, lalu masukkan passphrase untuk membuka kunci secara sementara di memori."
      >
        <SignForm />
      </RequireAuth>
    </div>
  );
}
