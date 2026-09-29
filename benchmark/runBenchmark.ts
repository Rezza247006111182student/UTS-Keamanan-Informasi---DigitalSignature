/**
 * Script Benchmark Kinerja Digital Signature
 * Tanggung Jawab: Anggota C
 *
 * Mengukur:
 *  - Waktu eksekusi sign (30x iterasi) → min, max, rata-rata, median
 *  - Waktu eksekusi verify (30x iterasi) → min, max, rata-rata, median
 *  - Ukuran digital signature (bytes & base64 length)
 *  - Ukuran public key (bytes & PEM length)
 *
 * Output:
 *  - benchmark/results/benchmark_<timestamp>.csv
 *  - benchmark/results/benchmark_<timestamp>.xlsx (termasuk grafik native Excel)
 *  - Ringkasan ke console
 *
 * Cara menjalankan:
 *   npx tsx benchmark/runBenchmark.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as ExcelJS from "exceljs";
import { injectCharts } from "./helpers/injectCharts";
import { generateKeyPair } from "../lib/crypto/keygen";
import { signDocumentHash } from "../lib/crypto/sign";
import { verifySignature } from "../lib/crypto/verify";
import { hashDocument } from "../lib/crypto/hash";

// ─── Konfigurasi ──────────────────────────────────────────────────────────────

const ITERASI = 30;
const OUTPUT_DIR = path.join(__dirname, "results");

// Dokumen dummy — representasi isi dokumen PDF (buffer 10KB)
const DOKUMEN_DUMMY = Buffer.alloc(10 * 1024, "A");

// ─── Tipe ─────────────────────────────────────────────────────────────────────

interface HasilIterasi {
  iterasi: number;
  waktu_sign_ms: number;
  waktu_verify_ms: number;
  hasil_verify: boolean;
}

interface RingkasanBenchmark {
  algoritma: string;
  iterasi: number;
  // Sign
  sign_min_ms: number;
  sign_max_ms: number;
  sign_rata_ms: number;
  sign_median_ms: number;
  // Verify
  verify_min_ms: number;
  verify_max_ms: number;
  verify_rata_ms: number;
  verify_median_ms: number;
  // Ukuran
  ukuran_signature_bytes: number;
  ukuran_signature_base64_chars: number;
  ukuran_public_key_bytes: number;
  ukuran_public_key_pem_chars: number;
  // Keandalan
  verify_sukses_count: number;
  verify_sukses_persen: number;
}

// ─── Helper statistik ─────────────────────────────────────────────────────────

function rata(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function bulatkan(n: number, desimal = 4): number {
  return Math.round(n * 10 ** desimal) / 10 ** desimal;
}

// ─── Fungsi benchmark utama ───────────────────────────────────────────────────

export async function runBenchmark(): Promise<void> {
  console.log("=".repeat(60));
  console.log(" BENCHMARK DIGITAL SIGNATURE — NaturalSign");
  console.log("=".repeat(60));
  console.log(`Algoritma : Ed25519`);
  console.log(`Iterasi   : ${ITERASI}x sign + ${ITERASI}x verify`);
  console.log(`Dokumen   : ${DOKUMEN_DUMMY.length} bytes (dummy)`);
  console.log("=".repeat(60));

  // ── 1. Siapkan kunci sekali pakai untuk semua iterasi ───────────────────
  process.stdout.write("Membangkitkan pasangan kunci Ed25519... ");
  const { publicKey, privateKey } = generateKeyPair();
  console.log("✓");

  // ── 2. Hash dokumen (dilakukan sekali, bukan bagian benchmark sign) ──────
  const docHash = hashDocument(DOKUMEN_DUMMY);

  // ── 3. Jalankan iterasi sign ─────────────────────────────────────────────
  console.log(`\nMenujalankan ${ITERASI}x sign...`);
  const waktuSign: number[] = [];
  let signatureTerakhir = "";

  for (let i = 0; i < ITERASI; i++) {
    const mulai = performance.now();
    const sig = signDocumentHash(docHash, privateKey);
    const selesai = performance.now();
    waktuSign.push(selesai - mulai);
    signatureTerakhir = sig; // simpan signature terakhir untuk verify
    process.stdout.write(i % 10 === 9 ? "█\n" : "█");
  }
  if (ITERASI % 10 !== 0) console.log();

  // ── 4. Jalankan iterasi verify ───────────────────────────────────────────
  console.log(`\nMenujalankan ${ITERASI}x verify...`);
  const waktuVerify: number[] = [];
  const hasilVerify: boolean[] = [];
  const hasilIterasi: HasilIterasi[] = [];

  for (let i = 0; i < ITERASI; i++) {
    const mulai = performance.now();
    const valid = verifySignature(docHash, signatureTerakhir, publicKey);
    const selesai = performance.now();
    waktuVerify.push(selesai - mulai);
    hasilVerify.push(valid);
    hasilIterasi.push({
      iterasi: i + 1,
      waktu_sign_ms: bulatkan(waktuSign[i]),
      waktu_verify_ms: bulatkan(selesai - mulai),
      hasil_verify: valid,
    });
    process.stdout.write(i % 10 === 9 ? "█\n" : "█");
  }
  if (ITERASI % 10 !== 0) console.log();

  // ── 5. Hitung ukuran ─────────────────────────────────────────────────────
  const sigBytes = Buffer.from(signatureTerakhir, "base64");
  const pubKeyBytes = Buffer.from(publicKey, "utf-8");

  // ── 6. Susun ringkasan ───────────────────────────────────────────────────
  const verifySuksesCount = hasilVerify.filter(Boolean).length;

  const ringkasan: RingkasanBenchmark = {
    algoritma: "Ed25519",
    iterasi: ITERASI,
    sign_min_ms:    bulatkan(Math.min(...waktuSign)),
    sign_max_ms:    bulatkan(Math.max(...waktuSign)),
    sign_rata_ms:   bulatkan(rata(waktuSign)),
    sign_median_ms: bulatkan(median(waktuSign)),
    verify_min_ms:    bulatkan(Math.min(...waktuVerify)),
    verify_max_ms:    bulatkan(Math.max(...waktuVerify)),
    verify_rata_ms:   bulatkan(rata(waktuVerify)),
    verify_median_ms: bulatkan(median(waktuVerify)),
    ukuran_signature_bytes:        sigBytes.length,
    ukuran_signature_base64_chars: signatureTerakhir.length,
    ukuran_public_key_bytes:        pubKeyBytes.length,
    ukuran_public_key_pem_chars:    publicKey.length,
    verify_sukses_count:  verifySuksesCount,
    verify_sukses_persen: bulatkan((verifySuksesCount / ITERASI) * 100, 1),
  };

  // ── 7. Cetak ringkasan ke console ────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(" HASIL BENCHMARK");
  console.log("=".repeat(60));
  console.log(`\n[SIGN — ${ITERASI} iterasi]`);
  console.log(`  Min    : ${ringkasan.sign_min_ms} ms`);
  console.log(`  Max    : ${ringkasan.sign_max_ms} ms`);
  console.log(`  Rata   : ${ringkasan.sign_rata_ms} ms`);
  console.log(`  Median : ${ringkasan.sign_median_ms} ms`);
  console.log(`\n[VERIFY — ${ITERASI} iterasi]`);
  console.log(`  Min    : ${ringkasan.verify_min_ms} ms`);
  console.log(`  Max    : ${ringkasan.verify_max_ms} ms`);
  console.log(`  Rata   : ${ringkasan.verify_rata_ms} ms`);
  console.log(`  Median : ${ringkasan.verify_median_ms} ms`);
  console.log(`  Sukses : ${ringkasan.verify_sukses_count}/${ITERASI} (${ringkasan.verify_sukses_persen}%)`);
  console.log(`\n[UKURAN]`);
  console.log(`  Signature  : ${ringkasan.ukuran_signature_bytes} bytes (${ringkasan.ukuran_signature_base64_chars} chars base64)`);
  console.log(`  Public Key : ${ringkasan.ukuran_public_key_bytes} bytes (${ringkasan.ukuran_public_key_pem_chars} chars PEM)`);

  // ── 8. Ekspor ke file ────────────────────────────────────────────────────
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const baseFilename = `benchmark_${timestamp}`;

  // ── 8a. CSV ──────────────────────────────────────────────────────────────
  const csvPath = path.join(OUTPUT_DIR, `${baseFilename}.csv`);
  const csvLines = [
    // Header
    "iterasi,waktu_sign_ms,waktu_verify_ms,hasil_verify",
    // Baris per iterasi
    ...hasilIterasi.map(
      (r) =>
        `${r.iterasi},${r.waktu_sign_ms},${r.waktu_verify_ms},${r.hasil_verify}`
    ),
    // Baris kosong pemisah
    "",
    // Ringkasan statistik
    "metrik,sign_ms,verify_ms",
    `min,${ringkasan.sign_min_ms},${ringkasan.verify_min_ms}`,
    `max,${ringkasan.sign_max_ms},${ringkasan.verify_max_ms}`,
    `rata-rata,${ringkasan.sign_rata_ms},${ringkasan.verify_rata_ms}`,
    `median,${ringkasan.sign_median_ms},${ringkasan.verify_median_ms}`,
    "",
    "metrik,nilai,satuan",
    `ukuran_signature,${ringkasan.ukuran_signature_bytes},bytes`,
    `ukuran_signature_base64,${ringkasan.ukuran_signature_base64_chars},chars`,
    `ukuran_public_key,${ringkasan.ukuran_public_key_bytes},bytes`,
    `ukuran_public_key_pem,${ringkasan.ukuran_public_key_pem_chars},chars`,
    `algoritma,${ringkasan.algoritma},`,
    `iterasi,${ringkasan.iterasi},kali`,
    `verify_sukses,${ringkasan.verify_sukses_persen},%`,
  ];
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");
  console.log(`\n✓ CSV   → ${csvPath}`);

  // ── 8b. XLSX (ExcelJS — mendukung grafik native Excel) ─────────────────
  const ringkasanRows = [
    { metrik: "Algoritma",               nilai: ringkasan.algoritma,                      satuan: "" },
    { metrik: "Jumlah Iterasi",           nilai: ringkasan.iterasi,                        satuan: "kali" },
    { metrik: "=== SIGN ===",            nilai: "",                                       satuan: "" },
    { metrik: "Sign - Min",               nilai: ringkasan.sign_min_ms,                   satuan: "ms" },
    { metrik: "Sign - Max",               nilai: ringkasan.sign_max_ms,                   satuan: "ms" },
    { metrik: "Sign - Rata-rata",         nilai: ringkasan.sign_rata_ms,                  satuan: "ms" },
    { metrik: "Sign - Median",            nilai: ringkasan.sign_median_ms,                satuan: "ms" },
    { metrik: "=== VERIFY ===",          nilai: "",                                       satuan: "" },
    { metrik: "Verify - Min",             nilai: ringkasan.verify_min_ms,                 satuan: "ms" },
    { metrik: "Verify - Max",             nilai: ringkasan.verify_max_ms,                 satuan: "ms" },
    { metrik: "Verify - Rata-rata",       nilai: ringkasan.verify_rata_ms,                satuan: "ms" },
    { metrik: "Verify - Median",          nilai: ringkasan.verify_median_ms,              satuan: "ms" },
    { metrik: "Verify - Sukses",          nilai: `${ringkasan.verify_sukses_count}/${ringkasan.iterasi}`, satuan: `${ringkasan.verify_sukses_persen}%` },
    { metrik: "=== UKURAN ===",          nilai: "",                                       satuan: "" },
    { metrik: "Signature",               nilai: ringkasan.ukuran_signature_bytes,         satuan: "bytes" },
    { metrik: "Signature (base64)",       nilai: ringkasan.ukuran_signature_base64_chars,  satuan: "chars" },
    { metrik: "Public Key",              nilai: ringkasan.ukuran_public_key_bytes,         satuan: "bytes" },
    { metrik: "Public Key (PEM)",         nilai: ringkasan.ukuran_public_key_pem_chars,    satuan: "chars" },
  ];

  const xlsxPath = path.join(OUTPUT_DIR, `${baseFilename}.xlsx`);
  const wb = new ExcelJS.Workbook();
  wb.creator = "NaturalSign Benchmark";
  wb.created = new Date();

  // Sheet 1: Data per iterasi
  const wsIterasi = wb.addWorksheet("Data Iterasi");
  wsIterasi.columns = [
    { header: "iterasi", key: "iterasi", width: 10 },
    { header: "waktu_sign_ms", key: "waktu_sign_ms", width: 18 },
    { header: "waktu_verify_ms", key: "waktu_verify_ms", width: 18 },
    { header: "hasil_verify", key: "hasil_verify", width: 14 },
  ];
  hasilIterasi.forEach((r) => wsIterasi.addRow(r));
  wsIterasi.getRow(1).font = { bold: true };

  // Sheet 2: Ringkasan statistik
  const wsRingkasan = wb.addWorksheet("Ringkasan");
  wsRingkasan.columns = [
    { header: "metrik", key: "metrik", width: 28 },
    { header: "nilai", key: "nilai", width: 18 },
    { header: "satuan", key: "satuan", width: 10 },
  ];
  ringkasanRows.forEach((r) => wsRingkasan.addRow(r));
  wsRingkasan.getRow(1).font = { bold: true };

  // ── 8c. Sheet Grafik + grafik native Excel ───────────────────────────────
  //   Sheet "Grafik" = kanvas penempatan chart (native OOXML chart),
  //   data chart merujuk ke Data Iterasi + sheet helper Statistik/Ukuran.
  const wsChart = wb.addWorksheet("Grafik");
  wsChart.getCell("A1").value = "Visualisasi Hasil Benchmark";
  wsChart.getCell("A1").font = { bold: true, size: 14 };
  wsChart.getCell("A2").value =
    "Grafik di bawah adalah chart native Excel (bisa diedit). Sumber data: sheet Data Iterasi, Statistik, Ukuran.";
  wsChart.getCell("A2").font = { italic: true, size: 9 };

  // Sheet helper: Statistik (untuk bar chart)
  const wsStat = wb.addWorksheet("Statistik");
  wsStat.columns = [
    { header: "metrik", key: "metrik", width: 14 },
    { header: "Sign (ms)", key: "sign_ms", width: 12 },
    { header: "Verify (ms)", key: "verify_ms", width: 12 },
  ];
  [
    ["Min", ringkasan.sign_min_ms, ringkasan.verify_min_ms],
    ["Max", ringkasan.sign_max_ms, ringkasan.verify_max_ms],
    ["Rata-rata", ringkasan.sign_rata_ms, ringkasan.verify_rata_ms],
    ["Median", ringkasan.sign_median_ms, ringkasan.verify_median_ms],
  ].forEach((r) => wsStat.addRow({ metrik: r[0], sign_ms: r[1], verify_ms: r[2] }));
  wsStat.getRow(1).font = { bold: true };

  // Sheet helper: Ukuran (untuk pie chart)
  const wsUkuran = wb.addWorksheet("Ukuran");
  wsUkuran.columns = [
    { header: "ukuran", key: "ukuran", width: 22 },
    { header: "Jumlah", key: "bytes", width: 12 },
  ];
  [
    ["Signature", ringkasan.ukuran_signature_bytes],
    ["Public Key", ringkasan.ukuran_public_key_bytes],
    ["Signature (base64)", ringkasan.ukuran_signature_base64_chars],
    ["Public Key (PEM)", ringkasan.ukuran_public_key_pem_chars],
  ].forEach((r) => wsUkuran.addRow({ ukuran: r[0], bytes: r[1] }));
  wsUkuran.getRow(1).font = { bold: true };

  await wb.xlsx.writeFile(xlsxPath);

  // Sisipkan chart native OOXML (exceljs 4.4.0 belum mendukung addChart)
  await injectCharts(xlsxPath, "Grafik", [
    {
      type: "line",
      title: "Waktu Sign & Verify per Iterasi (ms)",
      sheet: "Data Iterasi",
      col: 0,
      row: 3,
      widthPx: 620,
      heightPx: 300,
      series: [
        {
          name: "waktu_sign_ms",
          categories: hasilIterasi.map((r) => r.iterasi),
          values: hasilIterasi.map((r) => r.waktu_sign_ms),
        },
        {
          name: "waktu_verify_ms",
          categories: hasilIterasi.map((r) => r.iterasi),
          values: hasilIterasi.map((r) => r.waktu_verify_ms),
        },
      ],
    },
    {
      type: "bar",
      title: "Statistik Waktu Eksekusi (ms)",
      sheet: "Statistik",
      col: 9,
      row: 3,
      widthPx: 480,
      heightPx: 300,
      series: [
        {
          name: "Sign (ms)",
          categories: ["Min", "Max", "Rata-rata", "Median"],
          values: [
            ringkasan.sign_min_ms,
            ringkasan.sign_max_ms,
            ringkasan.sign_rata_ms,
            ringkasan.sign_median_ms,
          ],
        },
        {
          name: "Verify (ms)",
          categories: ["Min", "Max", "Rata-rata", "Median"],
          values: [
            ringkasan.verify_min_ms,
            ringkasan.verify_max_ms,
            ringkasan.verify_rata_ms,
            ringkasan.verify_median_ms,
          ],
        },
      ],
    },
    {
      type: "pie",
      title: "Ukuran Output (bytes / chars)",
      sheet: "Ukuran",
      col: 0,
      row: 21,
      widthPx: 420,
      heightPx: 280,
      series: [
        {
          name: "Jumlah",
          categories: [
            "Signature",
            "Public Key",
            "Signature (base64)",
            "Public Key (PEM)",
          ],
          values: [
            ringkasan.ukuran_signature_bytes,
            ringkasan.ukuran_public_key_bytes,
            ringkasan.ukuran_signature_base64_chars,
            ringkasan.ukuran_public_key_pem_chars,
          ],
        },
      ],
    },
  ]);

  console.log(`✓ XLSX  → ${xlsxPath} (3 grafik native Excel)`);

  // Baris HTML dihapus karena pengguna tidak ingin file HTML
  console.log("\n" + "=".repeat(60));
  console.log(" Benchmark selesai.");
  console.log("=".repeat(60) + "\n");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// Deteksi apakah dijalankan langsung (bukan di-import)
// Kompatibel dengan tsx (ESM) dan ts-node (CJS)
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;

if (isMain) {
  runBenchmark().catch((err) => {
    console.error("Benchmark gagal:", err);
    process.exit(1);
  });
}
