/**
 * injectCharts.ts
 *
 * Menyuntikkan grafik native Excel (OOXML DrawingML chart) ke file .xlsx
 * hasil tulisan exceljs — karena exceljs 4.4.0 belum mendukung chart.
 *
 * Cara kerja: xlsx adalah file ZIP; helper ini menambahkan
 *  - xl/drawings/drawingN.xml          (anchor / posisi grafik di sheet)
 *  - xl/drawings/_rels/drawingN.xml.rels
 *  - xl/charts/chartN.xml              (ChartSpace DrawingML)
 *  - override [Content_Types].xml + rels sheet target -> drawing
 *
 * Hasilnya file terbuka di Excel / LibreOffice sebagai chart asli
 * (bisa diedit, bukan gambar).
 */

import * as fs from "fs";
import JSZip from "jszip";

// ─── Tipe ─────────────────────────────────────────────────────────────────────

export interface ChartSeries {
  /** Nama seri (label legend) */
  name: string;
  /** Kategori (sumbu X) — number untuk angka, string untuk label */
  categories: (number | string)[];
  /** Nilai (sumbu Y) */
  values: number[];
}

export interface ChartConfig {
  type: "line" | "bar" | "pie";
  title: string;
  /** Nama sheet sumber data (untuk referensi formula chart) */
  sheet: string;
  series: ChartSeries[];
  /** Posisi anchor: kolom & baris (0-based) sel kiri-atas */
  col: number;
  row: number;
  /** Ukuran dalam pixel */
  widthPx: number;
  heightPx: number;
}

// ─── Helper XML ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Konversi pixel ke EMU (English Metric Unit) */
const emu = (px: number) => Math.round(px * 9525);

