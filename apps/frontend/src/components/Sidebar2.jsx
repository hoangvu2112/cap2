"use client"

import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useState, useEffect } from "react"
import api from "@/lib/api"
import {
  Home,
  Heart,
  Bell,
  BarChart3,
  Users,
  Map,
  User,
  LogOut,
  Sprout,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Package,
  Newspaper,
  Settings,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  ShieldCheck,
  Handshake,
  MessageSquare,
} from "lucide-react"

const USER_NAV = [
  { path: "/", icon: Home, label: "Bảng giá" },
  { path: "/my-supply", icon: Sprout, label: "Nguồn hàng" },
  { path: "/negotiation", icon: Handshake, label: "Thương lượng" },
  { path: "/community", icon: Users, label: "Cộng đồng" },
  { path: "/chat", icon: MessageSquare, label: "Trò chuyện" },
  { path: "/news", icon: Newspaper, label: "Tin tức" },
  { path: "/favorites", icon: Heart, label: "Yêu thích" },
  { path: "/alerts", icon: Bell, label: "Cảnh báo" },
  { path: "/map", icon: Map, label: "Bản đồ giá" },
]

const DEALER_NAV = [
  { path: "/", icon: Home, label: "Tổng quan" },
  { path: "/dealer/supplies", icon: Sprout, label: "Nguồn hàng" },
  { path: "/purchase-requests", icon: Package, label: "Yêu cầu mua" },
  { path: "/negotiation", icon: Handshake, label: "Thương lượng" },
  { path: "/community", icon: Users, label: "Cộng đồng" },
  { path: "/chat", icon: MessageSquare, label: "Trò chuyện" },
]

const ADMIN_NAV = [
  { path: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/products", icon: Package, label: "Sản phẩm" },
  { path: "/admin/users", icon: Users, label: "Người dùng" },
  { path: "/admin/news", icon: Newspaper, label: "Tin tức" },
  { path: "/admin/statistics", icon: BarChart3, label: "Thống kê" },
  { path: "/admin/dealers", icon: ShieldCheck, label: "Đại lý" },
  { path: "/admin/settings", icon: Settings, label: "Cài đặt" },
]

export default function Sidebar2() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(false)
  const [watchlist, setWatchlist] = useState([])

  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const favRes = await api.get("/favorites")
        const favIds = favRes.data.slice(0, 3).map((f) => f.productId)
        if (!favIds.length) return

        const prodRes = await api.get("/products/all")
        const items = prodRes.data
          .filter((p) => favIds.includes(p.id))
          .slice(0, 3)

        setWatchlist(items)
      } catch {
        // Optional widget, ignore errors
      }
    }

    loadWatchlist()
  }, [])

  const handleLogout = () => {
    try {
      logout()
      navigate("/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const isActive = (path) => location.pathname === path
  const roleNav = user?.role === "dealer" ? DEALER_NAV : USER_NAV

  return (
    <aside
      className={`
        ${collapsed ? "w-[72px]" : "w-64"}
        h-screen sticky top-0 flex flex-col
        bg-card/70 backdrop-blur-xl app-sidebar-gradient
        border-r border-border/50
        transition-all duration-300 ease-in-out
        shrink-0 z-40
      `}
      style={{
        background:
          "linear-gradient(180deg, hsl(149 58% 95% / 0.96), hsl(143 44% 92% / 0.92) 45%, hsl(44 64% 90% / 0.88))",
      }}
    >
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border/40 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 group min-w-0">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0">
            <Sprout className="text-white w-4.5 h-4.5" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-foreground truncate">
              AgroInsight
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
            Menu chính
          </p>
        )}

        {roleNav.map((item) => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group relative
                ${active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}

        {user?.role === "admin" && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-5 pb-2">
                <Shield className="w-3 h-3 inline mr-1" />
                Quản trị
              </p>
            )}
            {collapsed && <div className="border-t border-border/40 my-2 mx-2" />}

            {ADMIN_NAV.map((item) => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200 relative
                    ${active
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }
                  `}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                  )}
                  <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </>
        )}

        {!collapsed && user?.role !== "dealer" && watchlist.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-5 pb-2">
              <Star className="w-3 h-3 inline mr-1" />
              Theo dõi nhanh
            </p>
            <div className="space-y-1 px-1">
              {watchlist.map((item) => {
                const change = item.currentPrice - (item.previousPrice || item.currentPrice)
                const isUp = change > 0
                const isDown = change < 0

                return (
                  <Link
                    key={item.id}
                    to={`/product/${item.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <span className="text-xs font-medium text-foreground truncate max-w-[130px]">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {item.currentPrice?.toLocaleString("vi-VN")}
                      </span>
                      {isUp && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {isDown && <TrendingDown className="w-3 h-3 text-red-500" />}
                      {!isUp && !isDown && <Minus className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-border/40 p-2 space-y-1 shrink-0">
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Thu gọn</span>
            </>
          )}
        </button>

        {user && (
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors group"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-primary/20 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name || user.email}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {user.role === "admin"
                    ? "Quản trị viên"
                    : user.role === "dealer"
                    ? "Đại lý"
                    : "Nông dân"}
                </p>
              </div>
            )}
          </Link>
        )}

        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm
            text-muted-foreground hover:text-red-500 hover:bg-red-500/5
            transition-colors
            ${collapsed ? "justify-center" : ""}
          `}
          title="Đăng xuất"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  )
}
