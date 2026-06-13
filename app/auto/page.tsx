"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DetectedCalc, ExtractedDoc } from "@/lib/types";
import { extractDocx } from "@/lib/docx-extract";
import { detectAllInDoc, buildCalcDocument } from "@/lib/detect-pipeline";
import { renderCalcDocument, fmtNumber } from "@/lib/calc-format";
import { aiDetect, compareDetections, type Comparison } from "@/lib/ai-detect";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/ai-models";

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
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [aiPassword, setAiPassword] = useState<string>("");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  // restore password dari session (sekali ketik per sesi browser)
  useEffect(() => {
    const saved = sessionStorage.getItem("calctape_ai_pw");
    if (saved) setAiPassword(saved);
  }, []);
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
      // simpen password di session biar gak ngetik ulang tiap run
      if (aiPassword) sessionStorage.setItem("calctape_ai_pw", aiPassword);
      const result = await aiDetect(extracted, selectedModel, aiPassword);
      setAiModel(result.model);
      setComparison(compareDetections(detected, result.calcs));
      setAiStatus("done");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI detect gagal");
      setAiStatus("error");
    }
  }, [extracted, detected, selectedModel, aiPassword]);

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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-baseline gap-2 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span className="text-sm">&larr;</span>
            <span className="wordmark text-sm">
              Calc<span className="mark">Tape</span>
            </span>
            <span className="text-[11px] text-slate-400">Impor Otomatis</span>
          </Link>
          <div className="flex items-center gap-2">
            {status === "ready" && (
              <button
                onClick={downloadCalc}
                className="btn-sm bg-slate-900 text-white hover:bg-slate-700"
              >
                Unduh .calc
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {status === "idle" && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-slate-300 hover:border-slate-900 hover:bg-white rounded-xl p-14 text-center cursor-pointer transition-colors bg-white/50"
          >
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-slate-900 text-white mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </span>
            <div className="text-base font-semibold text-slate-900 mb-1">
              Letakkan dokumen{" "}
              <span className="num text-blue-700">.docx</span> di sini
            </div>
            <div className="text-xs text-slate-500">
              atau klik untuk memilih berkas. Saat ini mendukung format Word
              (.docx).
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
          <div className="text-center py-24 text-slate-500">
            <div className="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mb-3" />
            <div className="text-sm">Memproses {fileName}…</div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-white border border-rose-200 rounded-xl p-6">
            <div className="font-semibold text-rose-700 mb-1">
              Gagal memproses dokumen
            </div>
            <div className="text-sm text-slate-600">{error}</div>
            <button
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
              className="mt-4 btn-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Coba lagi
            </button>
          </div>
        )}

        {status === "ready" && extracted && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-slate-900 text-sm truncate">
                  {fileName}
                </div>
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
                  className="btn-sm bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Stat label="Paragraf" value={extracted.paragraphs.length} />
                <Stat label="Tabel" value={extracted.tables.length} />
                <Stat label="Perhitungan" value={detected.length} />
                <Stat label="Cocok" value={stats.correct} color="text-emerald-600" />
                <Stat
                  label="Selisih"
                  value={stats.off}
                  color={stats.off > 0 ? "text-rose-600" : "text-slate-400"}
                />
              </div>
            </div>

            {/* Pemeriksaan AI */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    Pemeriksaan AI
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                    Menemukan perhitungan yang lolos dari deteksi pola. Identitas
                    pada dokumen diredaksi sebelum dikirim.
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="password"
                    value={aiPassword}
                    onChange={(e) => setAiPassword(e.target.value)}
                    disabled={aiStatus === "running"}
                    placeholder="Kata sandi"
                    className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 w-28 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={aiStatus === "running"}
                    className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <optgroup label="Gemini (Google)">
                      {AI_MODELS.filter((m) => m.provider === "gemini").map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} — {m.note}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Claude (Anthropic)">
                      {AI_MODELS.filter((m) => m.provider === "claude").map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} — {m.note}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    onClick={runAiCompare}
                    disabled={aiStatus === "running"}
                    className={`btn-sm whitespace-nowrap ${
                      aiStatus === "running"
                        ? "bg-slate-200 text-slate-500 cursor-wait"
                        : "bg-slate-900 text-white hover:bg-slate-700"
                    }`}
                  >
                    {aiStatus === "running"
                      ? "Memeriksa…"
                      : aiStatus === "done"
                        ? "Periksa ulang"
                        : "Jalankan"}
                  </button>
                </div>
              </div>

              {aiStatus === "error" && (
                <div className="mt-3 text-xs bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700">
                  <div className="font-semibold">Gagal</div>
                  <div>{aiError}</div>
                  {aiError?.includes("API_KEY") && (
                    <div className="mt-1 text-rose-500">
                      Tambahkan{" "}
                      <span className="num">
                        {aiError.includes("ANTHROPIC") ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"}
                      </span>{" "}
                      pada konfigurasi server.
                    </div>
                  )}
                </div>
              )}

              {comparison && aiStatus === "done" && (
                <div className="mt-3 text-[11px] text-slate-500">
                  Diperiksa dengan{" "}
                  <span className="font-semibold text-slate-700">{aiModel}</span>
                </div>
              )}

              {comparison && aiStatus === "done" && (
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <CompareStat
                    label="Regex saja"
                    sub="Gemini gak nemu"
                    value={comparison.regexOnly.length}
                    color="text-slate-700"
                  />
                  <CompareStat
                    label="Keduanya"
                    sub="Terdeteksi sama"
                    value={comparison.both.length}
                    color="text-emerald-600"
                  />
                  <CompareStat
                    label="Hanya AI"
                    sub="Lolos dari pola"
                    value={comparison.geminiOnly.length}
                    color="text-blue-700"
                  />
                </div>
              )}

              {comparison && comparison.geminiOnly.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Temuan tambahan dari AI — perlu ditinjau
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
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {k === "all"
                    ? `Semua (${detected.length})`
                    : k === "percentage"
                      ? `Persentase (${detected.filter((d) => d.kind === "percentage").length})`
                      : k === "sum"
                        ? `Penjumlahan (${detected.filter((d) => d.kind === "sum").length})`
                        : `Total Tabel (${detected.filter((d) => d.kind === "table-vertical").length})`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Tidak ada perhitungan pada kategori ini.
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
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`num text-xl font-bold ${color ?? "text-slate-900"}`}>
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
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
      <div className={`num text-2xl font-bold ${color ?? "text-slate-900"}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-slate-700">{label}</div>
      <div className="text-[9px] text-slate-400">{sub}</div>
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
    sum: "Penjumlahan",
    "table-vertical": "Total Tabel",
    subtraction: "Selisih",
    multiplication: "Perkalian",
  };
  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        aiTag ? "border-slate-300" : cocok ? "border-slate-200" : "border-rose-200"
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          {aiTag && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mr-2">
              AI
            </span>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mr-2">
            {kindLabel[detected.kind]}
          </span>
          <span className="text-[10px] text-slate-400">{detected.location}</span>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
            cocok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {cocok ? "Cocok" : "Selisih"}
        </span>
      </div>
      <div className="text-xs text-slate-600 mb-3 line-clamp-2">{detected.snippet}</div>
      <div className="num text-xs grid grid-cols-3 gap-2 text-slate-700">
        <div>
          <div className="text-[10px] text-slate-400 font-sans">Dihitung</div>
          <div>{fmtNumber(computed)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-sans">Tertulis</div>
          <div>{fmtNumber(detected.expected)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400 font-sans">Selisih</div>
          <div
            className={
              cocok ? "text-emerald-600" : "text-rose-600 font-semibold"
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
