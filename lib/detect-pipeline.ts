/**
 * End-to-end pipeline: ExtractedDoc → DetectedCalc[] → CalcDocument.
 *
 * Memadukan hasil parser (mammoth) dengan pattern matcher (regex)
 * lalu format ke struktur CalcDocument yang siap di-render ke .calc.
 */

import type { CalcDocument, CalcGroup, CalcSection, DetectedCalc, ExtractedDoc } from "./types";
import { detectAllInParagraph, detectTableSums } from "./patterns";
import { makePctGroup, makeSubGroup, makeSumGroup } from "./calc-format";

/**
 * Step 1: Run detectors di seluruh ExtractedDoc.
 */
export function detectAllInDoc(doc: ExtractedDoc): DetectedCalc[] {
  const all: DetectedCalc[] = [];

  // Narrative paragraphs
  for (const p of doc.paragraphs) {
    all.push(...detectAllInParagraph(p.text, `P${p.index + 1}`));
  }

  // Tables
  for (const t of doc.tables) {
    all.push(...detectTableSums(t.rows, t.index, t.caption));
  }

  return all;
}

/**
 * Step 2: Convert DetectedCalc[] ke CalcDocument terstruktur.
 * Grouping: section per tipe (Narasi vs Tabel) — bisa di-customize lebih lanjut.
 */
export function buildCalcDocument(
  detected: DetectedCalc[],
  meta: { fileName?: string; date?: string } = {},
): CalcDocument {
  const narrativeGroups: CalcGroup[] = [];
  const tableGroups: CalcGroup[] = [];

  for (const d of detected) {
    const group = detectedToGroup(d);
    if (!group) continue;
    if (d.kind === "table-vertical") tableGroups.push(group);
    else narrativeGroups.push(group);
  }

  const sections: CalcSection[] = [];
  if (narrativeGroups.length > 0) {
    sections.push({
      title: "NARASI - Persentase / Selisih / Sum",
      groups: narrativeGroups,
    });
  }
  if (tableGroups.length > 0) {
    sections.push({
      title: "TABEL - Sum Vertikal Kolom Angka",
      groups: tableGroups,
    });
  }

  return {
    title: `TELSTRUK AUTO ${meta.fileName ?? ""}`.trim(),
    subtitleLines: meta.date ? [`Tanggal: ${meta.date}`] : [],
    sections,
  };
}

/** Translate DetectedCalc ke CalcGroup. */
function detectedToGroup(d: DetectedCalc): CalcGroup | null {
  const loc = d.location;
  const snippet = truncate(d.snippet, 80);

  switch (d.kind) {
    case "percentage":
      if (d.operands.length < 2) return null;
      return makePctGroup({
        label: `${loc} - Persentase`,
        location: snippet,
        numerator: d.operands[0],
        denominator: d.operands[1],
        expected: d.expected,
      });
    case "subtraction":
      // operands: [nominal] (selisih), expected: %
      // Sub case lebih variatif — placeholder buat MVP, skip ke null
      return null;
    case "sum":
      return makeSumGroup({
        label: `${loc} - Sum Narasi`,
        location: snippet,
        items: d.operands,
        expected: d.expected,
      });
    case "table-vertical":
      return makeSumGroup({
        label: `${loc} - Sum Tabel`,
        location: snippet,
        items: d.operands,
        expected: d.expected,
      });
    default:
      return null;
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 3) + "...";
}
