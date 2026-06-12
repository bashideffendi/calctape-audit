/**
 * Tipe shared untuk CalcTape Audit.
 */

export type Op = "+" | "-" | "*" | "/";

export interface CalcEntry {
  op: Op;
  value: number;
  decimals?: number;
}

export interface CalcGroup {
  /** Heading di atas perhitungan (mis. "Tabel 2 Listrik - Sum kolom Selisih"). */
  label: string;
  /** Sub-label / lokasi (mis. "Hal 16, Tabel 2"). Optional. */
  location?: string;
  entries: CalcEntry[];
  /** Expected result yang diklaim di dokumen. Undefined = belum di-claim. */
  expected?: number;
  /** Result decimals (override default 2). */
  resultDecimals?: number;
}

export interface CalcSection {
  /** Header section (mis. "TP 1 BPHTB..."). */
  title: string;
  /** Sub-text dibawah judul. */
  subtitle?: string;
  groups: CalcGroup[];
}

export interface CalcDocument {
  /** Document title (line pertama dari .calc body). */
  title: string;
  /** Subtitle lines. */
  subtitleLines?: string[];
  sections: CalcSection[];
}

/** Hasil detect perhitungan dari narasi LHP. */
export interface DetectedCalc {
  /** Tipe perhitungan. */
  kind: "percentage" | "subtraction" | "sum" | "table-vertical" | "multiplication";
  /** Lokasi di dokumen (mis. "P138" atau "Tabel 2 R1"). */
  location: string;
  /** Snippet teks asli dari dokumen. */
  snippet: string;
  /** Operands. */
  operands: number[];
  /** Expected hasil dari dokumen. */
  expected: number;
  /** Confidence level: high (regex match), medium (semi-deterministic), low (AI). */
  confidence: "high" | "medium" | "low";
}

/** Tabel hasil extract dari .docx. */
export interface ExtractedTable {
  /** Index tabel di dokumen (0-based). */
  index: number;
  /** Row data: array of rows, each row = array of cell strings. */
  rows: string[][];
  /** Caption/judul tabel kalau bisa di-detect dari paragraf sebelumnya. */
  caption?: string;
}

export interface ExtractedDoc {
  paragraphs: { index: number; text: string }[];
  tables: ExtractedTable[];
}
