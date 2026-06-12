/**
 * Regex pattern library buat auto-detect perhitungan di narasi LHP.
 *
 * SEMUA pattern di sini deterministik (regex murni, gak pakai LLM).
 * Coverage target ~80% (perhitungan yang format-nya predictable di LHP BPK).
 */

import type { DetectedCalc } from "./types";

/**
 * Parse angka rupiah Indonesian: "1.234.567,89" → 1234567.89
 * Atau "1.234.567,890123" → 1234567.890123 (lebih dari 2 desimal)
 */
export function parseIdNumber(s: string): number {
  // Hapus "Rp", spasi, dan trailing ",00" stripping kalau ada
  const cleaned = s.replace(/Rp\s*/gi, "").replace(/\s/g, "");
  // Convert ID format "1.234,56" → "1234.56"
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized);
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

/** Run all narrative detectors. */
export function detectAllInParagraph(text: string, location: string): DetectedCalc[] {
  return [
    ...detectPercentages(text, location),
    ...detectDeltas(text, location),
    ...detectSums(text, location),
  ];
}

/**
 * Detect numeric columns dalam tabel: cari kolom yang isinya angka,
 * lalu cek baris terakhir (Total/Jumlah) — apakah cocok dengan sum data rows.
 */
export function detectTableSums(
  rows: string[][],
  tableIndex: number,
): DetectedCalc[] {
  if (rows.length < 3) return []; // need header + 1 data + 1 total minimum
  const results: DetectedCalc[] = [];
  const lastRowIdx = rows.length - 1;
  const lastRow = rows[lastRowIdx];
  // Heuristic: last row first cell mengandung "Jumlah", "Total", "JUMLAH", "TOTAL"
  const totalKeywords = /(jumlah|total)/i;
  const isTotalRow =
    lastRow.length > 0 &&
    (totalKeywords.test(lastRow[0]) ||
      (lastRow[0] === "" && lastRow.some((c) => totalKeywords.test(c))));
  if (!isTotalRow) return [];

  const numCols = Math.max(...rows.map((r) => r.length));
  for (let col = 0; col < numCols; col++) {
    const totalCellRaw = lastRow[col] ?? "";
    const totalVal = parseIdNumber(totalCellRaw);
    if (isNaN(totalVal) || !/[\d.,]+/.test(totalCellRaw)) continue;
    if (Math.abs(totalVal) < 0.01) continue; // skip totals=0

    // Collect data row values (rows 1 to lastRowIdx-1, skip row 0 = header)
    const dataVals: number[] = [];
    for (let r = 1; r < lastRowIdx; r++) {
      const cell = rows[r][col] ?? "";
      const v = parseIdNumber(cell);
      if (!isNaN(v)) dataVals.push(v);
    }
    if (dataVals.length < 2) continue;
    const sum = dataVals.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - totalVal) < 0.01) {
      results.push({
        kind: "table-vertical",
        location: `Tabel ${tableIndex + 1} Col ${col + 1}`,
        snippet: `Sum kolom ${col + 1} (${dataVals.length} entries) = ${totalCellRaw}`,
        operands: dataVals,
        expected: totalVal,
        confidence: "high",
      });
    }
  }
  return results;
}
