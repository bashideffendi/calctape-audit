import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] sticky top-0 z-50 backdrop-blur-xl bg-[#0a0e14]/70">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="wordmark text-[17px]">
              Calc<span className="mark">Tape</span>
            </span>
            <span className="text-[11px] text-[#5b6675] font-medium">
              Telstruk LHP
            </span>
          </div>
          <span className="text-[11px] text-[#5b6675]">
            Alat bantu auditor · independen
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="hero-mesh relative">
          <div className="grid-tex absolute inset-0 pointer-events-none" />
          <div className="relative max-w-3xl mx-auto px-5 pt-24 pb-16 text-center">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-[#a5b4fc] glass rounded-full px-3 py-1 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8]" />
              Telstruk dokumen pemeriksaan
            </span>
            <h1 className="text-4xl md:text-[54px] leading-[1.05] font-extrabold tracking-tight mb-5 text-[#f3f6fb]">
              Telstruk Perhitungan LHP
              <br className="hidden md:block" />{" "}
              <span className="bg-gradient-to-r from-[#a5b4fc] via-[#818cf8] to-[#6366f1] bg-clip-text text-transparent">
                Secara Otomatis
              </span>
            </h1>
            <p className="text-[#8b96a5] text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Telstruk setiap perhitungan dalam Laporan Hasil Pemeriksaan — baik
              narasi maupun tabel — lalu hasilkan berkas{" "}
              <span className="num text-[#c7d0dc]">.calc</span> yang siap menjadi
              kertas kerja.
            </p>
          </div>
        </section>

        {/* Mode picker */}
        <section className="max-w-4xl mx-auto px-5 pb-20 -mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto Import */}
            <Link
              href="/auto"
              className="group glass glass-hover rounded-2xl p-6 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white shadow-[0_8px_24px_-10px_var(--accent-glow)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </span>
                <span className="text-[10px] font-semibold tracking-wide uppercase text-[#a5b4fc] glass px-2 py-0.5 rounded-md">
                  Disarankan
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#f3f6fb] mb-1.5">
                Impor Otomatis
              </h2>
              <p className="text-sm text-[#8b96a5] leading-relaxed mb-5">
                Unggah dokumen LHP <span className="num text-[#c7d0dc]">.docx</span>.
                Sistem mendeteksi tiap perhitungan — persentase, penjumlahan,
                selisih, dan total tabel — memverifikasinya, lalu menyusun berkas{" "}
                <span className="num text-[#c7d0dc]">.calc</span>.
              </p>
              <span className="text-sm font-semibold text-[#a5b4fc] inline-flex items-center gap-1">
                Mulai
                <span className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </span>
            </Link>

            {/* Manual Tape */}
            <Link
              href="/manual"
              className="group glass glass-hover rounded-2xl p-6"
            >
              <div className="flex items-center mb-5">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-[var(--border)] text-[#a5b4fc]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
                  </svg>
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#f3f6fb] mb-1.5">
                Tape Manual
              </h2>
              <p className="text-sm text-[#8b96a5] leading-relaxed mb-5">
                Kalkulator pita klasik. Masukkan angka, tekan Enter, hasil
                tergulir sebagai pita. Multi-kolom dengan ekspor CSV — untuk
                telstruk cepat tanpa dokumen sumber.
              </p>
              <span className="text-sm font-semibold text-[#a5b4fc] inline-flex items-center gap-1">
                Mulai
                <span className="transition-transform group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </span>
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-4 flex items-start gap-3 glass rounded-xl px-4 py-3.5">
            <svg className="w-4 h-4 mt-0.5 text-[#5b6675] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-xs text-[#8b96a5] leading-relaxed">
              Pemrosesan dokumen berlangsung sepenuhnya di peramban. Berkas LHP
              tidak dikirim ke server, kecuali pemeriksaan AI diaktifkan secara
              eksplisit — dan identitas pada dokumen diredaksi terlebih dahulu.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between text-[11px] text-[#5b6675]">
          <span>
            Calc<span className="font-semibold text-[#8b96a5]">Tape</span> ·
            alat bantu telstruk untuk auditor
          </span>
          <span>Bashid Effendi</span>
        </div>
      </footer>
    </div>
  );
}
