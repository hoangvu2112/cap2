"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../../components/Navbar"
import Footer from "@/components/Footer"
import { Bell, Search, X, Trash2, TrendingUp, TrendingDown, Minus, Wallet, Pin, ShieldCheck, Handshake } from "lucide-react"
import api from "@/lib/api"

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingAlertId, setDeletingAlertId] = useState(null)
  const [message, setMessage] = useState("")
  const navigate = useNavigate()

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await api.get("/alerts")
      setAlerts(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error("❌ Lỗi khi lấy danh sách cảnh báo:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAlert = async (alertId) => {
    if (!confirm("Bạn có chắc muốn xoá cảnh báo này?")) return
    try {
      setDeletingAlertId(alertId)
      await api.delete(`/alerts/${alertId}`)
      setMessage("🗑️ Đã xoá cảnh báo thành công!")
      setAlerts((prev) => prev.filter((a) => !(a.alert_type === "price_alert" && a.id === alertId)))
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error(err)
      setMessage(err.response?.data?.error || "❌ Lỗi khi xoá cảnh báo.")
    } finally {
      setDeletingAlertId(null)
    }
  }

  const formatPrice = (value) => {
    if (value == null) return ""
    return Number(value).toLocaleString("vi-VN") + " đ/kg"
  }

  const formatVND = (value) => {
    if (value == null) return ""
    return Number(value).toLocaleString("vi-VN") + " ₫"
  }

  // Lọc
  const filtered = alerts.filter(item => {
    const matchSearch = !searchQuery ||
      (item.product_name || item.title || item.note || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchType = selectedType === "all" || item.alert_type === selectedType
    return matchSearch && matchType
  })

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedType("all")
  }

  const hasActiveFilters = searchQuery || selectedType !== "all"

  const getPriceChange = (current, previous) => {
    const cur = Number(current) || 0
    const prev = Number(previous) || 0
    if (!prev || !cur) return { diff: 0, percent: 0, direction: "stable" }
    const diff = cur - prev
    const percent = ((diff / prev) * 100).toFixed(1)
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "stable"
    return { diff, percent: Number(percent), direction }
  }

  const getAlertIcon = (item) => {
    if (item.alert_type === "wallet_transaction") {
      if (item.purpose?.includes("boost") || item.purpose?.includes("PIN")) return <Pin className="w-5 h-5 text-purple-600" />
      if (item.purpose?.includes("upgrade") || item.purpose?.includes("UPGRADE")) return <ShieldCheck className="w-5 h-5 text-indigo-600" />
      return <Wallet className="w-5 h-5 text-blue-600" />
    }
    if (item.alert_type === "negotiation") return <Handshake className="w-5 h-5 text-orange-600" />
    return <Bell className={`w-5 h-5 ${item.notified ? "text-green-600 fill-green-600" : "text-amber-600 fill-amber-600"}`} />
  }

  const getAlertBg = (item) => {
    if (item.alert_type === "wallet_transaction") {
      if (item.purpose?.includes("boost") || item.purpose?.includes("PIN")) return "bg-purple-50"
      if (item.purpose?.includes("upgrade") || item.purpose?.includes("UPGRADE")) return "bg-indigo-50"
      return "bg-blue-50"
    }
    if (item.alert_type === "negotiation") return "bg-orange-50"
    return item.notified ? "bg-green-100" : "bg-amber-100"
  }

  const getAlertBorder = (item) => {
    if (item.alert_type === "wallet_transaction") return "border-blue-200 bg-blue-50/20"
    if (item.alert_type === "negotiation") return "border-orange-200 bg-orange-50/20"
    return item.notified ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/20"
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-8 h-8 text-amber-500 fill-amber-500" />
            Thông báo & Cảnh báo
          </h1>
          <p className="text-muted-foreground mt-1">Cảnh báo giá, giao dịch ví và yêu cầu thương lượng.</p>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium">{message}</div>
        )}

        {/* Bộ lọc */}
        {!loading && alerts.length > 0 && (
          <div className="mb-6 bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa lọc
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
              >
                <option value="all">Tất cả loại</option>
                <option value="price_alert">Cảnh báo giá</option>
                <option value="wallet_transaction">Giao dịch ví</option>
                <option value="negotiation">Thương lượng</option>
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            <p className="text-muted-foreground mt-4">Đang tải...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
            <Bell className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Chưa có thông báo nào.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Không tìm thấy thông báo phù hợp.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, idx) => {
              const uniqueKey = `${item.alert_type}-${item.id}-${idx}`

              // === CẢNH BÁO GIÁ ===
              if (item.alert_type === "price_alert") {
                const { direction, percent } = getPriceChange(item.currentPrice, item.previousPrice)
                return (
                  <div key={uniqueKey} className={`bg-card border rounded-2xl p-5 hover:shadow-md transition-all group ${getAlertBorder(item)}`}>
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getAlertBg(item)}`}>
                        {getAlertIcon(item)}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/product/${item.product_id}`)}>
                        <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {item.product_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {item.alert_condition === "above" ? "🔼 Tăng vượt" : "🔽 Giảm dưới"}{" "}
                          <span className="font-semibold">{formatPrice(item.target_price)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Giá hiện tại</p>
                        <p className="text-lg font-bold text-foreground">{formatPrice(item.currentPrice)}</p>
                      </div>
                      <div className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                        direction === "up" ? "bg-green-50 text-green-700" :
                        direction === "down" ? "bg-red-50 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {direction === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                        {direction === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                        {direction === "stable" && <Minus className="w-3.5 h-3.5" />}
                        <span>{direction === "stable" ? "0%" : `${percent > 0 ? "+" : ""}${percent}%`}</span>
                      </div>
                      <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                        item.notified ? "bg-green-600 text-white" : "bg-amber-500 text-white"
                      }`}>
                        {item.notified ? "Đã kích hoạt" : "Đang chờ"}
                      </span>
                      <button
                        onClick={() => handleDeleteAlert(item.id)}
                        disabled={deletingAlertId === item.id}
                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Xoá cảnh báo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>
                )
              }

              // === GIAO DỊCH VÍ ===
              if (item.alert_type === "wallet_transaction") {
                return (
                  <div key={uniqueKey} className={`bg-card border rounded-2xl p-5 hover:shadow-md transition-all ${getAlertBorder(item)}`}>
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getAlertBg(item)}`}>
                        {getAlertIcon(item)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground">{item.title}</h3>
                        {item.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${item.type === "deduct" ? "text-red-600" : "text-green-600"}`}>
                          {item.type === "deduct" ? "-" : "+"}{formatVND(item.amount)}
                        </p>
                      </div>
                      <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                        item.type === "deduct" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>
                        {item.type === "deduct" ? "Chi" : "Thu"}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>
                )
              }

              // === THƯƠNG LƯỢNG ===
              if (item.alert_type === "negotiation") {
                return (
                  <div key={uniqueKey} className={`bg-card border rounded-2xl p-5 hover:shadow-md transition-all ${getAlertBorder(item)}`}>
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getAlertBg(item)}`}>
                        {getAlertIcon(item)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground">
                          Yêu cầu mua: {item.product_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Từ <span className="font-semibold">{item.sender_name}</span> · {Number(item.quantity).toLocaleString("vi-VN")} kg · {formatVND(item.proposed_price)}/kg
                        </p>
                      </div>
                      <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                        Chờ phản hồi
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </p>
                      <button
                        onClick={() => navigate("/negotiation")}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Xem chi tiết →
                      </button>
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
