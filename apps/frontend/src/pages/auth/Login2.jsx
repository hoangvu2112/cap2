"use client"

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import AuthLayout from "@/components/AuthLayout"
import { Sprout } from "lucide-react"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client"

export default function Login2() {
  const [email, setEmail] = useState("admin@agriprice.vn")
  const [password, setPassword] = useState("admin123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const googleButtonRef = useRef(null)

  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return

    let cancelled = false

    const handleGoogleCredential = async (response) => {
      if (!response?.credential || cancelled) return

      setError("")
      setGoogleLoading(true)

      try {
        const user = await loginWithGoogle(response.credential)
        navigate(user.role === "admin" ? "/admin" : "/")
      } catch (err) {
        setError(err.response?.data?.error || "Đăng nhập Google thất bại")
      } finally {
        if (!cancelled) {
          setGoogleLoading(false)
        }
      }
    }

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current || cancelled) return

      googleButtonRef.current.innerHTML = ""
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        logo_alignment: "left",
        width: Math.max(260, googleButtonRef.current.offsetWidth || 320),
      })
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)

    if (window.google?.accounts?.id) {
      renderGoogleButton()
    } else if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, { once: true })
    } else {
      const script = document.createElement("script")
      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = renderGoogleButton
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel()
        } catch {
          // ignore Google cleanup errors
        }
      }
    }
  }, [loginWithGoogle, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const user = await login(email, password)
      navigate(user.role === "admin" ? "/admin" : "/")
    } catch (err) {
      setError(err.response?.data?.error || "Đăng nhập thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center gap-2 mb-5 md:hidden">
        <div className="w-9 h-9 bg-[hsl(148,60%,55%)]/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-[hsl(148,60%,55%)]/20">
          <Sprout className="text-[hsl(148,60%,55%)] w-5 h-5" />
        </div>
        <span className="font-bold text-xl text-[hsl(148,60%,55%)]">AgroInsight</span>
      </div>

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

      <div className="mt-4">
        <div className="flex items-center my-4">
          <div className="flex-grow h-px bg-white/15"></div>
          <p className="mx-3 text-white/35 text-xs">hoặc</p>
          <div className="flex-grow h-px bg-white/15"></div>
        </div>

        {!GOOGLE_CLIENT_ID ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Thiếu VITE_GOOGLE_CLIENT_ID trong file môi trường frontend.
          </div>
        ) : (
          <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-3 backdrop-blur-sm">
            <div ref={googleButtonRef} className="flex min-h-11 items-center justify-center" />
            {googleLoading && (
              <p className="mt-2 text-center text-xs text-white/60">Đang xác thực với Google...</p>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
