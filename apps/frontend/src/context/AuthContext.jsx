"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useAuth as useClerkAuth } from "@clerk/clerk-react"
import api from "../lib/api" // axios instance

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { getToken } = useClerkAuth()

  // 🧩 Load user từ localStorage khi mở trang
  useEffect(() => {
    const token = localStorage.getItem("token")
    const savedUser = localStorage.getItem("user")

    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  // 🧩 Đăng nhập thủ công
  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("loginType", "local");
      setUser(user);

      return user;
    } catch (error) {
      const message = error.response?.data?.error || "Đăng nhập thất bại";
      alert(message); // hoặc dùng toast
      throw error;
    }
  };

  // 🧩 Đăng ký thủ công
  const register = async (email, password, name) => {
    const response = await api.post("/auth/register", { email, password, name })
    const { token, user } = response.data

    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    setUser(user)

    return user
  }

  // 🧩 Đăng nhập bằng Clerk (Google, Facebook, Email Clerk, v.v.)
  // Dùng JWT phiên Clerk mặc định (backend verifyToken). Chỉ dùng template: "..." nếu đã tạo cùng tên trong Clerk Dashboard.
  const loginWithClerk = async (sessionToken) => {
    try {
      const clerkToken =
        sessionToken ?? (await getToken())

      if (!clerkToken) throw new Error("Không lấy được token từ Clerk")

      const response = await api.post(
        "/auth/clerk-login",
        {},
        {
          headers: {
            Authorization: `Bearer ${clerkToken}`,
          },
        }
      )

      const { token, user } = response.data
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
      localStorage.setItem("loginType", "local");
      setUser(user)

      return user
    } catch (error) {
      console.error("❌ Lỗi loginWithClerk:", error)
      throw error
    }
  }

  // 🧩 Đăng xuất
  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("loginType");
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
        loginWithClerk,
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
