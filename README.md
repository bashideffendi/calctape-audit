# CalcTape Audit

> Kalkulator paper-tape buat telstruk perhitungan LHP BPK — manual atau auto-import dari Word/Excel/PDF.

**Status:** 🆕 Active (v2 migration from Flask → Next.js, MVP Phase 1)
**Live:** https://calctape.masbash.id (planned)
**Repo:** https://github.com/bashideffendi/calctape (planned)
**Stack:** Next.js 16, TypeScript, Tailwind v4, mammoth, xlsx, pdfjs-dist

## What

Tool internal Bashid Effendi (auditor BPK RI) buat verifikasi perhitungan di
Laporan Hasil Pemeriksaan (LHP). Replace workflow ngetik manual angka per
angka di CalcTape Schoettler desktop — sekarang upload dokumen → auto-detect
semua perhitungan → download `.calc` siap dibuka di CalcTape Schoettler buat
jejak audit di Kertas Kerja Audit (KKA).

Use-case utama:
- Telstruk persentase realisasi anggaran (mis. "Rp X atau Y% dari Rp Z")
- Telstruk selisih / kenaikan / penurunan
- Telstruk sum kolom tabel (data + baris Jumlah)
- Telstruk sum narasi explicit ("Rp Total (Rp A + Rp B + Rp C)")
- Cross-check antar lampiran

## Features

### Mode: Auto Import 📄

- ✅ Upload `.docx`
- ✅ Auto-detect persentase, sum narasi, sum tabel
- ✅ Preview list perhitungan + cocok/selisih
- ✅ Download `.calc` siap di-load ke CalcTape Schoettler
- 🚧 Excel (`.xlsx`) support (Phase 2)
- 🚧 PDF support (Phase 2)
- 🚧 AI fallback via Gemini (Phase 2, dengan redact PII)
- 🚧 Cross-check antar dokumen KHP ↔ Lampiran (Phase 3)

### Mode: Manual Tape 🧾

- ✅ Multi-kolom paper-tape (port dari Flask v1)
- ✅ Operator inline (`+/-/* //`)
- ✅ Subtotal row
- ✅ Auto-save ke localStorage
- ✅ Export CSV
- ✅ Print friendly

## Local Dev

```bash
cd D:\Claude-Projects\Web-Apps\audit\calctape
npm install
cp .env.example .env.local   # isi GEMINI_API_KEY kalau pakai Phase 2
npm run build                # verifikasi compile (jangan `npm run dev` di laptop 12GB)
```

## Environment Variables

| Var | Required | Default | Keterangan |
|---|---|---|---|
| `GEMINI_API_KEY` | No (Phase 2) | - | Gemini API key buat AI fallback. Dapetin dari aistudio.google.com |

## Deploy

- **Platform**: Vercel (auto-deploy dari push ke `main`)
- **URL**: calctape.masbash.id
- **Habis deploy**: hard-refresh `Ctrl+Shift+R` (Next.js sering serve bundle lama)

## Privacy / Confidentiality

LHP BPK bersifat **confidential**. Tool ini didesain dengan principle privacy-first:

- ✅ **Auto Import** processing 100% client-side (mammoth + regex jalan di browser kamu)
- ✅ Dokumen LHP **gak pernah dikirim ke server CalcTape**
- ✅ AI fallback (Phase 2) akan **redact nama PNS/penyedia/WP** sebelum kirim ke Gemini — cuma angka & struktur yang dikirim

## Architecture

```
app/
├── page.tsx              # Landing (pilih mode)
├── manual/page.tsx       # Manual paper-tape mode
└── auto/page.tsx         # Auto import: upload, parse, preview, download

lib/
├── types.ts              # Shared types
├── calc-format.ts        # Generator format .calc (SFR CalcTape)
├── patterns.ts           # Regex detectors (persentase, sum, delta)
├── docx-extract.ts       # Mammoth.js wrapper
└── detect-pipeline.ts    # End-to-end: ExtractedDoc → DetectedCalc[] → CalcDocument
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Fonts**: Plus Jakarta Sans + JetBrains Mono
- **Parsers**:
  - `mammoth` — Word `.docx` → HTML
  - `xlsx` — Excel `.xlsx` (Phase 2)
  - `pdfjs-dist` — PDF (Phase 2)
- **AI**: `@google/generative-ai` — Gemini 2.5 Flash (Phase 2)

## License

Personal project. © Bashid Effendi 2026.

---

*Versi sebelumnya (Flask + vanilla JS) di-archive di `D:\Claude-Projects\_archive\calctape-flask-20260518\`.*
