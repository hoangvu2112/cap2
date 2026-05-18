"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../../components/Navbar"
import Footer from "@/components/Footer"
import { Bell, Search, X, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import api from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingAlertId, setDeletingAlertId] = useState(null)
  const [message, setMessage] = useState("")
  const navigate = useNavigate()

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCondition, setSelectedCondition] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await api.get("/alerts")
      setAlerts(res.data)
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
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
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

  // Lọc
  const filtered = alerts.filter(item => {
    const matchSearch = !searchQuery ||
      item.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCondition = selectedCondition === "all" || item.alert_condition === selectedCondition
    const matchStatus = selectedStatus === "all" ||
      (selectedStatus === "notified" && item.notified) ||
      (selectedStatus === "pending" && !item.notified)
    return matchSearch && matchCondition && matchStatus
  })

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCondition("all")
    setSelectedStatus("all")
  }

  const hasActiveFilters = searchQuery || selectedCondition !== "all" || selectedStatus !== "all"

  const getPriceChange = (current, previous) => {
    const cur = Number(current) || 0
    const prev = Number(previous) || 0
    if (!prev || !cur) return { diff: 0, percent: 0, direction: "stable" }
    const diff = cur - prev
    const percent = ((diff / prev) * 100).toFixed(1)
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "stable"
    return { diff, percent: Number(percent), direction }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-8 h-8 text-amber-500 fill-amber-500" />
            Cảnh báo giá nông sản
          </h1>
          <p className="text-muted-foreground mt-1">Quản lý các cảnh báo giá bạn đã thiết lập.</p>
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
                  placeholder="Tìm kiếm theo tên sản phẩm..."
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
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
              >
                <option value="all">Tất cả điều kiện</option>
                <option value="above">Tăng vượt</option>
                <option value="below">Giảm dưới</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="notified">Đã kích hoạt</option>
                <option value="pending">Đang chờ</option>
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
            <p className="text-muted-foreground font-medium">Bạn chưa tạo cảnh báo nào.</p>
            <p className="text-sm text-muted-foreground mt-1">Hãy tạo cảnh báo từ trang chi tiết sản phẩm.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Không tìm thấy cảnh báo phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(item => {
              const { direction, percent } = getPriceChange(item.currentPrice, item.previousPrice)

              return (
                <div
                  key={item.id}
                  className={`bg-card border rounded-2xl p-5 hover:shadow-md transition-all group ${
                    item.notified
                      ? "border-green-200 bg-green-50/30"
                      : "border-amber-200 bg-amber-50/20"
                  }`}
                >
                  {/* Row chính */}
                  <div className="flex items-center gap-4">
                    {/* Icon chuông */}
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      item.notified ? "bg-green-100" : "bg-amber-100"
                    }`}>
                      <Bell className={`w-5 h-5 ${
                        item.notified ? "text-green-600 fill-green-600" : "text-amber-600 fill-amber-600"
                      }`} />
                    </div>

                    {/* Tên sản phẩm + điều kiện */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/product/${item.product_id}`)}
                    >
                      <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.product_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {item.alert_condition === "above" ? "🔼 Tăng vượt" : "🔽 Giảm dưới"}{" "}
                        <span className="font-semibold">{formatPrice(item.target_price)}</span>
                      </p>
                    </div>

                    {/* Giá hiện tại */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Giá hiện tại</p>
                      <p className="text-lg font-bold text-foreground">
                        {formatPrice(item.currentPrice)}
                      </p>
                    </div>

                    {/* Badge thay đổi giá */}
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

                    {/* Trạng thái */}
                    <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                      item.notified
                        ? "bg-green-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}>
                      {item.notified ? "Đã kích hoạt" : "Đang chờ"}
                    </span>

                    {/* Nút xoá */}
                    <button
                      onClick={() => handleDeleteAlert(item.id)}
                      disabled={deletingAlertId === item.id}
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Xoá cảnh báo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Thông tin phụ */}
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Tạo lúc: {new Date(item.created_at).toLocaleString("vi-VN")}
                    </p>
                    {item.previousPrice != null && (
                      <p className="text-[11px] text-muted-foreground">
                        Giá trước: {formatPrice(item.previousPrice)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
