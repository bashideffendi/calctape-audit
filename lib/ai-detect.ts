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

/** Bangun payload teks ter-redaksi dari ExtractedDoc. */
export function buildRedactedPayload(doc: ExtractedDoc): string {
  const parts: string[] = [];
  for (const p of doc.paragraphs) {
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

/** Panggil API route dengan model pilihan. Throw kalau error (mis. key belum di-set). */
export async function aiDetect(doc: ExtractedDoc, modelId: string): Promise<AiDetectResult> {
  const content = buildRedactedPayload(doc);
  const res = await fetch("/api/ai-detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, model: modelId }),
  });
  const data: AiResponse = await res.json();
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
