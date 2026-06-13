/**
 * Client helper: kirim dokumen ter-redaksi ke /api/ai-detect, dapet DetectedCalc[].
 * Plus utilitas bandingin hasil regex vs Gemini.
 */

import type { DetectedCalc, ExtractedDoc } from "./types";
import { redactText, redactRows } from "./redact";

interface AiResponse {
  calcs?: Omit<DetectedCalc, "confidence">[];
  error?: string;
  model?: string;
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number } | null;
}

/**
 * Bangun payload teks ter-redaksi dari ExtractedDoc — paragraf + TABEL.
 *
 * CATATAN (hasil benchmark): sempat dicoba narasi-only (skip tabel) buat hemat
 * token — TAPI coverage anjlok separuh (76→33 temuan). Ternyata AI ekstrak
 * banyak perhitungan DARI DALAM tabel (total per-baris, cross-check antar
 * kolom) yang beda dari sum kolom yang regex lakuin. Jadi tabel WAJIB dikirim.
 * Trade-off: full payload ~2x lebih lambat tapi coverage 2x lebih lengkap —
 * buat tool telstruk, completeness menang.
 *
 * Optimasi aman yang dipertahankan: skip paragraf tanpa angka (gak mungkin
 * ada perhitungan di situ).
 */
export function buildRedactedPayload(doc: ExtractedDoc): string {
  const parts: string[] = [];
  for (const p of doc.paragraphs) {
    if (!/\d/.test(p.text)) continue; // skip paragraf tanpa angka
    parts.push(`[P${p.index + 1}] ${redactText(p.text)}`);
  }
  for (const t of doc.tables) {
    parts.push(`\n[TABEL ${t.index + 1}${t.caption ? " — " + redactText(t.caption) : ""}]`);
    for (const row of redactRows(t.rows)) {
      parts.push("  " + row.join(" | "));
    }
  }
  return parts.join("\n");
}

export interface AiDetectResult {
  calcs: DetectedCalc[];
  model: string;
  usage: AiResponse["usage"];
}

/** Panggil API route dengan model pilihan + password. Throw kalau error. */
export async function aiDetect(
  doc: ExtractedDoc,
  modelId: string,
  password?: string,
): Promise<AiDetectResult> {
  const content = buildRedactedPayload(doc);
  const res = await fetch("/api/ai-detect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(password ? { "x-ai-password": password } : {}),
    },
    body: JSON.stringify({ content, model: modelId }),
  });
  // Graceful: server kadang balik HTML (mis. 504 timeout), bukan JSON.
  const raw = await res.text();
  let data: AiResponse;
  try {
    data = JSON.parse(raw);
  } catch {
    if (res.status === 504 || /timeout/i.test(raw)) {
      throw new Error(
        "AI timeout di server — dokumen kebesaran / model kelamaan. Coba model lebih cepat atau jalankan lokal.",
      );
    }
    throw new Error(`AI gagal (HTTP ${res.status}). Respons server bukan JSON.`);
  }
  if (!res.ok) {
    throw new Error(data.error || `AI detect gagal (${res.status})`);
  }
  const calcs: DetectedCalc[] = (data.calcs ?? []).map((c) => ({
    ...c,
    confidence: "low" as const,
  }));
  return { calcs, model: data.model ?? "gemini", usage: data.usage ?? null };
}

/** Key buat dedup/banding: tipe + expected (dibulatkan) + operand pertama. */
function calcKey(c: DetectedCalc): string {
  const exp = Math.round(c.expected * 100) / 100;
  const firstOp = c.operands[0] != null ? Math.round(c.operands[0]) : 0;
  return `${c.kind}|${exp}|${firstOp}`;
}

export interface Comparison {
  both: DetectedCalc[];
  regexOnly: DetectedCalc[];
  geminiOnly: DetectedCalc[];
}

/** Bandingin hasil regex vs Gemini berdasarkan kesamaan (tipe+hasil+operand). */
export function compareDetections(
  regex: DetectedCalc[],
  gemini: DetectedCalc[],
): Comparison {
  const regexKeys = new Set(regex.map(calcKey));
  const geminiKeys = new Set(gemini.map(calcKey));

  const both = regex.filter((c) => geminiKeys.has(calcKey(c)));
  const regexOnly = regex.filter((c) => !geminiKeys.has(calcKey(c)));
  const geminiOnly = gemini.filter((c) => !regexKeys.has(calcKey(c)));

  return { both, regexOnly, geminiOnly };
}
