/**
 * POST /api/ai-detect
 *
 * Server-side route buat manggil Gemini. API key cuma di env server (gak pernah
 * ke browser). Input = teks LHP yang UDAH diredaksi PII-nya di client.
 *
 * Gemini cuma tugasnya IDENTIFIKASI perhitungan ("ada A + B = C di sini"),
 * BUKAN ngitung. Aritmatika tetap diverifikasi JavaScript di client.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AiCalc {
  kind: "percentage" | "sum" | "subtraction" | "multiplication";
  location: string;
  snippet: string;
  operands: number[];
  expected: number;
}

const RESPONSE_SCHEMA = {
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
            description: "Jenis operasi aritmatika",
          },
          location: {
            type: SchemaType.STRING,
            description: "Lokasi di dokumen, mis. nomor paragraf atau judul tabel",
          },
          snippet: {
            type: SchemaType.STRING,
            description: "Potongan kalimat asli yang memuat perhitungan",
          },
          operands: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.NUMBER },
            description:
              "Angka-angka operand. Untuk percentage: [pembilang, penyebut]. Untuk sum/subtraction/multiplication: angka-angka komponennya.",
          },
          expected: {
            type: SchemaType.NUMBER,
            description: "Hasil yang diklaim dokumen (angka, tanpa Rp/titik/persen)",
          },
        },
        required: ["kind", "location", "snippet", "operands", "expected"],
      },
    },
  },
  required: ["calcs"],
};

const SYSTEM_PROMPT = `Kamu asisten auditor BPK RI. Tugasmu: identifikasi SEMUA perhitungan aritmatika yang DIKLAIM dalam excerpt Laporan Hasil Pemeriksaan (LHP) berikut, supaya bisa diverifikasi (telstruk).

ATURAN:
- Identifikasi perhitungan saja, JANGAN menghitung sendiri. Ekstrak operand + hasil yang diklaim dokumen apa adanya.
- Jenis: "percentage" (X/Y*100), "sum" (A+B+C), "subtraction" (A-B), "multiplication" (A*B).
- operands & expected = angka murni (buang "Rp", titik ribuan, simbol %). Desimal pakai titik. Contoh "Rp1.234.567,89" -> 1234567.89. "23,5%" -> 23.5.
- Untuk percentage: operands = [pembilang, penyebut], expected = persen yang diklaim.
- Fokus ke perhitungan yang BENAR-BENAR ada angkanya di teks. Kalau ragu, lewati.
- JANGAN ulangi perhitungan yang trivial/tidak bermakna.
- Teks sudah diredaksi ([NAMA], [PENYEDIA], [NIK]) — abaikan placeholder itu, fokus ke angka.

Kembalikan JSON sesuai schema.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum di-set di server (.env.local)." },
      { status: 503 },
    );
  }

  let body: { content?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "content kosong." }, { status: 400 });
  }
  // Guard ukuran — hindari kirim payload kelewat gede.
  if (content.length > 600_000) {
    return NextResponse.json(
      { error: "Dokumen terlalu besar untuk AI pass (>600k char)." },
      { status: 413 },
    );
  }

  const modelName = body.model || "gemini-2.5-flash";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const result = await model.generateContent(content);
    const text = result.response.text();
    let parsed: { calcs?: AiCalc[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Gemini balik bukan JSON valid.", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const calcs = (parsed.calcs ?? []).filter(
      (c) => Array.isArray(c.operands) && c.operands.length > 0 && typeof c.expected === "number",
    );

    return NextResponse.json({
      calcs,
      model: modelName,
      usage: result.response.usageMetadata ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
