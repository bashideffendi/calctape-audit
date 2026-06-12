/**
 * POST /api/ai-detect
 *
 * Dispatch ke provider AI sesuai pilihan user (Gemini / Claude, 2 tier each).
 * API key cuma di env server (gak pernah ke browser). Input = teks LHP yang
 * UDAH diredaksi PII-nya di client.
 *
 * Model cuma IDENTIFIKASI perhitungan, BUKAN ngitung. Aritmatika tetap
 * diverifikasi JavaScript di client.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { getModel, DEFAULT_MODEL_ID } from "@/lib/ai-models";
import {
  SYSTEM_PROMPT,
  CALC_JSON_SCHEMA,
  sanitizeCalcs,
  MAX_PAYLOAD_CHARS,
  type AiCalc,
} from "@/lib/ai-shared";

export const runtime = "nodejs";
// Vercel Pro: limit sampai 300s. AI full LHP butuh ~90-152s (Flash paling
// lambat). 120 kekecilan → 504. 300 kasih headroom aman.
export const maxDuration = 300;

// --- Gemini ---
const GEMINI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    calcs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          kind: {
            type: SchemaType.STRING,
            enum: ["percentage", "sum", "subtraction", "multiplication"],
          },
          location: { type: SchemaType.STRING },
          snippet: { type: SchemaType.STRING },
          operands: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
          expected: { type: SchemaType.NUMBER },
        },
        required: ["kind", "location", "snippet", "operands", "expected"],
      },
    },
  },
  required: ["calcs"],
};

async function callGemini(content: string, modelId: string): Promise<AiCalc[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("GEMINI_API_KEY belum di-set di .env.local", 503);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: GEMINI_SCHEMA as any,
    },
  });
  const result = await model.generateContent(content);
  const text = result.response.text();
  return sanitizeCalcs(JSON.parse(text));
}

// --- Claude ---
async function callClaude(content: string, modelId: string): Promise<AiCalc[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ProviderError("ANTHROPIC_API_KEY belum di-set di .env.local", 503);
  const client = new Anthropic({
    apiKey,
    // Opsional: override endpoint (mis. proxy). Kosongin buat pakai default Anthropic.
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
  const msg = await client.messages.create({
    model: modelId,
    // Gede: LHP bisa puluhan perhitungan. 8k kekecilan → tool-call kepotong →
    // JSON parsial → hasil kosong. 16k aman buat ~150 calc.
    max_tokens: 16000,
    temperature: 0,
    system: [
      // Prompt caching: instruksi statis di-cache (hemat kalau dipanggil berkali-kali).
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [
      {
        name: "lapor_perhitungan",
        description: "Laporkan semua perhitungan aritmatika yang teridentifikasi di LHP.",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: CALC_JSON_SCHEMA as any,
      },
    ],
    tool_choice: { type: "tool", name: "lapor_perhitungan" },
    messages: [{ role: "user", content }],
  });
  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    if (msg.stop_reason === "max_tokens") {
      throw new ProviderError(
        "Output Claude kepotong (max_tokens). Dokumen kebanyakan perhitungan — coba pisah / naikin limit.",
        502,
      );
    }
    return [];
  }
  return sanitizeCalcs(toolUse.input);
}

class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function POST(req: NextRequest) {
  let body: { content?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "content kosong." }, { status: 400 });
  if (content.length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json(
      { error: `Dokumen terlalu besar untuk AI pass (>${MAX_PAYLOAD_CHARS} char).` },
      { status: 413 },
    );
  }

  const modelInfo = getModel(body.model || DEFAULT_MODEL_ID);
  if (!modelInfo) {
    return NextResponse.json({ error: `Model "${body.model}" tidak dikenal.` }, { status: 400 });
  }

  try {
    const calcs =
      modelInfo.provider === "gemini"
        ? await callGemini(content, modelInfo.id)
        : await callClaude(content, modelInfo.id);
    return NextResponse.json({ calcs, model: modelInfo.id, provider: modelInfo.provider });
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "AI provider error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
