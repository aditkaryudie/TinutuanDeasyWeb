import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF4D4] text-yellow-950 overflow-x-hidden selection:bg-deasy-yellow selection:text-white font-sans">
      {/* Dynamic Background Elements - Softened */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-deasy-yellow/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-deasy-orange/5 rounded-full blur-[150px]" />
      </div>

      {/* Modern Header */}
      <header className="fixed top-0 w-full px-6 py-5 lg:px-12 flex justify-between items-center z-50 glass-panel border-b-0 border-yellow-200/60/50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-deasy-yellow to-deasy-orange flex items-center justify-center font-bold text-white text-xl shadow-sm">
            T
          </div>
          <div className="text-xl font-bold tracking-wide text-yellow-950 hidden sm:block">
            TINUTUAN<span className="text-deasy-yellow">DEASY</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/login"
            className="text-sm font-medium text-yellow-900/70 hover:text-deasy-orange transition-colors"
          >
            Staff Portal
          </Link>
          <Link
            href="/menu?table=1"
            className="text-sm font-semibold bg-text-primary text-white hover:bg-gray-800 transition-colors px-6 py-2.5 rounded-full shadow-sm"
          >
            Lihat Menu
          </Link>
        </div>
      </header>

      {/* Main Content Split Layout */}
      <main className="relative pt-28 pb-12 min-h-screen flex flex-col lg:flex-row items-center px-6 lg:px-12 max-w-[1600px] mx-auto z-10">

        {/* Left Column: Text & CTA */}
        <div className="flex-1 w-full flex flex-col justify-center pt-10 lg:pt-0 lg:pr-12 z-20">
          <div className="animate-slide-up flex">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100/50 border border-yellow-200/60/50 text-xs font-semibold tracking-widest text-deasy-orange uppercase mb-8 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-deasy-yellow animate-pulse"></span>
              Authentic Minahasa Cuisine
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-bold mb-6 tracking-tight leading-[1.1] animate-slide-up-delayed text-yellow-950">
            Cita Rasa <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-deasy-orange to-deasy-yellow">
              Khas Manado
            </span>
          </h1>

          <p className="max-w-xl text-lg sm:text-xl text-yellow-900/70 mb-10 font-normal leading-relaxed animate-slide-up-delayed-2">
            Nikmati kehangatan hidangan autentik yang dimasak dengan bumbu pilihan dan resep warisan keluarga yang tak lekang oleh waktu.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-slide-up-delayed-3">
            <Link
              href="/menu?table=1"
              className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-deasy-yellow text-white font-semibold rounded-full overflow-hidden transition-all hover:bg-deasy-orange hover:shadow-md"
            >
              <span className="relative z-10">Pesan Sekarang</span>
              <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Quick Stats or Features */}
          <div className="mt-16 grid grid-cols-3 gap-6 pt-8 border-t border-yellow-200/60 animate-slide-up-delayed-3 opacity-90">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-950 mb-1">100%</div>
              <div className="text-xs text-yellow-700/70 font-medium uppercase tracking-wider">Halal</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-950 mb-1">20+</div>
              <div className="text-xs text-yellow-700/70 font-medium uppercase tracking-wider">Menu Pilihan</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-950 mb-1">1998</div>
              <div className="text-xs text-yellow-700/70 font-medium uppercase tracking-wider">Sejak</div>
            </div>
          </div>
        </div>

        {/* Right Column: Imagery / Visuals */}
        <div className="flex-1 w-full mt-16 lg:mt-0 relative animate-fade-in flex justify-center lg:justify-end z-10">
          <div className="relative w-full max-w-[500px] lg:max-w-[650px] aspect-[4/5] lg:aspect-square rounded-[2.5rem] overflow-hidden shadow-lg border border-gray-100">
            {/* High-quality placeholder image representing food/soup */}
            <img
              src="/img/biasa.jpg"
              alt="Hidangan Tinutuan"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
            />
            {/* Gradient overlay for blending and modern aesthetic */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface-50/80 via-surface-50/20 to-transparent lg:bg-gradient-to-l opacity-90"></div>

            {/* Floating Glass Card (Responsive positioned) */}
            <div className="absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-8 sm:right-8 glass-panel p-5 sm:p-6 rounded-2xl border border-white/40 transform transition-transform hover:-translate-y-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FFFCF5] flex items-center justify-center shadow-sm border border-gray-100">
                  <span className="text-2xl sm:text-3xl">🍲</span>
                </div>
                <div>
                  <h3 className="text-yellow-950 font-semibold text-base sm:text-lg">Tinutuan Spesial</h3>
                  <p className="text-deasy-orange text-sm font-medium mt-0.5">Rekomendasi Chef</p>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative blurred shape behind the image */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-deasy-yellow/10 to-deasy-orange/10 rounded-full blur-[80px] -z-10"></div>
        </div>
      </main>
    </div>
  );
}
