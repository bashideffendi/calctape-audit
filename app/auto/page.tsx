"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DetectedCalc, ExtractedDoc } from "@/lib/types";
import { extractDocx } from "@/lib/docx-extract";
import { detectAllInDoc, buildCalcDocument } from "@/lib/detect-pipeline";
import { renderCalcDocument, fmtNumber } from "@/lib/calc-format";
import { aiDetect, compareDetections, type Comparison } from "@/lib/ai-detect";

type Status = "idle" | "parsing" | "ready" | "error";
type AiStatus = "idle" | "running" | "done" | "error";

export default function AutoImportPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedDoc | null>(null);
  const [detected, setDetected] = useState<DetectedCalc[]>([]);
  const [filter, setFilter] = useState<"all" | "percentage" | "sum" | "table-vertical">(
    "all",
  );
  // --- AI (Gemini) comparison state ---
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string>("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setStatus("parsing");
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "docx") {
        throw new Error(
          `Format .${ext} belum didukung. Phase 1 cuma .docx — Excel & PDF di phase berikutnya.`,
        );
      }
      const buffer = await file.arrayBuffer();
      const doc = await extractDocx(buffer);
      const calcs = detectAllInDoc(doc);
      setExtracted(doc);
      setDetected(calcs);
      // reset AI state buat file baru
      setAiStatus("idle");
      setAiError(null);
      setComparison(null);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal parse dokumen");
      setStatus("error");
    }
  }, []);

  const runAiCompare = useCallback(async () => {
    if (!extracted) return;
    setAiStatus("running");
    setAiError(null);
    try {
      const result = await aiDetect(extracted);
      setAiModel(result.model);
      setComparison(compareDetections(detected, result.calcs));
      setAiStatus("done");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI detect gagal");
      setAiStatus("error");
    }
  }, [extracted, detected]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return detected;
    return detected.filter((d) => d.kind === filter);
  }, [detected, filter]);

  const stats = useMemo(() => {
    const total = detected.length;
    const correct = detected.filter((d) => {
      const computed = computeFor(d);
      return Math.abs(computed - d.expected) < 0.01;
    }).length;
    return { total, correct, off: total - correct };
  }, [detected]);

  const downloadCalc = useCallback(() => {
    if (!detected.length) return;
    const calcDoc = buildCalcDocument(detected, {
      fileName: fileName.replace(/\.docx?$/i, ""),
      date: new Date().toISOString().slice(0, 10),
    });
    const text = renderCalcDocument(calcDoc);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Telstruk_${fileName.replace(/\.docx?$/i, "")}.calc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [detected, fileName]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-sm">←</span>
            <span className="text-sm font-bold gradient-text">CalcTape Audit</span>
            <span className="text-[10px] text-gray-400">Auto Import</span>
          </Link>
          <div className="flex items-center gap-2">
            {status === "ready" && (
              <button
                onClick={downloadCalc}
                className="btn-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                Download .calc
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {status === "idle" && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 rounded-2xl p-12 text-center cursor-pointer transition"
          >
            <div className="text-5xl mb-3">📄</div>
            <div className="text-lg font-semibold text-gray-700 mb-2">
              Drop file <span className="font-mono text-blue-600">.docx</span>{" "}
              di sini
            </div>
            <div className="text-xs text-gray-500">
              atau klik buat pilih file. Phase 1 cuma .docx; Excel & PDF di
              phase berikutnya.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />
          </div>
        )}

        {status === "parsing" && (
          <div className="text-center py-20 text-gray-500">
            <div className="text-4xl mb-3">⏳</div>
            <div>Parsing {fileName}…</div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
            <div className="font-bold mb-1">Gagal parse</div>
            <div className="text-sm">{error}</div>
            <button
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
              className="mt-4 btn-sm bg-red-100 text-red-700 hover:bg-red-200"
            >
              Coba lagi
            </button>
          </div>
        )}

        {status === "ready" && extracted && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-gray-800">{fileName}</div>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setDetected([]);
                    setExtracted(null);
                    setFileName("");
                    setAiStatus("idle");
                    setComparison(null);
                    setAiError(null);
                  }}
                  className="btn-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Stat label="Paragraf" value={extracted.paragraphs.length} />
                <Stat label="Tabel" value={extracted.tables.length} />
                <Stat label="Perhitungan" value={detected.length} />
                <Stat label="Cocok" value={stats.correct} color="text-green-600" />
                <Stat
                  label="Selisih"
                  value={stats.off}
                  color={stats.off > 0 ? "text-red-600" : "text-gray-400"}
                />
              </div>
            </div>

            {/* AI (Gemini) comparison */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    ✨ Bandingin dengan Gemini
                    {aiModel && (
                      <span className="text-[10px] font-normal text-indigo-500">
                        {aiModel}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-indigo-600/80 mt-0.5">
                    AI cari perhitungan yang regex kelewat. Nama/NIK/penyedia
                    di-redaksi dulu sebelum dikirim.
                  </div>
                </div>
                <button
                  onClick={runAiCompare}
                  disabled={aiStatus === "running"}
                  className={`btn-sm ${
                    aiStatus === "running"
                      ? "bg-indigo-200 text-indigo-500 cursor-wait"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {aiStatus === "running"
                    ? "Menganalisis…"
                    : aiStatus === "done"
                      ? "Jalankan lagi"
                      : "Jalankan Gemini"}
                </button>
              </div>

              {aiStatus === "error" && (
                <div className="mt-3 text-xs bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  <div className="font-semibold">Gagal:</div>
                  <div>{aiError}</div>
                  {aiError?.includes("GEMINI_API_KEY") && (
                    <div className="mt-1 text-red-500">
                      → Tambah <span className="font-mono">GEMINI_API_KEY</span>{" "}
                      ke <span className="font-mono">.env.local</span> lalu
                      restart server.
                    </div>
                  )}
                </div>
              )}

              {comparison && aiStatus === "done" && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <CompareStat
                    label="Regex saja"
                    sub="Gemini gak nemu"
                    value={comparison.regexOnly.length}
                    color="text-blue-600"
                  />
                  <CompareStat
                    label="Keduanya"
                    sub="Sama-sama nemu"
                    value={comparison.both.length}
                    color="text-green-600"
                  />
                  <CompareStat
                    label="Gemini saja"
                    sub="Regex kelewat"
                    value={comparison.geminiOnly.length}
                    color="text-purple-600"
                  />
                </div>
              )}

              {comparison && comparison.geminiOnly.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wide mb-2">
                    Yang cuma Gemini nemu (regex kelewat) — perlu kamu review
                  </div>
                  <div className="space-y-2">
                    {comparison.geminiOnly.map((d, i) => (
                      <DetectedCard key={`g${i}`} detected={d} aiTag />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "percentage", "sum", "table-vertical"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`btn-sm ${
                    filter === k
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {k === "all"
                    ? `Semua (${detected.length})`
                    : k === "percentage"
                      ? `Persentase (${detected.filter((d) => d.kind === "percentage").length})`
                      : k === "sum"
                        ? `Sum Narasi (${detected.filter((d) => d.kind === "sum").length})`
                        : `Sum Tabel (${detected.filter((d) => d.kind === "table-vertical").length})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Belum ada perhitungan yang ke-detect di kategori ini.
                </div>
              ) : (
                filtered.map((d, i) => (
                  <DetectedCard key={i} detected={d} />
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-xl font-bold ${color ?? "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}

function CompareStat({
  label,
  sub,
  value,
  color,
}: {
  label: string;
  sub: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white/70 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color ?? "text-gray-800"}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-gray-700">{label}</div>
      <div className="text-[9px] text-gray-400">{sub}</div>
    </div>
  );
}

function DetectedCard({
  detected,
  aiTag,
}: {
  detected: DetectedCalc;
  aiTag?: boolean;
}) {
  const computed = computeFor(detected);
  const cocok = Math.abs(computed - detected.expected) < 0.01;
  const kindLabel: Record<DetectedCalc["kind"], string> = {
    percentage: "Persentase",
    sum: "Sum Narasi",
    "table-vertical": "Sum Tabel",
    subtraction: "Selisih",
    multiplication: "Perkalian",
  };
  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        aiTag ? "border-purple-200" : cocok ? "border-green-200" : "border-red-200"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          {aiTag && (
            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mr-2">
              ✨ AI
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mr-2">
            {kindLabel[detected.kind]}
          </span>
          <span className="text-[10px] text-gray-400">{detected.location}</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            cocok
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {cocok ? "✓ COCOK" : "✗ SELISIH"}
        </span>
      </div>
      <div className="text-xs text-gray-600 mb-2 line-clamp-2">{detected.snippet}</div>
      <div className="font-mono text-xs grid grid-cols-3 gap-2 text-gray-700">
        <div>
          <div className="text-[10px] text-gray-400">Computed</div>
          <div>{fmtNumber(computed)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">LHP klaim</div>
          <div>{fmtNumber(detected.expected)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">Selisih</div>
          <div
            className={
              cocok ? "text-green-600" : "text-red-600 font-semibold"
            }
          >
            {fmtNumber(Math.abs(computed - detected.expected))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compute hasil aritmatika dari operand DetectedCalc (untuk visual cross-check). */
function computeFor(d: DetectedCalc): number {
  switch (d.kind) {
    case "percentage":
      if (d.operands.length < 2 || d.operands[1] === 0) return NaN;
      return (d.operands[0] / d.operands[1]) * 100;
    case "sum":
    case "table-vertical":
      return d.operands.reduce((a, b) => a + b, 0);
    case "subtraction":
      return d.operands[0] ?? 0;
    case "multiplication":
      return d.operands.reduce((a, b) => a * b, 1);
  }
}
