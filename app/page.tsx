import Link from "next/link";
import { 
  FaKey, 
  FaShieldHalved, 
  FaFilePdf, 
  FaQrcode, 
  FaFileSignature, 
  FaUserGroup, 
  FaLock, 
  FaArrowRight, 
  FaCheck,
  FaShieldCat
} from "react-icons/fa6";
import LandingCTA from "@/components/LandingCTA";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden w-[100vw] ml-[calc(50%-50vw)] -mt-8 pt-8 pb-8">

      {/* ── Subtle background grid pattern ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.35,
        }}
      />

      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 text-center px-4 sm:px-6">
        <div className="max-w-5xl mx-auto w-full">
          {/* Gold glow blob behind headline */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/4 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(176,141,47,0.18) 0%, transparent 70%)" }}
          />

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-seal/40 bg-seal/10 px-4 py-1.5 text-sm font-medium text-seal">
            <FaShieldHalved className="h-3.5 w-3.5" />
            Didukung Kriptografi Ed25519 &amp; AES-256-GCM
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold leading-tight tracking-tight text-ink">
            Tanda Tangan Digital yang{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #B08D2F 0%, #D4AF55 50%, #8A6E22 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Aman &amp; Terverifikasi
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Platform penandatanganan dokumen PDF berbasis kriptografi asimetris dengan QR-Code meterai
            digital, dukungan multi-signer, dan kunci privat yang tersimpan terenkripsi.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              id="cta-sign"
              href="/sign"
              className="group inline-flex items-center gap-2 rounded px-7 py-3.5 text-sm font-semibold text-paper transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-seal/25 active:scale-95"
              style={{ background: "linear-gradient(135deg, #B08D2F, #8A6E22)" }}
            >
              Mulai Menandatangani
              <FaArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              id="cta-verify"
              href="/verify"
              className="inline-flex items-center gap-2 rounded border border-border px-7 py-3.5 text-sm font-semibold text-ink transition-all duration-200 hover:border-seal hover:bg-seal/5 active:scale-95"
            >
              Verifikasi Dokumen
              <FaCheck className="h-4 w-4" />
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-ink-muted">
            {[
              { icon: <FaKey className="text-seal/80 text-sm" />, label: "Ed25519 — Kurva Eliptik Modern" },
              { icon: <FaLock className="text-seal/80 text-sm" />, label: "Private Key Terenkripsi AES-256-GCM" },
              { icon: <FaFilePdf className="text-seal/80 text-sm" />, label: "Hash SHA-256 pada Berkas PDF" },
              { icon: <FaQrcode className="text-seal/80 text-sm" />, label: "Verifikasi QR-Code Instan" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-2">
                <span>{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          STATS
      ═══════════════════════════════════════════ */}
      <section className="border-y border-border bg-paper/60 py-10 backdrop-blur px-4 sm:px-6">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 text-center">
            {[
              { value: "Ed25519", label: "Algoritma Tanda Tangan", sub: "64-byte signature" },
              { value: "SHA-256", label: "Fungsi Hash Dokumen", sub: "256-bit digest" },
              { value: "AES-256", label: "Enkripsi Private Key", sub: "GCM + Scrypt KDF" },
              { value: "Multi", label: "Dukungan Penandatangan", sub: "Paralel & independen" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-seal">{stat.value}</span>
                <span className="mt-1 text-sm font-medium text-ink">{stat.label}</span>
                <span className="text-xs text-ink-muted">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURE CARDS
      ═══════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-seal mb-2">Fitur Unggulan</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
              Keamanan berlapis dalam satu platform
            </h2>
            <p className="mt-3 text-ink-muted max-w-md mx-auto">
              Setiap komponen dirancang dengan standar kriptografi industri terkini.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                id: "feature-keygen",
                icon: <FaKey className="h-5 w-5" />,
                title: "Pembangkitan Kunci Ed25519",
                desc: "Pasangan kunci asimetris 256-bit dibangkitkan menggunakan CSPRNG built-in Node.js. Kunci privat langsung dienkripsi sebelum disimpan — tidak pernah menyentuh disk dalam bentuk plaintext.",
              },
              {
                id: "feature-hash",
                icon: <FaFilePdf className="h-5 w-5" />,
                title: "Hash SHA-256 Dokumen",
                desc: "Setiap berkas di-hash menggunakan SHA-256 sebelum ditandatangani. Perubahan 1 byte pada dokumen akan menghasilkan hash yang sama sekali berbeda (avalanche effect), membatalkan verifikasi.",
              },
              {
                id: "feature-sign",
                icon: <FaFileSignature className="h-5 w-5" />,
                title: "Tanda Tangan Digital",
                desc: "Penandatanganan menggunakan kunci privat yang didekripsi sesaat di memori server, lalu langsung dibuang. Hasilnya adalah signature 64 byte yang dilekatkan di dalam QR-Code.",
              },
              {
                id: "feature-qr",
                icon: <FaQrcode className="h-5 w-5" />,
                title: "QR-Code Meterai Digital",
                desc: "QR-Code berisi payload JSON lengkap: signature, public key, nama, jabatan, tanggal, dan institusi. Disematkan langsung ke PDF dengan bingkai warna emas — identitas visual yang mudah dikenali.",
              },
              {
                id: "feature-encrypt",
                icon: <FaLock className="h-5 w-5" />,
                title: "Enkripsi Kunci Privat",
                desc: "Kunci privat dienkripsi dengan AES-256-GCM menggunakan kunci turunan scrypt (N=16384). IV 12-byte dan auth tag 16-byte disimpan bersama ciphertext — tanpa passphrase yang benar, kunci tidak bisa dibuka.",
              },
              {
                id: "feature-multisign",
                icon: <FaUserGroup className="h-5 w-5" />,
                title: "Multi-Signer Paralel",
                desc: "Beberapa penandatangan dapat menandatangani dokumen yang sama secara independen. Setiap tanda tangan diverifikasi terpisah terhadap kunci publiknya masing-masing — semua harus valid agar dokumen dinyatakan sah.",
              },
            ].map((feat) => (
              <div
                key={feat.id}
                id={feat.id}
                className="group relative rounded-xl border border-border bg-paper p-7 transition-all duration-300 hover:border-seal/50 hover:shadow-lg hover:shadow-seal/10 hover:-translate-y-1"
              >
                {/* Gold accent line on hover */}
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-seal to-seal-dark opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-seal/20 bg-seal/10 text-seal">
                  {feat.icon}
                </div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-ink">{feat.title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section className="py-20 border-t border-border px-4 sm:px-6 bg-white/50">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-seal mb-2">Alur Kerja</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
              Tiga langkah menuju dokumen yang sah
            </h2>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-1/2 top-10 hidden h-full w-px -translate-x-1/2 border-l-2 border-dashed border-seal/20 lg:block" aria-hidden />

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
              {[
                {
                  step: "01",
                  id: "step-keygen",
                  title: "Buat & Simpan Kunci",
                  desc: "Daftarkan akun, bangkitkan pasangan kunci Ed25519 dengan CSPRNG, dan simpan kunci privat terenkripsi di profil Anda.",
                  href: "/register",
                  cta: "Daftar Sekarang",
                },
                {
                  step: "02",
                  id: "step-sign",
                  title: "Unggah & Tandatangani",
                  desc: "Upload berkas PDF, masukkan passphrase untuk membuka kunci privat sesaat, dan sistem akan menghasilkan signature serta menyematkan QR-Code ke dokumen.",
                  href: "/sign",
                  cta: "Ke Halaman Tanda Tangan",
                },
                {
                  step: "03",
                  id: "step-verify",
                  title: "Verifikasi Keaslian",
                  desc: "Siapa pun dapat mengunggah PDF atau memindai QR-Code. Sistem memverifikasi signature Ed25519 dan menampilkan informasi penandatangan.",
                  href: "/verify",
                  cta: "Ke Halaman Verifikasi",
                },
              ].map((item) => (
                <div key={item.id} id={item.id} className="relative flex flex-col items-center text-center bg-paper p-8 rounded-2xl border border-border shadow-sm">
                  {/* Step circle */}
                  <div
                    className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-paper text-2xl font-serif font-bold text-seal shadow-xl"
                    style={{ background: "linear-gradient(135deg, #FAF8F2 0%, #EFEBE0 100%)" }}
                  >
                    {item.step}
                  </div>
                  <h3 className="mb-3 font-serif text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-muted mb-6">{item.desc}</p>
                  <Link
                    id={`${item.id}-link`}
                    href={item.href}
                    className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-seal hover:text-seal-dark transition-colors"
                  >
                    {item.cta} <FaArrowRight className="text-xs" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECURITY CALLOUT
      ═══════════════════════════════════════════ */}
      <section className="py-20 border-t border-border px-4 sm:px-6">
        <div className="max-w-4xl mx-auto w-full">
          <div
            className="rounded-3xl border border-seal/30 p-10 sm:p-16 text-center relative overflow-hidden shadow-lg shadow-seal/5"
            style={{ background: "linear-gradient(135deg, rgba(176,141,47,0.08) 0%, rgba(176,141,47,0.02) 100%)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full blur-3xl -z-10"
              style={{ background: "radial-gradient(circle, rgba(176,141,47,0.15) 0%, transparent 70%)" }}
            />
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-seal/30 bg-seal/10 text-seal mx-auto shadow-inner">
              <FaShieldHalved className="h-8 w-8" />
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mb-4">
              Kunci privat Anda tidak pernah kami simpan dalam plaintext
            </h2>
            <p className="text-ink-muted max-w-xl mx-auto mb-10 text-lg leading-relaxed">
              Enkripsi AES-256-GCM dengan derivasi kunci scrypt memastikan hanya Anda — pemegang passphrase — yang dapat membuka dan menggunakan kunci privat. Server hanya menyimpan ciphertext terenkripsi.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                "AES-256-GCM",
                "scrypt N=16384",
                "IV 12-byte acak",
                "Auth Tag 16-byte",
                "Zero plaintext storage",
              ].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-seal/40 bg-seal/5 px-5 py-2 text-sm font-semibold text-seal font-mono shadow-sm"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA BOTTOM
      ═══════════════════════════════════════════ */}
      <section className="py-24 border-t border-border text-center px-4 sm:px-6">
        <div className="max-w-3xl mx-auto w-full">
          <h2 className="font-serif text-4xl sm:text-5xl font-semibold text-ink mb-6">
            Siap untuk mulai?
          </h2>
          <p className="text-ink-muted mb-12 text-lg">
            Buat akun, bangkitkan kunci, dan tandatangani dokumen pertama Anda dalam hitungan menit.
          </p>
          <LandingCTA />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="border-t border-border py-10 text-center text-sm text-ink-muted px-4">
        <p>
          <span className="font-serif font-semibold text-ink text-base">Natural<span className="text-seal">Sign</span></span>
          {" "}— Sistem Tanda Tangan Digital berbasis Ed25519 &amp; QR-Code
        </p>
        <p className="mt-2">
          Kriptografi: Ed25519 · SHA-256 · AES-256-GCM · scrypt · CSPRNG
        </p>
      </footer>

    </div>
  );
}
