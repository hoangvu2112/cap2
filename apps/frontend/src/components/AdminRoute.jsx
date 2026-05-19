"use client"

import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }
// Nếu chưa đăng nhập, chuyển hướng đến trang login
  if (!user) {
    return <Navigate to="/login" replace />
  }
// Chỉ cho phép người dùng có role "admin" truy cập vào các route này
  if (user.role !== "admin") {
    return <Navigate to="/" replace />
  }

  return children
}
