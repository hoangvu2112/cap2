"use client"

import { Sprout, Wheat, TrendingUp } from "lucide-react"

export default function AuthLayout({ children }) {
  return (
    // Sử dụng nền tối (dark mode) với gradient xanh rêu sâu thẳm, tạo tương phản cực mạnh cho các phần tử sáng
    <div className="min-h-screen relative overflow-hidden bg-[#0a1410] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-950 via-[#0a1410] to-[#050a08]">
      
      {/* === TRANG TRÍ PHỤ (Optional) — Tạo các đốm sáng mờ ảo để giảm sự đơn điệu === */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px]" />
      <div className="absolute bottom-[-5%] right-[5%] w-[30%] h-[30%] rounded-full bg-teal-600/10 blur-[100px]" />

      {/* === CONTENT === */}
      <div className="relative z-10 h-screen max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-6 lg:gap-10 px-6">

        {/* --- BÊN TRÁI: Branding --- */}
        <div className="hidden md:flex flex-col justify-center select-none pointer-events-none">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 bg-emerald-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-500/30">
              <Sprout className="text-emerald-400 w-6 h-6" />
            </div>
            <span className="font-bold text-2xl text-white tracking-tight">
              AgroInsight
            </span>
          </div>

          {/* Tagline — Chữ trắng và xanh emerald sáng, nổi bật rực rỡ trên nền tối */}
          <h2 className="text-4xl lg:text-5xl font-bold leading-tight mb-5 drop-shadow-lg">
            <span className="text-white">Theo dõi giá</span>
            <br />
            <span className="text-emerald-400" style={{ textShadow: '0 0 20px rgba(52,211,153,0.3)' }}>nông sản</span>
            <br />
            <span className="text-white">thông minh</span>
          </h2>

          <p className="text-emerald-50/70 text-base leading-relaxed max-w-md mb-8 font-light">
            Cập nhật giá thời gian thực, phân tích xu hướng thị trường
            và kết nối cộng đồng nông nghiệp Việt Nam.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-sm backdrop-blur-sm group-hover:bg-white/10 group-hover:border-emerald-500/30 transition-all">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-50/90 tracking-wide">Giá cập nhật realtime từ toàn quốc</span>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shadow-sm backdrop-blur-sm group-hover:bg-white/10 group-hover:border-emerald-500/30 transition-all">
                <Wheat className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-50/90 tracking-wide">Phân tích xu hướng & dự báo thị trường</span>
            </div>
          </div>

          <p className="text-emerald-100/20 text-xs mt-12 font-light tracking-wider">
            © {new Date().getFullYear()} AgroInsight. All rights reserved.
          </p>
        </div>

        {/* --- BÊN PHẢI: Form (Sử dụng Dark Glassmorphism) --- */}
        <div className="flex items-center justify-center h-full py-8">
          <div className="w-full max-w-sm bg-black/40 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] px-7 py-8 border border-white/10 relative overflow-hidden">
            {/* Soft highlight cho viền trên thẻ form */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}