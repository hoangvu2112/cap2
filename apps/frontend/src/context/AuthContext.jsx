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

  const forceLogout = (message = "T├ái khoß║ún cß╗ºa bß║ín ─æ├ú bß╗ï thay ─æß╗òi. Vui l├▓ng ─æ─âng nhß║¡p lß║íi.") => {
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
          console.error("Γ¥î Kh├┤ng thß╗â l├ám mß╗¢i phi├¬n ─æ─âng nhß║¡p:", error)
          forceLogout(error.response?.data?.error || "Phi├¬n ─æ─âng nhß║¡p kh├┤ng c├▓n hß╗úp lß╗ç.")
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
      forceLogout(payload.message || "Vai tr├▓ cß╗ºa bß║ín ─æ├ú thay ─æß╗òi. Vui l├▓ng ─æ─âng nhß║¡p lß║íi.")
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
      const message = error.response?.data?.error || "─É─âng nhß║¡p thß║Ñt bß║íi"
      alert(message)
      throw error
    }
  }

  const register = async (email, password, name) => {
    const response = await api.post("/auth/register", { email, password, name })
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
        throw new Error("Kh├┤ng lß║Ñy ─æ╞░ß╗úc credential tß╗½ Google")
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
