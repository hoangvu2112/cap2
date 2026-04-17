"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { SignInButton, useUser, useSession, useClerk, UserButton } from "@clerk/clerk-react"
import AuthLayout from "@/components/AuthLayout"
import { Sprout } from "lucide-react"

export default function Login2() {
  const [email, setEmail] = useState("admin@agriprice.vn")
  const [password, setPassword] = useState("admin123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { login, loginWithClerk } = useAuth()
  const navigate = useNavigate()

  const { isSignedIn, user } = useUser()
  const { session } = useSession()
  const { signOut } = useClerk()

  useEffect(() => {
    const syncClerkLogin = async () => {
      if (isSignedIn && session) {
        try {
          const token = await session.getToken()
          await loginWithClerk(token)
          navigate("/")
        } catch (err) {
          console.error("Lỗi đồng bộ Clerk:", err)
        }
      }
    }
    syncClerkLogin()
  }, [isSignedIn, session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const user = await login(email, password)
      if (user.role === "admin") {
        navigate("/admin")
      } else {
        navigate("/")
      }
    } catch (err) {
      setError(err.response?.data?.error || "Đăng nhập thất bại")
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
        <h1 className="text-xl font-bold text-[hsl(148,60%,55%)] mb-1">Đăng nhập</h1>
        <p className="text-[hsl(148,50%,55%)]/60 text-sm">Chào mừng bạn quay lại hệ thống</p>
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg text-xs backdrop-blur-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
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
          />
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[hsl(38,85%,65%)] hover:text-[hsl(38,85%,75%)] text-xs font-medium transition-colors">
            Quên mật khẩu?
          </Link>
        </div>

        {/* Nút đăng nhập — màu vàng mật ong để tương phản với chữ xanh */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[hsl(38,85%,50%)] hover:bg-[hsl(38,85%,55%)] text-white font-medium py-2 px-4 text-sm rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl border border-[hsl(38,85%,60%)]/30"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-[hsl(148,50%,55%)]/50">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="text-[hsl(38,85%,65%)] hover:text-[hsl(38,85%,75%)] font-semibold transition-colors">
          Đăng ký ngay
        </Link>
      </div>

      {/* Đăng nhập Google */}
      <div className="mt-4">
        <div className="flex items-center my-4">
          <div className="flex-grow h-px bg-white/15"></div>
          <p className="mx-3 text-white/35 text-xs">hoặc</p>
          <div className="flex-grow h-px bg-white/15"></div>
        </div>

        <SignInButton mode="modal">
          <button className="flex items-center justify-center gap-2 w-full border border-white/15 rounded-xl py-2 px-4 hover:bg-white/15 transition-all duration-200 bg-white/8 backdrop-blur-sm text-sm">
            <img src="https://img.clerk.com/static/google.svg" alt="Google" className="w-4 h-4" />
            <span className="text-white font-medium">Đăng nhập với Google</span>
          </button>
        </SignInButton>
      </div>

      {isSignedIn && (
        <div className="mt-4 text-center">
          <UserButton />
          <button
            onClick={() => signOut()}
            className="mt-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium py-1.5 px-4 rounded-xl transition-colors"
          >
            Đăng xuất Clerk
          </button>
        </div>
      )}
    </AuthLayout>
  )
}
