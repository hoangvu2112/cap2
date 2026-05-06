"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Bell } from "lucide-react"
import api from "@/lib/api"
import LivePriceTicker from "./live-price-ticker"

export default function Header2() {
  const { user } = useAuth()
  const [openNotifications, setOpenNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const dropdownRef = useRef(null)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/alerts")
        const notifiedAlerts = (res.data || []).filter((item) => item.notified)
        setNotifications(notifiedAlerts)
      } catch (error) {
        console.error("❌ Lỗi tải thông báo cảnh báo:", error)
        setNotifications([])
      }
    }

    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, 60000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenNotifications(false)
      }
    }

    if (openNotifications) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [openNotifications])

  return (
    <header className="shrink-0 sticky top-0 z-30">
      {/* Gradient bar — lấy cảm hứng từ nhabeagri: gradient xanh lá đậm */}
      <div
        className="h-12 flex items-center justify-end px-6"
        style={{
          background: "linear-gradient(135deg, hsl(148, 48%, 22%) 0%, hsl(148, 45%, 32%) 40%, hsl(38, 60%, 45%) 100%)",
        }}
      >
        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notifications */}
          {user?.role !== "dealer" && (
            <div className="relative" ref={dropdownRef}>
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:bg-white/15 transition-colors relative"
                title="Thông báo cảnh báo giá"
                onClick={() => setOpenNotifications((prev) => !prev)}
              >
                <Bell className="w-[18px] h-[18px]" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-yellow-400 text-black rounded-full border border-white/40 flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>

              {openNotifications && (
                <div className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-xl border border-border bg-background shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Cảnh báo đã kích hoạt</h3>
                    <span className="text-xs text-muted-foreground">{notifications.length} mục</span>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground">
                        Chưa có cảnh báo nào được kích hoạt.
                      </p>
                    ) : (
                      notifications.map((item) => (
                        <div key={item.id} className="px-4 py-3 border-b border-border/70 last:border-b-0">
                          <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Điều kiện: {item.alert_condition === "above" ? "Tăng vượt" : "Giảm dưới"}{" "}
                            {Number(item.target_price || 0).toLocaleString("vi-VN")} đ/kg
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Giá hiện tại: {Number(item.currentPrice || 0).toLocaleString("vi-VN")} đ/kg
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-border">
                    <Link
                      to="/alerts"
                      onClick={() => setOpenNotifications(false)}
                      className="text-sm text-primary hover:underline"
                    >
                      Xem toàn bộ cảnh báo
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User info */}
          {user && (
            <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-white/20">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-sm font-bold border border-white/20">
                  {user.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="hidden md:block">
                <p className="text-sm font-medium text-white leading-tight">
                  {user.name || user.email}
                </p>
                <p className="text-[10px] text-white/60 leading-tight capitalize">
                  {user.role === "admin"
                    ? "Quản trị viên"
                    : user.role === "dealer"
                    ? "Đại lý"
                    : "Nông dân"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tích hợp Live Price Ticker vào Header để hiển thị toàn cục */}
      <LivePriceTicker />
    </header>
  )
}
