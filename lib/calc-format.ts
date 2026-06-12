/**
 * Generator format .calc (SFR CalcTape).
 * Port dari script Python _gen_calctape.py.
 *
 * Format reference:
 *   - Header XML-like: <SFRCalculatorHeader>...config...</SFRCalculatorHeader>
 *   - Body baris perhitungan: " <op><pad><number> " atau " <op><pad><number> OK"
 *   - Separator: " --------------- " (15 dashes)
 *   - Text heading: plain line tanpa prefix space
 *   - Blank line = pemisah perhitungan
 */

import type { CalcDocument, CalcGroup, CalcSection, Op } from "./types";

const PAD = 15;
const SEP = " --------------- ";

/** Format angka Indonesian: thousand '.' dan desimal ','. */
export function fmtNumber(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  // en-US output: "1,234,567.89" → convert ke "1.234.567,89"
  return s.replace(/,/g, "X").replace(/\./g, ",").replace(/X/g, ".");
}

/** Build satu baris operand: " +<padding>123,45 " atau dengan OK. */
function buildLine(op: Op, n: number, decimals = 2, ok = false): string {
  const numStr = fmtNumber(n, decimals);
  let body = op + numStr;
  if (body.length < PAD) {
    body = op + " ".repeat(PAD - body.length) + numStr;
  }
  return ok ? ` ${body} OK` : ` ${body} `;
}

/** Build baris hasil negatif (operator "-" + nilai). */
function buildNegResult(n: number, decimals = 2, ok = false): string {
  const numStr = fmtNumber(n, decimals);
  let body = "-" + numStr;
  if (body.length < PAD) {
    body = "-" + " ".repeat(PAD - body.length) + numStr;
  }
  return ok ? ` ${body} OK` : ` ${body} `;
}

/** Compute hasil group (pakai operator semantic). */
function computeGroup(group: CalcGroup): number {
  if (group.entries.length === 0) return 0;
  // Initial: first entry harus + atau -
  const first = group.entries[0];
  let acc = first.op === "-" ? -first.value : first.value;
  for (let i = 1; i < group.entries.length; i++) {
    const e = group.entries[i];
    switch (e.op) {
      case "+":
        acc += e.value;
        break;
      case "-":
        acc -= e.value;
        break;
      case "*":
        acc *= e.value;
        break;
      case "/":
        if (e.value === 0) return NaN;
        acc /= e.value;
        break;
    }
  }
  return acc;
}

/** Render satu group ke array of lines. */
function renderGroup(group: CalcGroup): string[] {
  const lines: string[] = [];
  if (group.label) lines.push(group.label);
  if (group.location) lines.push(`(${group.location})`);

  const resultDecimals = group.resultDecimals ?? 2;

  for (const e of group.entries) {
    lines.push(buildLine(e.op, e.value, e.decimals ?? 2));
  }
  lines.push(SEP);

  const actual = computeGroup(group);
  const display = group.expected ?? actual;
  const ok = group.expected !== undefined && Math.abs(actual - group.expected) < 0.01;

  if (display < 0) {
    lines.push(buildNegResult(display, resultDecimals, ok));
  } else {
    lines.push(buildLine("+", display, resultDecimals, ok));
  }
  return lines;
}

/** Render entire CalcDocument ke string siap di-save ke .calc. */
export function renderCalcDocument(doc: CalcDocument): string {
  const lines: string[] = [];

  // Header
  const uid = generateUuid();
  lines.push("<SFRCalculatorHeader>");
  lines.push("CARETLINE=1");
  lines.push("CARETLINEOFFSET=0");
  lines.push("CFGVER=1");
  lines.push("DECIMALS=2");
  lines.push("DECSEP=,");
  lines.push("EXTSYN=0");
  lines.push("THOUSEP=.");
  lines.push("TXTMODE=0");
  lines.push("TXTSTYLE=0");
  lines.push(`UUID=${uid}`);
  lines.push("VARINFO=");
  lines.push("</SFRCalculatorHeader>");

  // Body — title + subtitle
  lines.push("");
  lines.push(doc.title);
  if (doc.subtitleLines) {
    for (const s of doc.subtitleLines) lines.push(s);
  }
  lines.push("");

  // Sections
  for (const section of doc.sections) {
    lines.push(section.title);
    if (section.subtitle) lines.push(section.subtitle);
    lines.push("");

    for (const group of section.groups) {
      lines.push(...renderGroup(group));
      lines.push(""); // blank line between groups
    }
    lines.push(""); // extra blank between sections
  }

  return lines.join("\n");
}

/** UUID v4 generator (browser + node compat). */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").toUpperCase();
  }
  // Fallback simple random
  const hex = "0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < 32; i++) {
    s += hex[Math.floor(Math.random() * 16)];
  }
  return s;
}

/** Helpers buat construct CalcGroup tipikal. */

export function makePctGroup(opts: {
  label: string;
  numerator: number;
  denominator: number;
  expected: number;
  location?: string;
}): CalcGroup {
  return {
    label: opts.label,
    location: opts.location,
    entries: [
      { op: "+", value: opts.numerator },
      { op: "/", value: opts.denominator },
      { op: "*", value: 100 },
    ],
    expected: opts.expected,
  };
}

export function makeSubGroup(opts: {
  label: string;
  a: number;
  b: number;
  expected: number;
  location?: string;
}): CalcGroup {
  const opA: Op = opts.a >= 0 ? "+" : "-";
  const opB: Op = opts.b >= 0 ? "-" : "+";
  return {
    label: opts.label,
    location: opts.location,
    entries: [
      { op: opA, value: Math.abs(opts.a) },
      { op: opB, value: Math.abs(opts.b) },
    ],
    expected: opts.expected,
  };
}

export function makeSumGroup(opts: {
  label: string;
  items: number[];
  expected: number;
  decimals?: number;
  location?: string;
}): CalcGroup {
  return {
    label: opts.label,
    location: opts.location,
    entries: opts.items.map((v) => ({ op: "+" as Op, value: v, decimals: opts.decimals })),
    expected: opts.expected,
    resultDecimals: opts.decimals,
  };
}

export function makeMulGroup(opts: {
  label: string;
  items: number[];
  expected: number;
  location?: string;
}): CalcGroup {
  const entries = opts.items.map((v, i) => ({
    op: (i === 0 ? "+" : "*") as Op,
    value: v,
  }));
  return {
    label: opts.label,
    location: opts.location,
    entries,
    expected: opts.expected,
  };
}
