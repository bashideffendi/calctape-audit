"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Op = "+" | "-" | "*" | "/";
type Row =
  | { type: "entry"; value: number; op: Op; comment?: string }
  | { type: "subtotal" };

interface Column {
  id: string;
  name: string;
  rows: Row[];
}

interface Session {
  id: string;
  name: string;
  columns: Column[];
}

interface SavedSession extends Session {
  savedAt: string;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function createColumn(name = "Kolom"): Column {
  return { id: makeId(), name, rows: [] };
}

function newSessionObj(name?: string): Session {
  return {
    id: makeId(),
    name: name ?? "Perhitungan 1",
    columns: [createColumn("Kolom 1")],
  };
}

function applyOp(total: number, op: Op, value: number): number {
  switch (op) {
    case "+":
      return total + value;
    case "-":
      return total - value;
    case "*":
      return total * value;
    case "/":
      return value !== 0 ? total / value : total;
  }
}

function calcTotal(rows: Row[]): number {
  let total = 0;
  for (const r of rows) {
    if (r.type === "entry") total = applyOp(total, r.op, r.value);
  }
  return total;
}

function fmtNum(n: number): string {
  if (n === 0) return "0";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("id-ID", {
    minimumFractionDigits: rounded % 1 ? 2 : 0,
  });
}

function fmtRp(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(Math.round(n * 100) / 100);
  const formatted = abs.toLocaleString("id-ID", {
    minimumFractionDigits: abs % 1 ? 2 : 0,
  });
  return n < 0 ? "(" + formatted + ")" : formatted;
}

const STORAGE_KEY = "calctape_session";
const SAVED_KEY = "calctape_saved";

export default function ManualPage() {
  const [session, setSession] = useState<Session>(() => newSessionObj());
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Init load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.columns)) setSession(parsed);
      } catch {
        /* ignore */
      }
    }
    const savedRaw = localStorage.getItem(SAVED_KEY);
    if (savedRaw) {
      try {
        const arr = JSON.parse(savedRaw);
        if (Array.isArray(arr)) setSaved(arr);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Auto-save session on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1500);
  }, []);

  const saveAll = useCallback(() => {
    setSaved((prev) => {
      const data: SavedSession = { ...session, savedAt: new Date().toISOString() };
      const idx = prev.findIndex((s) => s.id === session.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = data;
      else next.unshift(data);
      const trimmed = next.slice(0, 30);
      localStorage.setItem(SAVED_KEY, JSON.stringify(trimmed));
      return trimmed;
    });
    showToast("Tersimpan!");
  }, [session, showToast]);

  const loadSession = useCallback((id: string) => {
    setSaved((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) {
        const { savedAt: _unused, ...rest } = item;
        void _unused;
        setSession(rest as Session);
      }
      return prev;
    });
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSaved((prev) => {
        const next = prev.filter((s) => s.id !== id);
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        return next;
      });
      if (session.id === id) setSession(newSessionObj());
    },
    [session.id],
  );

  const newSession = useCallback(() => {
    setSession(newSessionObj(`Perhitungan ${saved.length + 1}`));
  }, [saved.length]);

  const addColumn = useCallback(() => {
    setSession((s) => ({
      ...s,
      columns: [...s.columns, createColumn(`Kolom ${s.columns.length + 1}`)],
    }));
  }, []);

  const removeColumn = useCallback((ci: number) => {
    setSession((s) => {
      if (s.columns.length <= 1) return s;
      const col = s.columns[ci];
      if (col.rows.length > 0 && !confirm("Hapus kolom ini?")) return s;
      return { ...s, columns: s.columns.filter((_, i) => i !== ci) };
    });
  }, []);

  const renameColumn = useCallback((ci: number, name: string) => {
    setSession((s) => {
      const cols = [...s.columns];
      cols[ci] = { ...cols[ci], name };
      return { ...s, columns: cols };
    });
  }, []);

  const addEntry = useCallback((ci: number, op: Op, value: number) => {
    setSession((s) => {
      const cols = [...s.columns];
      cols[ci] = {
        ...cols[ci],
        rows: [...cols[ci].rows, { type: "entry", value, op, comment: "" }],
      };
      return { ...s, columns: cols };
    });
  }, []);

  const addSubtotal = useCallback((ci: number) => {
    setSession((s) => {
      const cols = [...s.columns];
      cols[ci] = { ...cols[ci], rows: [...cols[ci].rows, { type: "subtotal" }] };
      return { ...s, columns: cols };
    });
  }, []);

  const deleteRow = useCallback((ci: number, ri: number) => {
    setSession((s) => {
      const cols = [...s.columns];
      cols[ci] = {
        ...cols[ci],
        rows: cols[ci].rows.filter((_, i) => i !== ri),
      };
      return { ...s, columns: cols };
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, ci: number) => {
      const input = e.currentTarget;
      if (e.key === "Enter") {
        e.preventDefault();
        let raw = input.value.trim();
        if (!raw) return;
        let op: Op = "+";
        if (raw.startsWith("−") || (raw.startsWith("-") && /^-\d/.test(raw))) {
          op = "-";
          raw = raw.substring(1);
        }
        if (raw.startsWith("*") || raw.startsWith("×")) {
          op = "*";
          raw = raw.substring(1);
        }
        if (raw.startsWith("/") || raw.startsWith("÷")) {
          op = "/";
          raw = raw.substring(1);
        }
        if (e.shiftKey && op === "+") op = "-";
        const val = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
        if (isNaN(val)) return;
        addEntry(ci, op, val);
        input.value = "";
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const nextCi = e.shiftKey ? ci - 1 : ci + 1;
        if (nextCi >= 0 && nextCi < session.columns.length) {
          inputRefs.current[nextCi]?.focus();
        } else if (nextCi >= session.columns.length) {
          addColumn();
          setTimeout(() => {
            inputRefs.current[session.columns.length]?.focus();
          }, 50);
        }
      }
    },
    [addEntry, addColumn, session.columns.length],
  );

  const exportCSV = useCallback(() => {
    let csv = "";
    for (const col of session.columns) {
      csv += `\n=== ${col.name} ===\n`;
      csv += "Op,Nilai,Running Total\n";
      let running = 0;
      for (const r of col.rows) {
        if (r.type === "subtotal") {
          csv += `=,${running},${running}\n`;
        } else {
          running = applyOp(running, r.op, r.value);
          csv += `${r.op},${r.value},${running}\n`;
          if (r.comment) csv += `,"${r.comment}",\n`;
        }
      }
      csv += `TOTAL,,${running}\n`;
    }
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (session.name || "CalcTape").replace(/[^a-zA-Z0-9 ]/g, "_") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported!");
  }, [session, showToast]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveAll]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border)] sticky top-0 z-50 print:hidden backdrop-blur-xl bg-[#0a0e14]/70">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Link
              href="/"
              className="flex items-baseline gap-2 text-[#8b96a5] hover:text-[#e6edf3] transition-colors"
            >
              <span className="text-sm">&larr;</span>
              <span className="wordmark text-sm">
                Calc<span className="mark">Tape</span>
              </span>
            </Link>
            <span className="text-[11px] text-[#5b6675]">Tape Manual</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={addColumn} className="btn-sm btn-ghost">
              + Kolom
            </button>
            <button onClick={exportCSV} className="btn-sm btn-ghost">
              Ekspor
            </button>
            <button onClick={() => window.print()} className="btn-sm btn-ghost">
              Cetak
            </button>
            <button
              onClick={saveAll}
              className="btn-sm btn-primary"
              title="Simpan (Ctrl+S)"
            >
              Simpan
            </button>
          </div>
        </div>
        {/* Saved tapes tabs */}
        <div className="max-w-7xl mx-auto px-3 pb-2">
          <div className="tab-bar">
            <button
              onClick={newSession}
              className="btn-sm btn-ghost mr-1"
              title="Sesi Baru"
            >
              +
            </button>
            <div
              className="tab-item active"
              onDoubleClick={() => {
                const name = prompt("Nama sesi:", session.name);
                if (name) setSession((s) => ({ ...s, name }));
              }}
            >
              {session.name}
            </div>
            {saved
              .filter((s) => s.id !== session.id)
              .map((s) => (
                <div
                  key={s.id}
                  className="tab-item"
                  onClick={() => loadSession(s.id)}
                  title="Klik untuk buka"
                >
                  {s.name}{" "}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="text-gray-400 hover:text-red-500 ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </div>
      </header>

      {/* Tape Columns */}
      <main className="max-w-7xl mx-auto px-3 py-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {session.columns.map((col, ci) => {
            const total = calcTotal(col.rows);
            return (
              <div key={col.id} className="tape-col">
                <div className="tape-header">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => renameColumn(ci, e.target.value)}
                    className="bg-transparent outline-none text-sm font-bold text-white flex-1 min-w-0"
                    placeholder="Nama kolom"
                  />
                  <button
                    onClick={() => removeColumn(ci)}
                    className="text-white/50 hover:text-white text-xs"
                  >
                    ×
                  </button>
                </div>
                <div className="tape-body">
                  {col.rows.length === 0 ? (
                    <div className="text-center py-8 text-[#5b6675] text-xs">
                      Ketik angka lalu Enter
                    </div>
                  ) : (
                    (() => {
                      let running = 0;
                      return col.rows.map((r, ri) => {
                        if (r.type === "subtotal") {
                          return (
                            <div key={ri} className="tape-row subtotal-row">
                              <span className="op">=</span>
                              <span className="val">{fmtNum(running)}</span>
                              <button
                                onClick={() => deleteRow(ci, ri)}
                                className="text-[#3b4350] hover:text-[#fb7185] ml-1 text-xs print:hidden"
                              >
                                ×
                              </button>
                            </div>
                          );
                        }
                        running = applyOp(running, r.op, r.value);
                        const opSymbol: Record<Op, string> = {
                          "+": "+",
                          "-": "−",
                          "*": "×",
                          "/": "÷",
                        };
                        const opColor: Record<Op, string> = {
                          "+": "text-emerald-400",
                          "-": "text-rose-400",
                          "*": "text-[#818cf8]",
                          "/": "text-amber-400",
                        };
                        return (
                          <div key={ri} className="tape-row">
                            <span className={`op ${opColor[r.op]}`}>
                              {opSymbol[r.op]}
                            </span>
                            <span className="val">{fmtNum(r.value)}</span>
                            <button
                              onClick={() => deleteRow(ci, ri)}
                              className="text-[#3b4350] hover:text-[#fb7185] ml-1 text-xs print:hidden"
                            >
                              ×
                            </button>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
                <div className="tape-total">
                  <span className="text-xs text-white/70">TOTAL</span>
                  <span className="text-lg">{fmtRp(total)}</span>
                </div>
                <div className="tape-input-area">
                  <input
                    ref={(el) => {
                      inputRefs.current[ci] = el;
                    }}
                    type="text"
                    className="tape-input"
                    placeholder="0"
                    onKeyDown={(e) => handleKeyDown(e, ci)}
                    autoFocus={ci === 0}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-[#5b6675]">
                      Enter=tambah · -Enter=kurang · *Enter=kali · /Enter=bagi
                    </span>
                    <button
                      onClick={() => addSubtotal(ci)}
                      className="text-[10px] text-[#8b96a5] font-semibold hover:text-[#e6edf3]"
                    >
                      Subtotal
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-[#1a212e] border border-[rgba(129,140,248,0.35)] text-[#e6edf3] text-sm font-semibold px-4 py-2 rounded-xl shadow-[0_8px_30px_-8px_rgba(99,102,241,0.4)] z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
