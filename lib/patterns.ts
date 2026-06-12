/**
 * Regex pattern library buat auto-detect perhitungan di narasi LHP.
 *
 * SEMUA pattern di sini deterministik (regex murni, gak pakai LLM).
 * Coverage target ~80% (perhitungan yang format-nya predictable di LHP BPK).
 */

import type { DetectedCalc } from "./types";

/**
 * Parse angka rupiah Indonesian: "1.234.567,89" → 1234567.89
 * Handle juga:
 *   - negatif akuntansi kurung: "(18.144.689.040,00)" → -18144689040
 *   - prefix "Rp", spasi, minus
 *   - cell yang ada teks nyampur (diambil bagian angkanya)
 */
export function parseIdNumber(s: string): number {
  if (!s) return NaN;
  let str = String(s).trim();
  let neg = false;
  // Negatif akuntansi: dibungkus kurung
  if (/^\(.*\)$/.test(str)) {
    neg = true;
    str = str.slice(1, -1);
  }
  str = str.replace(/Rp/gi, "").replace(/\s/g, "");
  if (str.startsWith("-") || str.startsWith("−")) {
    neg = true;
    str = str.slice(1);
  }
  // Sisakan cuma digit, titik, koma
  str = str.replace(/[^0-9.,]/g, "");
  if (!str || !/\d/.test(str)) return NaN;
  // Convert ID format "1.234,56" → "1234.56"
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  if (isNaN(n)) return NaN;
  return neg ? -n : n;
}

/**
 * Pattern 1: Persentase realisasi / capaian.
 *   "Rp X atau Y% dari anggaran sebesar Rp Z"
 *   "Rp X atau Y% dari Rp Z"
 */
const PCT_PATTERN =
  /Rp\s*([\d.,]+)\s+atau\s+(?:sebesar\s+)?([\d,]+)\s*%\s+dari\s+(?:anggaran\s+sebesar\s+)?Rp\s*([\d.,]+)/gi;

/**
 * Pattern 2: Kenaikan/Penurunan dengan nominal + persentase.
 *   "naik sebesar Rp X atau Y% dibanding..."
 *   "turun sebesar Rp X atau Y%"
 *   "kenaikan/penurunan sebesar Rp X atau Y%"
 */
const DELTA_PATTERN =
  /(?:naik|turun|kenaikan|penurunan|meningkat|menurun)\s+sebesar\s+Rp\s*([\d.,]+)\s+atau\s+(?:sebesar\s+)?([\d,]+)\s*%/gi;

/**
 * Pattern 3: Sum narasi explicit (parenthesis).
 *   "Rp X (Rp A + Rp B)"
 *   "Rp X (Rp A + Rp B + Rp C)"
 */
const SUM_PATTERN =
  /Rp\s*([\d.,]+)\s*\(\s*Rp\s*([\d.,]+)\s*(?:\+\s*Rp\s*([\d.,]+)\s*)+\)/gi;

/**
 * Pattern 4: Multiply (tarif x bulan / volume x harga).
 *   "X x Y per bulan/hari/orang"  -- harder to standardize
 *   Skip dulu, butuh context-aware.
 */

/** Extract semua persentase claim dari teks. */
export function detectPercentages(text: string, location: string): DetectedCalc[] {
  const results: DetectedCalc[] = [];
  const matches = Array.from(text.matchAll(PCT_PATTERN));
  for (const m of matches) {
    const numerator = parseIdNumber(m[1]);
    const pctClaimed = parseFloat(m[2].replace(",", "."));
    const denominator = parseIdNumber(m[3]);

    if (
      isNaN(numerator) ||
      isNaN(denominator) ||
      isNaN(pctClaimed) ||
      denominator === 0
    ) {
      continue;
    }

    results.push({
      kind: "percentage",
      location,
      snippet: m[0],
      operands: [numerator, denominator],
      expected: pctClaimed,
      confidence: "high",
    });
  }
  return results;
}

/** Extract delta (kenaikan/penurunan) claims. */
export function detectDeltas(text: string, location: string): DetectedCalc[] {
  const results: DetectedCalc[] = [];
  const matches = Array.from(text.matchAll(DELTA_PATTERN));
  for (const m of matches) {
    const nominal = parseIdNumber(m[1]);
    const pct = parseFloat(m[2].replace(",", "."));
    if (isNaN(nominal) || isNaN(pct)) continue;
    results.push({
      kind: "subtraction",
      location,
      snippet: m[0],
      operands: [nominal],
      expected: pct,
      confidence: "high",
    });
  }
  return results;
}

/** Extract sum narasi (Rp X (Rp A + Rp B + ...)). */
export function detectSums(text: string, location: string): DetectedCalc[] {
  const results: DetectedCalc[] = [];
  // Pakai pattern flexible: cari grouped Rp X (...components...)
  const re = /Rp\s*([\d.,]+)\s*\(\s*((?:Rp\s*[\d.,]+\s*[+]\s*)+Rp\s*[\d.,]+)\s*\)/gi;
  const matches = Array.from(text.matchAll(re));
  for (const m of matches) {
    const total = parseIdNumber(m[1]);
    const componentsText = m[2];
    const componentMatches = Array.from(componentsText.matchAll(/Rp\s*([\d.,]+)/gi));
    const components = componentMatches.map((cm) => parseIdNumber(cm[1])).filter((n) => !isNaN(n));
    if (components.length < 2 || isNaN(total)) continue;
    results.push({
      kind: "sum",
      location,
      snippet: m[0],
      operands: components,
      expected: total,
      confidence: "high",
    });
  }
  return results;
}

