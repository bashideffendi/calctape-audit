/**
 * Wrapper untuk mammoth.js: extract paragraf + tabel dari .docx.
 *
 * mammoth.convertToHtml() menghasilkan HTML yang bisa kita parse pake DOMParser.
 * Strategy: render ke HTML lalu walk DOM untuk pisahin paragraf vs tabel
 * dalam urutan dokumen.
 */

import mammoth from "mammoth";
import type { ExtractedDoc, ExtractedTable } from "./types";

/** Convert ArrayBuffer ke ExtractedDoc dengan ordering paragraf + tabel. */
export async function extractDocx(buffer: ArrayBuffer): Promise<ExtractedDoc> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = result.value;

  // Browser: pakai DOMParser
  // Server: butuh polyfill — pakai linkedom atau jsdom
  // Untuk sekarang assume browser context (client-side parsing).
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.querySelector("div");
  if (!root) return { paragraphs: [], tables: [] };

  const paragraphs: ExtractedDoc["paragraphs"] = [];
  const tables: ExtractedTable[] = [];

  let pIndex = 0;
  let tIndex = 0;

  // Walk children langsung — mammoth biasanya kasih <p>, <table>, <h1>-<h6>
  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    if (tag === "table") {
      const rows: string[][] = [];
      const trList = node.querySelectorAll("tr");
      trList.forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("td, th").forEach((td) => {
          cells.push((td.textContent || "").trim());
        });
        rows.push(cells);
      });
      // Try to grab caption dari paragraf sebelumnya
      const lastP = paragraphs[paragraphs.length - 1];
      tables.push({
        index: tIndex,
        rows,
        caption: lastP?.text,
      });
      tIndex++;
    } else if (tag === "p" || tag.startsWith("h")) {
      const text = (node.textContent || "").trim();
      if (text) {
        paragraphs.push({ index: pIndex, text });
        pIndex++;
      }
    }
  }

  return { paragraphs, tables };
}

/** Parse Word .docx di server (Node.js) tanpa DOMParser. */
export async function extractDocxServer(buffer: Buffer): Promise<ExtractedDoc> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  // Simple HTML walker tanpa external DOMParser (pakai regex matching).
  // Cuma sederhana — buat MVP.
  const paragraphs: ExtractedDoc["paragraphs"] = [];
  const tables: ExtractedTable[] = [];

  // Pisahin blok-blok berdasarkan tag block-level
  // Pakai regex split di <p>, </p>, <table>, </table>
  const blockRe = /<(p|h[1-6]|table)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let pIdx = 0;
  let tIdx = 0;

  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];

    if (tag === "table") {
      const rows: string[][] = [];
      const rowRe = /<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi;
      let rm: RegExpExecArray | null;
      while ((rm = rowRe.exec(inner)) !== null) {
        const cells: string[] = [];
        const cellRe = /<(td|th)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
        let cm: RegExpExecArray | null;
        while ((cm = cellRe.exec(rm[1])) !== null) {
          cells.push(stripTags(cm[2]).trim());
        }
        rows.push(cells);
      }
      const lastP = paragraphs[paragraphs.length - 1];
      tables.push({ index: tIdx, rows, caption: lastP?.text });
      tIdx++;
    } else {
      const text = stripTags(inner).trim();
      if (text) {
        paragraphs.push({ index: pIdx, text });
        pIdx++;
      }
    }
  }

  return { paragraphs, tables };
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