function colToLetter(idx: number): string {
  let s = "";
  idx += 1;
  while (idx > 0) {
    const m = (idx - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

function refRange(sheet: string, col: number, count: number): string {
  const c = colToLetter(col);
  return `'${esc(sheet)}'!$${c}$2:$${c}$${count + 1}`;
}

/** <c:tx> — nama seri merujuk sel header (baris 1) + cache nilainya */
function serTx(sheet: string, col: number, name: string): string {
  const c = colToLetter(col);
  return (
    `<c:tx><c:strRef><c:f>'${esc(sheet)}'!$${c}$1</c:f>` +
    `<c:strCache><c:ptCount val="1"/>` +
    `<c:pt idx="0"><c:v>${esc(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
  );
}

/** <c:cat> atau <c:val> — cache data + formula referensi sel supaya langsung tampil */
function refDataPart(
  kind: "cat" | "val",
  formula: string,
  values: (number | string)[]
): string {
  const numeric = values.every((v) => typeof v === "number");
  const ref = numeric ? "numRef" : "strRef";
  const cache = numeric ? "numCache" : "strCache";
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`)
    .join("");
  return (
    `<c:${kind}><c:${ref}><c:f>${formula}</c:f>` +
    `<c:${cache}><c:ptCount val="${values.length}"/>${pts}</c:${cache}></c:${ref}></c:${kind}>`
  );
}

const CAT_AXID = 111111111;
const VAL_AXID = 222222222;

/**
 * Satu <c:ser>. Urutan child mengikuti skema CT_LineSer / CT_BarSer / CT_PieSer:
 *   idx, order, tx?, spPr?, (bar: invertIfNegative?) (line: marker?) (pie: dPt*),
 *   cat?, val?, (line: smooth)
 */
function serXml(
  s: ChartSeries,
  idx: number,
  cfg: ChartConfig,
  kind: "line" | "bar" | "pie"
): string {
  const catFormula = refRange(cfg.sheet, 0, s.categories.length);
  const valFormula = refRange(cfg.sheet, 1 + idx, s.values.length);

  const color = SERIES_COLORS[idx % SERIES_COLORS.length];

  let spPr = "";
  if (kind === "line") {
    spPr = `<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></c:spPr>`;
  } else if (kind === "bar") {
    spPr = `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`;
  }
  const invert = kind === "bar" ? `<c:invertIfNegative val="0"/>` : "";
  const marker =
    kind === "line" ? `<c:marker><c:symbol val="none"/></c:marker>` : "";

  // Pie: warna per iris (bukan per seri) lewat c:dPt
  const dPts =
    kind === "pie"
      ? s.values
          .map(
            (_, p) =>
              `<c:dPt><c:idx val="${p}"/><c:bubble3D val="0"/>` +
              `<c:spPr><a:solidFill><a:srgbClr val="${
                SERIES_COLORS[p % SERIES_COLORS.length]
              }"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:dPt>`
          )
          .join("")
      : "";

  // CT_*Ser: dLbls datang setelah dPt, sebelum cat/val
  const dLbls =
    kind === "pie"
      ? `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/>` +
        `<c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>`
      : "";

  const smooth = kind === "line" ? `<c:smooth val="0"/>` : "";

  return (
    `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>` +
    serTx(cfg.sheet, 1 + idx, s.name) +
    spPr +
    invert +
    marker +
    dPts +
    dLbls +
    refDataPart("cat", catFormula, s.categories) +
    refDataPart("val", valFormula, s.values) +
    smooth +
    `</c:ser>`
  );
}

const SERIES_COLORS = ["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

function titleXml(title: string): string {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>` +
    `<a:defRPr sz="1300" b="1"/></a:pPr><a:r><a:rPr lang="id-ID" sz="1300" b="1"/>` +
    `<a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx>` +
    `<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
  );
}

const AXES = () => `<c:catAx>
    <c:axId val="${CAT_AXID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>
    <c:delete val="0"/><c:axPos val="b"/>
    <c:majorTickMark val="out"/><c:minorTickMark val="none"/>
    <c:tickLblPos val="nextTo"/>
    <c:crossAx val="${VAL_AXID}"/><c:crosses val="autoZero"/>
    <c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>
  </c:catAx>
  <c:valAx>
    <c:axId val="${VAL_AXID}"/><c:scaling><c:orientation val="minMax"/></c:scaling>
    <c:delete val="0"/><c:axPos val="l"/>
    <c:majorTickMark val="out"/><c:minorTickMark val="none"/>
    <c:tickLblPos val="nextTo"/>
    <c:crossAx val="${CAT_AXID}"/><c:crosses val="autoZero"/>
  </c:valAx>`;

const AX_IDS =
  `<c:axId val="${CAT_AXID}"/><c:axId val="${VAL_AXID}"/>`;

/**
 * Bangun chart1.xml (c:chartSpace).
 * Struktur (sesuai ECMA-376, sama seperti yang ditulis XlsxWriter):
 *   chartSpace > chart > title, autoTitleDeleted,
 *                  plotArea > layout, <xxxChart>, catAx, valAx,
 *                  legend?, plotVisOnly, dispBlanksAs
 */
function chartXml(type: ChartConfig["type"], cfg: ChartConfig): string {
  const sers = cfg.series
    .map((s, i) => serXml(s, i, cfg, type))
    .join("");

  let group = "";
  let axes = "";
  if (type === "line") {
    group =
      `<c:lineChart>` +
      `<c:grouping val="standard"/><c:varyColors val="0"/>` +
      sers +
      `<c:marker val="1"/>` +
      AX_IDS +
      `</c:lineChart>`;
    axes = AXES();
  } else if (type === "bar") {
    group =
      `<c:barChart>` +
      `<c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
      sers +
      `<c:gapWidth val="120"/><c:overlap val="-20"/>` +
      AX_IDS +
      `</c:barChart>`;
    axes = AXES();
  } else {
    group =
      `<c:pieChart>` +
      sers +
      `<c:firstSliceAng val="0"/>` +
      `</c:pieChart>`;
  }

  const legend = `<c:legend><c:legendPos val="${type === "pie" ? "r" : "b"}"/><c:overlay val="0"/></c:legend>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:chart>${titleXml(cfg.title)}` +
    `<c:plotArea><c:layout/>${group}${axes}</c:plotArea>` +
    legend +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>` +
    `</c:chart></c:chartSpace>`
  );
}

function drawingXml(charts: ChartConfig[]): string {
  const anchor = (c: ChartConfig) =>
    `<xdr:from><xdr:col>${c.col}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${c.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${emu(c.widthPx)}" cy="${emu(c.heightPx)}"/>`;
  const content = charts
    .map(
      (_, i) =>
        `<xdr:oneCellAnchor>${anchor(charts[i])}` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>` +
        `<xdr:cNvPr id="${2 + i}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/>` +
        `</xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
        `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>` +
        `</a:graphicData></a:graphic></xdr:graphicFrame>` +
        `<xdr:clientData/></xdr:oneCellAnchor>`
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${content}</xdr:wsDr>`
  );
}

// ─── Fungsi utama ─────────────────────────────────────────────────────────────

/**
 * Sisipkan satu atau lebih chart ke file xlsx pada `chartSheetName`.
 * Harus dipanggil SETELAH workbook ditulis ke disk.
 */
export async function injectCharts(
  xlsxPath: string,
  chartSheetName: string,
  charts: ChartConfig[]
): Promise<void> {
  const data = await fs.promises.readFile(xlsxPath);
  const zip = await JSZip.loadAsync(data);

  // 1. Cari file sheet target lewat workbook.xml + workbook rels
  const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
  const wbRels = await zip
    .file("xl/_rels/workbook.xml.rels")!
    .async("string");

  const sheetMatch = new RegExp(
    `<sheet[^>]*name="${chartSheetName.replace(/"/g, "")}"[^>]*r:id="(rId\\d+)"`
  ).exec(workbookXml);
  if (!sheetMatch) throw new Error(`Sheet "${chartSheetName}" tidak ditemukan`);
  const ridMatch = new RegExp(
    `<Relationship[^>]*Id="${sheetMatch[1]}"[^>]*Target="([^"]+)"`
  ).exec(wbRels);
  if (!ridMatch) throw new Error(`Relasi sheet "${chartSheetName}" tidak ditemukan`);
  let sheetPath = ridMatch[1];
  if (sheetPath.startsWith("/")) sheetPath = sheetPath.slice(1);
  if (!sheetPath.startsWith("xl/")) sheetPath = "xl/" + sheetPath;
  // Rel sheet berada di _rels di samping file sheet-nya, mis.
  // xl/worksheets/sheet3.xml -> xl/worksheets/_rels/sheet3.xml.rels
  const sheetRelPath = sheetPath.replace(/\/([^/]+)\.xml$/, "/_rels/$1.xml.rels");

  // 2. Nomor drawing baru (hindari tabrakan dengan yang sudah ada)
  let drawingN = 1;
  while (zip.file(`xl/drawings/drawing${drawingN}.xml`)) drawingN++;

  // 3. [Content_Types].xml — tambah override drawing & chart
  const ctPath = "[Content_Types].xml";
  let ct = await zip.file(ctPath)!.async("string");
  const addOverride = (part: string, type: string) => {
    if (!ct.includes(`PartName="/${part}"`)) {
      ct = ct.replace(
        "</Types>",
        `<Override PartName="/${part}" ContentType="${type}"/></Types>`
      );
    }
  };
  addOverride(
    `xl/drawings/drawing${drawingN}.xml`,
    "application/vnd.openxmlformats-officedocument.drawing+xml"
  );
  charts.forEach((_, i) =>
    addOverride(
      `xl/charts/${chartName(drawingN, i + 1)}.xml`,
      "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
    )
  );
  zip.file(ctPath, ct);

  // 4. Rels sheet → drawing (pakai rId numerik berikutnya agar kompatibel)
  const existingRels = zip.file(sheetRelPath)
    ? await zip.file(sheetRelPath)!.async("string")
    : null;
  const DRAW_RID = nextRelId(existingRels);
  const DRAW_REL =
    `<Relationship Id="${DRAW_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingN}.xml"/>`;
  if (existingRels !== null) {
    zip.file(
      sheetRelPath,
      existingRels.replace("</Relationships>", `${DRAW_REL}</Relationships>`)
    );
  } else {
    zip.file(
      sheetRelPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        DRAW_REL +
        `</Relationships>`
    );
  }

  // 5. Sheet XML — sisipkan <drawing/>
  //    Dalam CT_Worksheet, <drawing> harus berada SETELAH pageSetup/headerFooter
  //    dan SEBELUM legacyDrawing / picture / tableParts / extLst.
  let sheetXml = await zip.file(sheetPath)!.async("string");
  if (!/<drawing\s/.test(sheetXml)) {
    const AFTER_DRAWING =
      /<(?:legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)[\s>]/;
    const m = AFTER_DRAWING.exec(sheetXml);
    const drawingTag = `<drawing r:id="${DRAW_RID}"/>`;
    if (m) {
      sheetXml =
        sheetXml.slice(0, m.index) + drawingTag + sheetXml.slice(m.index);
    } else {
      sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `${drawingTag}</worksheet>`);
    }
  }
  zip.file(sheetPath, sheetXml);

  // 6. Drawing part + rels-nya
  zip.file(`xl/drawings/drawing${drawingN}.xml`, drawingXml(charts));
  zip.file(
    `xl/drawings/_rels/drawing${drawingN}.xml.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      charts
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${chartName(drawingN, i + 1)}.xml"/>`
        )
        .join("") +
      `</Relationships>`
  );

  // 7. Chart parts (data tersimpan sebagai cache + referensi sel langsung,
  //    jadi chart bersifat hidup: ikut jika data di sheet diubah)
  charts.forEach((cfg, i) => {
    zip.file(`xl/charts/${chartName(drawingN, i + 1)}.xml`, chartXml(cfg.type, cfg));
  });

  // 8. Tulis ulang
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await fs.promises.writeFile(xlsxPath, out);
}

// ─── Helper kecil ─────────────────────────────────────────────────────────────

/** rId numerik berikutnya yang belum dipakai (rels bisa berisi rId1..rIdN) */
function nextRelId(relsXml: string | null): string {
  let max = 0;
  if (relsXml) {
    for (const m of relsXml.matchAll(/Id="rId(\d+)"/g)) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return `rId${max + 1}`;
}

function chartName(drawingN: number, i: number): string {
  return `chart${drawingN}_${i}`;
}
