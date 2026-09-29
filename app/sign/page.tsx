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

import { useState, useRef, useCallback, useEffect } from "react";
import RequireAuth from "@/lib/auth/RequireAuth";
import { getCurrentUser, getAccessToken, supabase } from "@/lib/auth/session";
import { generateQrPayload, dataUrlToBuffer } from "@/lib/qrcode/generateQr";
import { embedQrToPdf } from "@/lib/pdf/embedQrToPdf";

// ─── Helper: ambil encrypted_private_key dari tabel users ────────────────────
// getCurrentUser() (Modul B) tidak mengekspos encrypted_private_key karena
// alasan keamanan — field itu hanya diambil sesaat di sini untuk proses sign,
// lalu langsung dikirim ke server dan tidak disimpan di state.
async function fetchEncryptedPrivateKey(userId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { data, error } = await supabase
    .from("users")
    .select("encrypted_private_key")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("Gagal mengambil kunci privat terenkripsi dari database.");
  const key = (data as { encrypted_private_key: string | null }).encrypted_private_key;
  if (!key) throw new Error("Kunci privat belum dibuat. Silakan buat pasangan kunci terlebih dahulu di halaman Keygen.");
  return key;
}

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

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type === "application/pdf") {
          setFile(pastedFile);
          setResult(null);
          setErrorMsg(null);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
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

      // 2. Ambil user + encrypted_private_key (field ini tidak ada di getCurrentUser)
      const user = await getCurrentUser();
      if (!user) throw new Error("Sesi habis. Muat ulang halaman dan masuk kembali.");

      const encryptedPrivateKey = await fetchEncryptedPrivateKey(user.id);

      // 3. Simpan metadata dokumen ke DB DULU agar kita punya documentId
      // yang akan dipakai oleh /api/sign untuk mencatat signature ke tabel document_signatures
      const token = await getAccessToken();
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

      if (!docRes.ok || !documentId) {
        throw new Error(docBody.error ?? "Gagal menyimpan dokumen ke database.");
      }

      // 4. POST /api/sign (Modul A) — kirim hash + encryptedPrivateKey + passphrase + documentId
      // Modul A yang dekripsi private key (via Modul B), lakukan sign, dan simpan ke document_signatures
      setStep("signing");
      setStepLabel("Menandatangani dokumen…");

      const signRes = await fetch("/api/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          hash: docHash,
          encryptedPrivateKey,
          passphrase,
          documentId,
          signerName: user.fullName,
          signerRole: user.role,
          signerInstitution: user.institution,
        }),
      });

      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Tanda tangan gagal (${signRes.status})`);
      }

      const { signature } = await signRes.json();

      // 5. Generate QR
      setStep("generating_qr");
      setStepLabel("Membuat QR-Code meterai…");

      const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const qrData = {
        signature,
        publicKey: user.publicKey,
        signerName: user.fullName ?? "Penandatangan",
        role: user.role ?? "Signer",
        date: now,
        institution: user.institution ?? "",
      };
      const qrJsonPayload = JSON.stringify(qrData);
      const qrDataUrl = await generateQrPayload(qrData);

      // 6. Embed QR ke PDF
      setStep("embedding");
      setStepLabel("Menyematkan QR ke PDF…");

      const pdfBytes = new Uint8Array(pdfBuffer);
      const qrPngBytes = dataUrlToBuffer(qrDataUrl);
      const signedPdfBytes = await embedQrToPdf(pdfBytes, qrPngBytes, {
        label: user.fullName,
        qrPayloadJson: qrJsonPayload,
      });

      // 7. Update qr_payload di DB + upload PDF ke Supabase Storage
      setStepLabel("Menyimpan dokumen…");

      // Update qr_payload di document_signatures
      if (token && documentId) {
        await fetch("/api/documents/update-payload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documentId,
            qrPayload: qrJsonPayload,
          }),
        }).catch(() => { /* non-critical */ });

        // Upload signed PDF ke Supabase Storage
        if (supabase) {
          const storagePath = `${user.id}/${documentId}.pdf`;
          await supabase.storage
            .from("documents")
            .upload(storagePath, new Blob([signedPdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
              upsert: true,
            })
            .catch(() => { /* non-critical, user sudah punya file lokal */ });

          // Update file_path di tabel documents agar dashboard bisa download
          await fetch("/api/documents/update-path", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              documentId,
              filePath: storagePath,
            }),
          }).catch(() => { /* non-critical */ });
        }
      }

      setResult({ qrDataUrl, signedPdfBytes, documentId });
      setStep("done");
      setStepLabel("");
      setPassphrase("");
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
    <div className="max-w-3xl mx-auto py-10 relative">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, rgba(176,141,47,0.2) 0%, transparent 70%)" }}
      />
      
      <div className="text-center mb-10 border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-seal mb-1">Aksi</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mb-3">
          Tanda Tangani Dokumen
        </h1>
        <p className="text-sm sm:text-base text-ink-muted max-w-lg mx-auto">
          Unggah dokumen PDF dan masukkan passphrase Anda untuk membubuhkan tanda tangan digital secara aman.
        </p>
      </div>

      <RequireAuth
        title="Masuk untuk menandatangani dokumen"
        description="Penandatanganan membutuhkan kunci privat terenkripsi milik Anda. Masuk terlebih dahulu, lalu masukkan passphrase untuk membuka kunci secara sementara di memori."
      >
        <SignForm />
      </RequireAuth>
    </div>
  );
}
