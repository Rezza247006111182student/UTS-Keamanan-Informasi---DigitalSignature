import { NextResponse } from "next/server";
import {
  createUserScopedServerClient,
  isSupabaseConfigured,
  supabase,
} from "@/lib/auth/session";

/**
 * API Route: /api/auth
 * Tanggung Jawab: Anggota B (Modul Keamanan Penyimpanan & Auth)
 *
 * Endpoint autentikasi pengguna. Menediakan 5 aksi:
 *
 *   POST { action: "register", email, password, fullName, institution, role }
 *   POST { action: "login",    email, password }
 *   POST { action: "logout" }
 *   POST { action: "setup-key", publicKey, encryptedPrivateKey }
 *          -> menyimpan kunci digital user (butuh header Authorization).
 *             Dipakai integrasi Hari-4: keygen (Modul A) -> enkripsi (Modul B)
 *             -> simpan ke DB. Modul A/C WAJIB lewat endpoint ini, dilarang
 *             menulis query users sendiri (PROJECT_CONTEXT Bagian 4).
 *   POST { action: "provision-key", passphrase }
 *          -> membangkitkan kunci via kontrak generateKeyPair() (Modul A),
 *             mengenkripsi via encryptPrivateKey() (Modul B), lalu menyimpan.
 *             Passphrase hanya dipakai sesaat di memori server lalu dibuang,
 *             tidak pernah disimpan/di-log (model ancaman sama seperti dekripsi
 *             sesaat saat sign di PROJECT_CONTEXT Bagian 1).
 *   GET                        -> user yang sedang login + status kunci
 *                                 (butuh header Authorization)
 *
 * CATATAN KEAMANAN:
 *   - Register & login memakai ANON key, bukan service role, sehingga
 *     email confirmation & seluruh aturan keamanan Supabase Auth tetap berlaku.
 *   - Endpoint yang butuh sesi membaca access token dari header
 *     "Authorization: Bearer <token>" lalu meneruskannya sebagai JWT ke
 *     Supabase (lihat createUserScopedServerClient di lib/auth/session.ts).
 *     Semua query tetap tunduk pada RLS user tersebut.
 *   - Password TIDAK PERNAH dikembalikan di response, tidak di-log, dan
 *     tidak disimpan di database aplikasi ini (dikelola Supabase Auth).
 *   - Passphrase kunci digital TIDAK dikirim ke endpoint ini sama sekali.
 *     Itu urusan private key (lib/keystore), bukan auth.
 */

export const dynamic = "force-dynamic";

/** Ambil access token dari header Authorization. */
function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Memastikan body JSON benar-benar punya isi. */
async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return {};
    }
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readString(
  body: Record<string, unknown>,
  field: string
): string {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

// =============================================================================
// GET /api/auth — user yang sedang login
// =============================================================================
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return jsonError(
      "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local",
      503
    );
  }

  const token = readBearerToken(request);
  if (!token) {
    return jsonError(
      "Tidak ada sesi aktif. Kirim header Authorization: Bearer <access_token>.",
      401
    );
  }

  const client = createUserScopedServerClient(token);
  if (!client) {
    return jsonError("Gagal menyiapkan client server-side.", 500);
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return jsonError("Sesi tidak valid atau sudah berakhir.", 401);
  }

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("id, email, full_name, role, institution, public_key, encrypted_private_key")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError("Gagal membaca profil pengguna.", 500);
  }

  // Flag status kunci: dipakai halaman sign (Modul C) untuk membedakan
  // "belum punya kunci -> arahkan buat kunci dulu" dari error lain.
  // Ciphertext-nya sendiri TIDAK PERNAH dikembalikan ke client di sini.
  const hasPublicKey = Boolean(profile?.public_key);
  const hasEncryptedKey = Boolean(profile?.encrypted_private_key);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      role: profile?.role ?? null,
      institution: profile?.institution ?? null,
      publicKey: profile?.public_key ?? "",
      hasPublicKey,
      hasEncryptedKey,
      hasKey: hasPublicKey && hasEncryptedKey,
    },
  });
}

// =============================================================================
// POST /api/auth — register / login / logout
// =============================================================================
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return jsonError(
      "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local",
      503
    );
  }

  const body = await readJsonBody(request);
  const action = readString(body, "action");

  switch (action) {
    case "register":
      return handleRegister(body);
    case "login":
      return handleLogin(body);
    case "logout":
      return handleLogout(request);
    case "setup-key":
      return handleSetupKey(request, body);
    case "provision-key":
      return handleProvisionKey(request, body);
    default:
      return jsonError(
        'Aksi tidak dikenal. Gunakan "register", "login", "logout", "setup-key", atau "provision-key".',
        400
      );
  }
}

