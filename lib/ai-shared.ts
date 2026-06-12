/**
 * Prompt + schema + tipe yang dipakai bareng kedua provider (Gemini & Claude).
 */

export interface AiCalc {
  kind: "percentage" | "sum" | "subtraction" | "multiplication";
  location: string;
  snippet: string;
  operands: number[];
  expected: number;
}

export const SYSTEM_PROMPT = `Kamu asisten auditor BPK RI. Tugasmu: identifikasi SEMUA perhitungan aritmatika yang DIKLAIM dalam excerpt Laporan Hasil Pemeriksaan (LHP) berikut, supaya bisa diverifikasi (telstruk).

ATURAN:
- Identifikasi perhitungan saja, JANGAN menghitung sendiri. Ekstrak operand + hasil yang diklaim dokumen apa adanya.
- Jenis: "percentage" (X/Y*100), "sum" (A+B+C), "subtraction" (A-B), "multiplication" (A*B).
- operands & expected = angka murni (buang "Rp", titik ribuan, simbol %). Desimal pakai titik. Contoh "Rp1.234.567,89" -> 1234567.89. "23,5%" -> 23.5.
- Untuk percentage: operands = [pembilang, penyebut], expected = persen yang diklaim.
- Fokus ke perhitungan yang BENAR-BENAR ada angkanya di teks. Kalau ragu, lewati.
- JANGAN ulangi perhitungan yang trivial/tidak bermakna.
- Teks sudah diredaksi ([NAMA], [PENYEDIA], [NIK]) — abaikan placeholder itu, fokus ke angka.

Kembalikan daftar perhitungan sesuai format yang diminta.`;

/** Plain JSON Schema (dipakai Claude tool input_schema). */
export const CALC_JSON_SCHEMA = {
  type: "object",
  properties: {
    calcs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["percentage", "sum", "subtraction", "multiplication"],
            description: "Jenis operasi aritmatika",
          },
          location: {
            type: "string",
            description: "Lokasi di dokumen (nomor paragraf / judul tabel)",
          },
          snippet: {
            type: "string",
            description: "Potongan kalimat asli yang memuat perhitungan",
          },
          operands: {
            type: "array",
            items: { type: "number" },
            description:
              "Angka operand. percentage: [pembilang, penyebut]. sum/subtraction/multiplication: komponennya.",
          },
          expected: {
            type: "number",
            description: "Hasil yang diklaim dokumen (angka murni)",
          },
        },
        required: ["kind", "location", "snippet", "operands", "expected"],
      },
    },
  },
  required: ["calcs"],
} as const;

/** Validasi + bersihin hasil dari model. */
export function sanitizeCalcs(raw: unknown): AiCalc[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { calcs?: unknown }).calcs;
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (c): c is AiCalc =>
      c &&
      typeof c === "object" &&
      Array.isArray((c as AiCalc).operands) &&
      (c as AiCalc).operands.length > 0 &&
      typeof (c as AiCalc).expected === "number",
  );
}

export const MAX_PAYLOAD_CHARS = 600_000;
