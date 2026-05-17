"use client"

import { createContext, useContext, useEffect, useState } from "react"
import api from "../lib/api"
import { socket } from "../socket"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const syncSocketAuth = (token) => {
    if (!token) {
      if (socket.connected) {
        socket.disconnect()
      }
      return
    }

    socket.auth = { token }
    if (!socket.connected) {
      socket.connect()
    }
  }

  const forceLogout = (message = "Tài khoản của bạn đã bị thay đổi. Vui lòng đăng nhập lại.") => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("loginType")
    if (socket.connected) {
      socket.disconnect()
    }
    setUser(null)

    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.alert(message)
      window.location.replace("/login")
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token")
    const bootstrap = async () => {
      if (token) {
        syncSocketAuth(token)
        try {
          const response = await api.get("/auth/me")
          const freshUser = response.data
          localStorage.setItem("user", JSON.stringify(freshUser))
          setUser(freshUser)
        } catch (error) {
          console.error("❌ Không thể làm mới phiên đăng nhập:", error)
          forceLogout(error.response?.data?.error || "Phiên đăng nhập không còn hợp lệ.")
        }
      } else {
        if (socket.connected) {
          socket.disconnect()
        }
        setUser(null)
      }

      setLoading(false)
    }

    bootstrap()
  }, [])

  useEffect(() => {
    const handleForceLogout = (payload = {}) => {
      forceLogout(payload.message || "Vai trò của bạn đã thay đổi. Vui lòng đăng nhập lại.")
    }

    socket.on("auth:force_logout", handleForceLogout)

    return () => {
      socket.off("auth:force_logout", handleForceLogout)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token && user) {
      syncSocketAuth(token)
    }
  }, [user])

  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password })
      const { token, user: loggedInUser } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(loggedInUser))
      localStorage.setItem("loginType", "local")
      setUser(loggedInUser)
      syncSocketAuth(token)

      return loggedInUser
    } catch (error) {
      const message = error.response?.data?.error || "Đăng nhập thất bại"
      alert(message)
      throw error
    }
  }

  const register = async (email, password, name, region) => {
    const response = await api.post("/auth/register", { email, password, name, region })
    const { token, user: registeredUser } = response.data

    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(registeredUser))
    localStorage.setItem("loginType", "local")
    setUser(registeredUser)
    syncSocketAuth(token)

    return registeredUser
  }

  const loginWithGoogle = async (credential) => {
    try {
      if (!credential) {
        throw new Error("Không lấy được credential từ Google")
      }

      const response = await api.post("/auth/google-login", { credential })
      const { token, user: googleUser } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(googleUser))
      localStorage.setItem("loginType", "google")
      setUser(googleUser)
      syncSocketAuth(token)

      return googleUser
    } catch (error) {
      console.error("Google login error:", error)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("loginType")
    if (socket.connected) {
      socket.disconnect()
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