async function handleRegister(body: Record<string, unknown>) {
  const email = readString(body, "email");
  const password = readString(body, "password");
  const fullName = readString(body, "fullName");
  const institution = readString(body, "institution");
  const role = readString(body, "role");

  if (!email || !password) {
    return jsonError("Email dan password wajib diisi.", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Format email tidak valid.", 400);
  }
  if (password.length < 6) {
    return jsonError("Password minimal 6 karakter.", 400);
  }

  // Full name & institution disimpan sebagai metadata. Baris public.users
  // dibuat OTOMATIS oleh trigger handle_new_user() di lib/db/schema.sql —
  // bukan di sini, karena saat signUp belum tentu ada sesi (bila email
  // confirmation aktif) sehingga RLS akan menolak insert dari sisi client.
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || "Pengguna NaturalSign",
        institution: institution || "",
        role: role || "Signer",
      },
    },
  });

  if (error) {
    // Jangan sampai membocorkan apakah email sudah terdaftar.
    if (/already registered|already exists/i.test(error.message)) {
      return jsonError(
        "Pendaftaran gagal. Email tersebut sudah pernah terdaftar.",
        409
      );
    }
    return jsonError(error.message, 400);
  }

  const needsEmailConfirmation = !data.session;

  return NextResponse.json(
    {
      success: true,
      needsEmailConfirmation,
      message: needsEmailConfirmation
        ? "Pendaftaran berhasil. Silakan konfirmasi email Anda sebelum masuk."
        : "Pendaftaran berhasil. Akun Anda sudah siap digunakan.",
      userId: data.user?.id ?? null,
    },
    { status: 201 }
  );
}

async function handleLogin(body: Record<string, unknown>) {
  const email = readString(body, "email");
  const password = readString(body, "password");

  if (!email || !password) {
    return jsonError("Email dan password wajib diisi.", 400);
  }

  const { data, error } = await supabase!.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Pesan sengaja generik: tidak membocorkan apakah email terdaftar.
    return jsonError("Email atau password salah.", 401);
  }

  return NextResponse.json({
    success: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    userId: data.user?.id ?? null,
  });
}

async function handleLogout(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    // Sudah tidak punya sesi — logout bersifat idempotent, tetap dianggap sukses.
    return NextResponse.json({ success: true, message: "Sesi sudah tidak aktif." });
  }

  const client = createUserScopedServerClient(token);
  if (!client) {
    return jsonError("Gagal menyiapkan client server-side.", 500);
  }

  const { error } = await client.auth.signOut();
  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ success: true, message: "Berhasil keluar dari akun." });
}

// =============================================================================
// POST { action: "setup-key", publicKey, encryptedPrivateKey }
// Menyimpan kunci digital milik user yang sedang login.
// Public key + ciphertext dibuat di sisi pemanggil (keygen Modul A, lalu
// encryptPrivateKey Modul B). Passphrase DILARANG dikirim ke endpoint ini.
// =============================================================================
async function handleSetupKey(request: Request, body: Record<string, unknown>) {
  const token = readBearerToken(request);
  if (!token) {
    return jsonError(
      "Tidak ada sesi aktif. Kirim header Authorization: Bearer <access_token>.",
      401
    );
  }

  const client = createUserScopedServerClient(token);
  if (!client) {
    return jsonError("Gagal menyiapkan client server-side.", 500);
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return jsonError("Sesi tidak valid atau sudah berakhir.", 401);
  }

  if (Object.prototype.hasOwnProperty.call(body, "passphrase")) {
    return jsonError(
      "Jangan kirim passphrase ke endpoint ini. Enkripsi dilakukan di sisi pemanggil dengan encryptPrivateKey(), yang dikirim hanya ciphertext-nya.",
      400
    );
  }

  const publicKey = readString(body, "publicKey");
  const encryptedPrivateKey = readString(body, "encryptedPrivateKey");

  if (!publicKey || !encryptedPrivateKey) {
    return jsonError("publicKey dan encryptedPrivateKey wajib diisi.", 400);
  }
  if (!publicKey.includes("BEGIN PUBLIC KEY")) {
    return jsonError("Format publicKey tidak valid (harus PEM public key).", 400);
  }
  if (/BEGIN PRIVATE KEY/.test(encryptedPrivateKey)) {
    return jsonError(
      "encryptedPrivateKey tidak boleh memuat private key plaintext.",
      400
    );
  }
  try {
    const pkg = JSON.parse(
      Buffer.from(encryptedPrivateKey, "base64").toString("utf8")
    );
    if (
      pkg.algorithm !== "aes-256-gcm" ||
      typeof pkg.salt !== "string" ||
      typeof pkg.iv !== "string" ||
      typeof pkg.tag !== "string" ||
      typeof pkg.data !== "string"
    ) {
      throw new Error("paket tidak lengkap");
    }
  } catch {
    return jsonError(
      "Format encryptedPrivateKey tidak valid (harus paket AES-256-GCM dari encryptPrivateKey).",
      400
    );
  }

  // signer_id/id diambil dari sesi, BUKAN dari body — user hanya bisa
  // menyimpan kunci miliknya sendiri (plus RLS users_update_own).
  const { error: updateError } = await client
    .from("users")
    .update({
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey,
    })
    .eq("id", user.id);

  if (updateError) {
    return jsonError("Gagal menyimpan kunci digital ke database.", 500);
  }

  return NextResponse.json({
    success: true,
    message: "Kunci digital berhasil disimpan terenkripsi.",
  });
}

