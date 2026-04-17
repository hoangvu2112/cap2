"use client"

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import AuthLayout from "@/components/AuthLayout"
import { Sprout } from "lucide-react"

export default function Register2() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await register(email, password, name)
      navigate("/")
    } catch (err) {
      setError(err.response?.data?.error || "Đăng ký thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* Logo mobile */}
      <div className="flex items-center gap-2 mb-5 md:hidden">
        <div className="w-9 h-9 bg-[hsl(148,60%,55%)]/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-[hsl(148,60%,55%)]/20">
          <Sprout className="text-[hsl(148,60%,55%)] w-5 h-5" />
        </div>
        <span className="font-bold text-xl text-[hsl(148,60%,55%)]">AgroInsight</span>
      </div>

      {/* Heading — chữ xanh */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[hsl(148,60%,55%)] mb-1">Tạo tài khoản mới</h1>
        <p className="text-[hsl(148,50%,55%)]/60 text-sm">Bắt đầu theo dõi giá nông sản ngay hôm nay</p>
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg text-xs backdrop-blur-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-[hsl(148,60%,55%)]/80 mb-1">Họ tên</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-white/20 rounded-xl bg-white/10 backdrop-blur-sm text-white placeholder-white/35 focus:ring-2 focus:ring-[hsl(38,85%,55%)]/50 focus:border-transparent transition-all outline-none"
            placeholder="Nguyễn Văn A"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[hsl(148,60%,55%)]/80 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-white/20 rounded-xl bg-white/10 backdrop-blur-sm text-white placeholder-white/35 focus:ring-2 focus:ring-[hsl(38,85%,55%)]/50 focus:border-transparent transition-all outline-none"
            placeholder="email@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[hsl(148,60%,55%)]/80 mb-1">Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-white/20 rounded-xl bg-white/10 backdrop-blur-sm text-white placeholder-white/35 focus:ring-2 focus:ring-[hsl(38,85%,55%)]/50 focus:border-transparent transition-all outline-none"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        {/* Nút đăng ký — màu vàng mật ong */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[hsl(38,85%,50%)] hover:bg-[hsl(38,85%,55%)] text-white font-medium py-2 px-4 text-sm rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl border border-[hsl(38,85%,60%)]/30"
        >
          {loading ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-[hsl(148,50%,55%)]/50">
        Đã có tài khoản?{" "}
        <Link to="/login" className="text-[hsl(38,85%,65%)] hover:text-[hsl(38,85%,75%)] font-semibold transition-colors">
          Đăng nhập
        </Link>
      </div>
    </AuthLayout>
  )
}
