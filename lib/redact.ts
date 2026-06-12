/**
 * Redaksi PII sebelum teks dikirim ke Gemini.
 *
 * Prinsip (sesuai CLAUDE.md): LHP confidential. Yang dikirim ke AI cuma teks
 * yang udah dibuang identitas orang/penyedia — ANGKA & STRUKTUR tetap utuh
 * (itu yang dibutuhin buat deteksi perhitungan).
 *
 * Best-effort: gak sempurna (gak ada NER), tapi nutup PII yang paling umum di
 * LHP BPK: NIK/NIP, nama penyedia (CV/PT), dan nama orang setelah penanda
 * (a.n., Sdr., Bapak/Ibu, dll). Role/jabatan (BUD, PPK, Kepala Dinas) SENGAJA
 * dipertahankan karena gak sensitif + berguna buat konteks AI.
 */

const REDACTIONS: { re: RegExp; replace: string }[] = [
  // NIK / NIP — string digit panjang (16+) atau yang di-mask pakai X.
  // Hindari kena angka rupiah: rupiah selalu ada pemisah titik/koma.
  { re: /\b\d{6,}[X]{2,}\d*\b/gi, replace: "[NIK]" }, // 3527026302XXXXXX
  { re: /\b\d{15,18}\b/g, replace: "[NIK/NIP]" }, // 16-18 digit polos
  // Penyedia: "CV Nama Apa", "PT Nama Apa" — ambil sampai sebelum pemisah.
  {
    re: /\b(CV|PT|UD|PD)\.?\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,4}/g,
    replace: "$1 [PENYEDIA]",
  },
  // Nama orang setelah penanda eksplisit.
  {
    re: /\b(a\.n\.?|a\/n|Saudara|Sdr\.?|Sdri\.?|Bapak|Ibu|Bp\.?)\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}/g,
    replace: "$1 [NAMA]",
  },
  // Nama dengan gelar depan haji + nama (Hj. Nama, H. Nama).
  {
    re: /\b(Hj\.|H\.|Drs\.|Dra\.|Ir\.)\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}/g,
    replace: "$1 [NAMA]",
  },
];

export function redactText(input: string): string {
  let out = input;
  for (const { re, replace } of REDACTIONS) {
    out = out.replace(re, replace);
  }
  return out;
}

/** Redact array tabel (cell per cell). Angka dibiarkan, teks identitas diredact. */
export function redactRows(rows: string[][]): string[][] {
  return rows.map((row) => row.map((cell) => redactText(cell)));
}

/** Hitung berapa banyak PII yang ke-redact (buat transparansi ke user). */
export function countRedactions(input: string): number {
  let count = 0;
  for (const { re } of REDACTIONS) {
    const m = input.match(new RegExp(re.source, re.flags));
    if (m) count += m.length;
  }
  return count;
}
