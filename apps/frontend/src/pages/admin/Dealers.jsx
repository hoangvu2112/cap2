import { useEffect, useState } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, RefreshCw, Search, UserX, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminDealers() {
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [revokingId, setRevokingId] = useState(null)
  const [message, setMessage] = useState("")

  // Báo cáo gian lận
  const [dealerReports, setDealerReports] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportReviewingId, setReportReviewingId] = useState(null)

  const loadDealers = async () => {
    try {
      setLoading(true)
      const res = await api.get("/users")
      const allUsers = res.data || []
      const dealerList = allUsers.filter(u => u.role === "dealer")
      setDealers(dealerList)
    } catch (error) {
      console.error("Lỗi tải danh sách đại lý:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadDealerReports = async () => {
    try {
      setReportLoading(true)
      const res = await api.get("/purchase-requests/admin/reports")
      setDealerReports(res.data?.reports || [])
    } catch (error) {
      console.warn("Không thể tải báo cáo:", error.message)
      setDealerReports([])
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    loadDealers()
    loadDealerReports()
  }, [])

  const handleRevokeDealer = async (userId, userName) => {
    const reason = window.prompt(`Lý do hủy vai trò đại lý của "${userName}" (tuỳ chọn):`, "")
    if (reason === null) return // User bấm Cancel

    try {
      setRevokingId(userId)
      await api.put(`/users/${userId}`, { role: "user" })
      setMessage(`✅ Đã hủy vai trò đại lý của ${userName}`)
      setDealers(prev => prev.filter(d => d.id !== userId))
      setTimeout(() => setMessage(""), 4000)
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể hủy vai trò"
      setMessage(`❌ ${msg}`)
      setTimeout(() => setMessage(""), 4000)
    } finally {
      setRevokingId(null)
    }
  }

  const handleReportReview = async (reportId, status, reportedUserId) => {
    const adminNote = window.prompt(
      status === "resolved" ? "Ghi chú xử lý (tuỳ chọn)" : "Ghi chú từ chối (tuỳ chọn)", ""
    )
    if (adminNote === null) return

    try {
      setReportReviewingId(reportId)

      if (status === "resolved") {
        const shouldBan = window.confirm("Khóa tài khoản user bị báo cáo?")
        if (shouldBan) {
          await api.put(`/users/${reportedUserId}`, { status: "banned" })
        }
      }

      const res = await api.patch(`/purchase-requests/admin/reports/${reportId}/resolve`, {
        status,
        admin_note: adminNote || "",
      })

      const updated = res.data?.report
      setDealerReports(prev => prev.map(item => item.id === reportId ? updated : item))
      setMessage(status === "resolved" ? "✅ Đã xử lý báo cáo" : "✅ Đã từ chối báo cáo")
      setTimeout(() => setMessage(""), 4000)
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể xử lý báo cáo"
      setMessage(`❌ ${msg}`)
      setTimeout(() => setMessage(""), 4000)
    } finally {
      setReportReviewingId(null)
    }
  }

  const filteredDealers = dealers.filter(d => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (d.name || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.region || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-[#fcfaf8]">
      <AdminNavbar />
      <main className="max-w-7xl mx-auto px-6 py-8">

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản lý Đại Lý</h1>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
            message.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">

          {/* Danh sách Đại lý hiện tại */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-emerald-600" />
                Đại lý trong hệ thống
              </CardTitle>
              <CardDescription>
                Danh sách tất cả người dùng có vai trò đại lý. Bạn có thể hủy vai trò nếu cần.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên, email, khu vực..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadDealers} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              <div className="text-sm text-gray-500">
                {loading ? "Đang tải..." : `${filteredDealers.length} đại lý`}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-auto pr-1">
                {filteredDealers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-sm text-gray-500 text-center">
                    {dealers.length === 0 ? "Chưa có đại lý nào trong hệ thống." : "Không tìm thấy đại lý phù hợp."}
                  </div>
                ) : (
                  filteredDealers.map((dealer) => (
                    <div key={dealer.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="shrink-0">
                        {dealer.avatar_url ? (
                          <img
                            src={dealer.avatar_url.startsWith("http") ? dealer.avatar_url : `${(import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "")}${dealer.avatar_url}`}
                            alt={dealer.name}
                            className="w-11 h-11 rounded-full object-cover border-2 border-emerald-200"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                            {(dealer.name || "D").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">{dealer.name || "Chưa đặt tên"}</h3>
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] px-2">Đại lý</Badge>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{dealer.email}</p>
                        {dealer.region && (
                          <p className="text-xs text-gray-400 mt-0.5">📍 {dealer.region}</p>
                        )}
                      </div>

                      {/* Ngày tham gia */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400">Tham gia</p>
                        <p className="text-xs text-gray-600 font-medium">
                          {dealer.created_at ? new Date(dealer.created_at).toLocaleDateString("vi-VN") : "N/A"}
                        </p>
                      </div>

                      {/* Nút hủy vai trò */}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="shrink-0 h-9 px-3 gap-1.5"
                        onClick={() => handleRevokeDealer(dealer.id, dealer.name || dealer.email)}
                        disabled={revokingId === dealer.id}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        {revokingId === dealer.id ? "Đang xử lý..." : "Hủy vai trò"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Báo cáo gian lận */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-rose-600" />
                Báo cáo gian lận từ đại lý
              </CardTitle>
              <CardDescription>
                Các báo cáo do đại lý gửi lên, admin quyết định xử lý.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-500">
                  {reportLoading ? "Đang tải..." : `${dealerReports.filter(r => r.status === "pending").length} báo cáo chờ xử lý`}
                </div>
                <Button variant="outline" size="sm" onClick={loadDealerReports} disabled={reportLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${reportLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-auto pr-1">
                {dealerReports.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-sm text-gray-500 text-center">
                    Chưa có báo cáo nào.
                  </div>
                ) : (
                  dealerReports.map((report) => (
                    <div key={report.id} className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {report.reporter_name} <span className="font-normal text-gray-500 text-sm">báo cáo</span> {report.reported_user_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {report.reporter_email} • {new Date(report.created_at).toLocaleString("vi-VN")}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">Sản phẩm: {report.product_name}</div>
                        </div>

                        {report.status === "pending" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="bg-rose-600 hover:bg-rose-700 h-8 px-3 text-xs"
                              onClick={() => handleReportReview(report.id, "resolved", report.reported_user_id)}
                              disabled={reportReviewingId === report.id}
                            >
                              Xử lý & Khóa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleReportReview(report.id, "rejected", report.reported_user_id)}
                              disabled={reportReviewingId === report.id}
                            >
                              Từ chối
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                          Lý do: {report.reason}
                        </span>
                        <span className={`px-2 py-1 rounded-full border font-medium ${
                          report.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          report.status === "resolved" ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-gray-100 text-gray-600 border-gray-200"
                        }`}>
                          {report.status === "pending" ? "Chờ xử lý" : report.status === "resolved" ? "Đã xử lý" : "Từ chối"}
                        </span>
                      </div>

                      {report.admin_note && (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                          <span className="font-medium">Admin:</span> {report.admin_note}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