/**
 * Run narrative detectors.
 * NOTE: detectDeltas SENGAJA tidak dipakai di Phase 1 — pattern "naik Rp X atau
 * Y%" cuma nangkep nominal + %, gak nangkep base value, jadi gak bisa
 * diverifikasi standalone (malah bikin false "selisih"). Dihidupkan di Phase 2
 * dengan nangkep base value ("dibanding tahun lalu sebesar Rp Z").
 */
export function detectAllInParagraph(text: string, location: string): DetectedCalc[] {
  return [
    ...detectPercentages(text, location),
    ...detectSums(text, location),
  ];
}

/**
 * Detect sum vertikal kolom tabel.
 *
 * MASALAH UTAMA tabel BPK: baris "Jumlah/Total" sering pakai MERGED CELL buat
 * label-nya (mis. "Jumlah" nge-span 4 kolom pertama), jadi nilai total
 * "ke-geser" ke index kolom yang lebih kecil dari kolom datanya. Contoh:
 *   data:  [No, SKPD, SP2D, Riil, Selisih]   (5 sel)
 *   total: ["Jumlah", 104.559.459]           (2 sel) <- total Selisih di idx 1!
 *
 * Solusi: RIGHT-ALIGN. Nilai numeric di baris total — dalam urutan kiri→kanan —
 * dipasangkan ke kolom data numeric dari KANAN. Merge selalu makan kolom kiri
 * (label), jadi kolom angka paling kanan pasti align.
 */
export function detectTableSums(
  rows: string[][],
  tableIndex: number,
  caption?: string,
): DetectedCalc[] {
  if (rows.length < 3) return []; // header + ≥1 data + total
  const lastRowIdx = rows.length - 1;
  const lastRow = rows[lastRowIdx];
  const header = rows[0] ?? [];
  const totalKeywords = /(jumlah|total)/i;
  if (!lastRow.some((c) => totalKeywords.test(c))) return [];

  const numCols = Math.max(...rows.map((r) => r.length));

  // Kolom yang DIKECUALIIN dari sum (bukan kolom nilai): No, Tahun, persen.
  // Header-based — biar gak salah pasang total.
  const isExcludedHeader = (h: string): boolean =>
    /^\s*no\.?\s*$/i.test(h) ||
    /tahun/i.test(h) ||
    /%|persen/i.test(h);

  // Baris sub-level (mis. "2.1", "2.2") = komponen subtotal → jangan ikut di-sum
  // (kalau di-sum bareng induknya bakal dobel). Cek kolom pertama.
  const isSubLevelRow = (row: string[]): boolean =>
    /^\s*\d+\.\d+/.test(row[0] ?? "");

  // 1. Kumpulin kolom data numeric (kiri→kanan), beserta sum-nya.
  const dataCols: { col: number; vals: number[]; sum: number }[] = [];
  for (let col = 0; col < numCols; col++) {
    if (isExcludedHeader(header[col] ?? "")) continue;
    const vals: number[] = [];
    for (let r = 1; r < lastRowIdx; r++) {
      if (isSubLevelRow(rows[r])) continue;
      const v = parseIdNumber(rows[r][col] ?? "");
      if (!isNaN(v)) vals.push(v);
    }
    if (vals.length >= 2) {
      dataCols.push({ col, vals, sum: vals.reduce((a, b) => a + b, 0) });
    }
  }
  if (dataCols.length === 0) return [];

  // 2. Nilai numeric di baris total (kiri→kanan).
  // PENTING: jangan buang nilai 0 — itu total yang sah (mis. kolom "Tidak Dapat
  // Ditindaklanjuti" = 0). Buang cuma NaN (sel label/kosong) biar right-align
  // gak geser posisi.
  const totalNums: number[] = [];
  for (let c = 0; c < lastRow.length; c++) {
    const v = parseIdNumber(lastRow[c] ?? "");
    if (!isNaN(v)) totalNums.push(v);
  }
  if (totalNums.length === 0 || totalNums.length > dataCols.length) {
    // Kalau total lebih banyak dari kolom data, layout aneh — skip (hindari salah pasang).
    return [];
  }

  // 3. Right-align: total[i] ↔ dataCols[offset + i].
  const offset = dataCols.length - totalNums.length;
  const capLabel = caption ? caption.replace(/\s+/g, " ").slice(0, 45) : `Tabel ${tableIndex + 1}`;
  const results: DetectedCalc[] = [];
  for (let i = 0; i < totalNums.length; i++) {
    const dc = dataCols[offset + i];
    results.push({
      kind: "table-vertical",
      location: `${capLabel} · kolom ${dc.col + 1}`,
      snippet: `Sum ${dc.vals.length} baris kolom ${dc.col + 1}`,
      operands: dc.vals,
      expected: totalNums[i],
      confidence: "high",
    });
  }
  return results;
}
