"use client"

import { createContext, useContext, useEffect, useState } from "react"
import api from "../lib/api"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const savedUser = localStorage.getItem("user")

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }

    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password })
      const { token, user: loggedInUser } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(loggedInUser))
      localStorage.setItem("loginType", "local")
      setUser(loggedInUser)

      return loggedInUser
    } catch (error) {
      const message = error.response?.data?.error || "Đăng nhập thất bại"
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
