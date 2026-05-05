"use client"

import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function resolveFallback(user) {
  if (!user) return "/login"
  if (user.role === "admin") return "/admin"
  return "/"
}

export default function RoleRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={resolveFallback(user)} replace />
  }

  return children
}
