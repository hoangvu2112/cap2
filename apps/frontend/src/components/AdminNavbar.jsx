"use client"

import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useLayout } from "../context/LayoutContext"
import { LayoutDashboard, Package, Users, Newspaper, BarChart3, Settings, LogOut, Menu, X, ShieldCheck } from "lucide-react"
import { useState } from "react"

export default function AdminNavbar() {
  // Ẩn AdminNavbar khi đang trong MainLayout2
  const { hasLayout } = useLayout()
  if (hasLayout) return null

  const { user, logout } = useAuth()
  console.log("👤 Thông tin user hiện tại:", user)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/admin/products", icon: Package, label: "Sản phẩm" },
    { path: "/admin/users", icon: Users, label: "Người dùng" },
    { path: "/admin/news", icon: Newspaper, label: "Tin tức" },
    { path: "/admin/statistics", icon: BarChart3, label: "Thống kê" },
    { path: "/admin/dealers", icon: ShieldCheck, label: "Đại lý" },
    { path: "/admin/settings", icon: Settings, label: "Cài đặt" },
  ]

  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-bold text-xl">Admin Panel</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 transition-colors ${isActive(item.path) ? "text-green-400" : "text-gray-300 hover:text-white"
                  }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:block text-sm text-gray-300">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 ${isActive(item.path) ? "text-green-400" : "text-gray-300"}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
              <button onClick={handleLogout} className="flex items-center gap-2 text-red-400">
                <LogOut className="w-5 h-5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