// =============================================================================
// POST { action: "provision-key", passphrase }
// Jalur lengkap: generateKeyPair() (kontrak Modul A) -> encryptPrivateKey()
// (Modul B) -> simpan ke users. Dipakai halaman register/login (Modul B).
// =============================================================================
async function handleProvisionKey(request: Request, body: Record<string, unknown>) {
  const token = readBearerToken(request);
  if (!token) {
    return jsonError(
      "Tidak ada sesi aktif. Kirim header Authorization: Bearer <access_token>.",
      401
    );
  }

  const client = createUserScopedServerClient(token);
  if (!client) {
    return jsonError("Gagal menyiapkan client server-side.", 500);
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return jsonError("Sesi tidak valid atau sudah berakhir.", 401);
  }

  let passphrase = readString(body, "passphrase");
  if (!passphrase || passphrase.length < 8) {
    return jsonError("Passphrase minimal 8 karakter.", 400);
  }

  try {
    // Sudah punya kunci -> idempotent, tidak dibuat ulang.
    const { data: existing } = await client
      .from("users")
      .select("public_key, encrypted_private_key")
      .eq("id", user.id)
      .maybeSingle();
    if (existing?.public_key && existing?.encrypted_private_key) {
      return NextResponse.json({
        success: true,
        created: false,
        message: "Kunci digital sudah ada, tidak dibuat ulang.",
      });
    }

    // 1. Keygen via KONTRAK Modul A (bukan implementasi ulang di sini).
    let keypair: { publicKey: string; privateKey: string };
    try {
      const { generateKeyPair } = await import("@/lib/crypto/keygen");
      keypair = generateKeyPair();
    } catch (keygenError) {
      return NextResponse.json(
        {
          error:
            "Layanan pembuatan kunci (Modul A) belum tersedia. Akun tetap bisa dipakai; buat kunci nanti setelah Modul A selesai.",
          code: "KEYGEN_UNAVAILABLE",
          detail:
            keygenError instanceof Error ? keygenError.message : undefined,
        },
        { status: 501 }
      );
    }
    if (!keypair?.publicKey || !keypair?.privateKey) {
      return jsonError("Layanan pembuatan kunci mengembalikan hasil kosong.", 502);
    }

    // 2. Enkripsi via Modul B.
    const { encryptPrivateKey } = await import(
      "@/lib/keystore/encryptPrivateKey"
    );
    const ciphertext = encryptPrivateKey(keypair.privateKey, passphrase);

    // 3. Simpan (id user dari sesi, plus RLS).
    const { error: updateError } = await client
      .from("users")
      .update({
        public_key: keypair.publicKey,
        encrypted_private_key: ciphertext,
      })
      .eq("id", user.id);

    // Buang materi sensitif dari memori sesegera mungkin.
    keypair = { publicKey: "", privateKey: "" };

    if (updateError) {
      return jsonError("Gagal menyimpan kunci digital ke database.", 500);
    }

    return NextResponse.json(
      {
        success: true,
        created: true,
        message: "Kunci digital berhasil dibuat dan tersimpan terenkripsi.",
      },
      { status: 201 }
    );
  } finally {
    // Passphrase tidak pernah disimpan/di-log; timpa referensi lokal.
    passphrase = "";
  }
}

// =============================================================================
// Metode lain tidak dipakai oleh modul ini
// =============================================================================
export async function PUT() {
  return jsonError("Metode tidak didukung.", 405);
}

export async function DELETE() {
  return jsonError("Metode tidak didukung.", 405);
}
