import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/bpk-logo.png"
              alt="BPK"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
            <div>
              <div className="text-base font-bold gradient-text leading-none">
                CalcTape Audit
              </div>
              <div className="text-[10px] text-gray-400">
                Telstruk perhitungan LHP BPK
              </div>
            </div>
          </div>
          <div className="text-[11px] text-gray-400">by Bashid Effendi</div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3">
              Telstruk LHP dalam Hitungan Detik
            </h1>
            <p className="text-gray-600 text-sm md:text-base max-w-xl mx-auto">
              Upload dokumen LHP atau ketik manual ala kalkulator paper-tape.
              Hasil siap di-load ke CalcTape Schoettler buat jejak audit di
              kertas kerja.
            </p>
          </div>

          {/* Mode picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto Import card */}
            <Link
              href="/auto"
              className="group relative bg-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-6 transition-all hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">📄</div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  NEW
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Auto Import
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                Upload <span className="font-mono">.docx</span> atau{" "}
                <span className="font-mono">.xlsx</span>, auto-detect semua
                perhitungan (persentase, sum, selisih, tabel), preview, lalu
                download <span className="font-mono">.calc</span>.
              </p>
              <div className="text-xs text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                Mulai →
              </div>
            </Link>

            {/* Manual Tape card */}
            <Link
              href="/manual"
              className="group bg-white border-2 border-gray-200 hover:border-gray-500 rounded-2xl p-6 transition-all hover:shadow-lg"
            >
              <div className="text-3xl mb-3">🧾</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Manual Tape
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                Kalkulator paper-tape klasik. Ketik angka, Enter, langsung
                tergulir tape. Multi-kolom, auto-save, export CSV. Cocok buat
                telstruk cepat tanpa file source.
              </p>
              <div className="text-xs text-gray-600 font-semibold group-hover:translate-x-1 transition-transform">
                Mulai →
              </div>
            </Link>
          </div>

          {/* Privacy note */}
          <div className="mt-8 text-center text-[11px] text-gray-400">
            🔒 Semua processing terjadi di browser kamu. LHP gak dikirim ke
            server kecuali kamu eksplisit aktifkan AI fallback.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center text-[11px] text-gray-400">
          CalcTape Audit · v2 (Next.js)
        </div>
      </footer>
    </div>
  );
}
