import { useEffect, useState } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RefreshCw, Server, ShieldCheck, LogOut } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { useNavigate } from "react-router-dom"

export default function AdminSettings() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const [scraperRunning, setScraperRunning] = useState(false)
  const [dealerRequests, setDealerRequests] = useState([])
  const [dealerLoading, setDealerLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState(null)
  const [dealerReports, setDealerReports] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportReviewingId, setReportReviewingId] = useState(null)

  const loadDealerRequests = async () => {
    try {
      setDealerLoading(true)
      const res = await api.get("/dealer-upgrade/admin/requests")
      setDealerRequests(res.data?.requests || [])
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể tải yêu cầu nâng cấp đại lý"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setDealerLoading(false)
    }
  }

  const loadDealerReports = async () => {
    try {
      setReportLoading(true)
      const res = await api.get("/purchase-requests/admin/reports")
      setDealerReports(res.data?.reports || [])
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể tải báo cáo"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    loadDealerRequests()
    loadDealerReports()
  }, [])

  // Hàm chạy Scraper thủ công (gọi API thật)
  const handleRunScraper = async () => {
    setScraperRunning(true)
    try {
      const res = await api.post("/admin/scrape-trigger")
      toast({ title: "Thành công", description: res.data.message || "Hệ thống đang cào dữ liệu mới..." })
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể kích hoạt Scraper"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setScraperRunning(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const handleReviewRequest = async (requestId, action) => {
    const adminNote = window.prompt(action === "approve" ? "Ghi chú duyệt (tuỳ chọn)" : "Lý do từ chối (tuỳ chọn)", "")

    try {
      setReviewingId(requestId)
      const res = await api.patch(`/dealer-upgrade/admin/requests/${requestId}/review`, {
        action,
        admin_note: adminNote || "",
      })

      const updated = res.data?.request
      setDealerRequests((prev) => prev.map((item) => (item.id === requestId ? updated : item)))
      toast({
        title: "Thành công",
        description: action === "approve" ? "Đã duyệt yêu cầu đại lý" : "Đã từ chối yêu cầu đại lý",
      })
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể xử lý yêu cầu"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setReviewingId(null)
    }
  }

  const handleReportReview = async (reportId, status, reportedUserId) => {
    const adminNote = window.prompt(status === "resolved" ? "Ghi chú xử lý (tuỳ chọn)" : "Ghi chú từ chối (tuỳ chọn)", "")

    try {
      setReportReviewingId(reportId)

      if (status === "resolved") {
        const shouldBan = window.confirm("Khóa tài khoản user bị báo cáo sau khi xử lý?")
        if (shouldBan) {
          await api.put(`/users/${reportedUserId}`, { status: "banned" })
        }
      }

      const res = await api.patch(`/purchase-requests/admin/reports/${reportId}/resolve`, {
        status,
        admin_note: adminNote || "",
      })

      const updated = res.data?.report
      setDealerReports((prev) => prev.map((item) => (item.id === reportId ? updated : item)))
      toast({
        title: "Thành công",
        description: status === "resolved" ? "Đã xử lý báo cáo" : "Đã từ chối báo cáo",
      })
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể xử lý báo cáo"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setReportReviewingId(null)
    }
  }

  const openRequests = dealerRequests.filter((request) => ["pending_payment", "pending_review"].includes(request.status))

  return (
    <div className="min-h-screen bg-[#fcfaf8]">
      <AdminNavbar />
      <main className="max-w-3xl mx-auto px-6 py-8">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cài đặt Hệ thống</h1>

        <div className="space-y-6">
          
          {/* 1. THÔNG TIN ADMIN */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" /> 
                Tài khoản Quản trị
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    A
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user?.name || "Admin"}</div>
                    <div className="text-xs text-gray-500">{user?.email}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. ĐIỀU KHIỂN SCRAPER */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="w-5 h-5 text-blue-600" /> 
                Hệ thống Cào dữ liệu (Scraper)
              </CardTitle>
              <CardDescription>
                Điều khiển các tác vụ tự động của hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Kích hoạt Tự động (Cron Job)</Label>
                  <p className="text-sm text-gray-500">Tự động cào giá mỗi 30 phút.</p>
                </div>
                <Switch checked={true} disabled /> {/* Mặc định luôn bật */}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base">Chạy thủ công</Label>
                  <p className="text-sm text-gray-500 text-right">Dùng khi cần cập nhật giá gấp.</p>
                </div>
                <Button 
                  onClick={handleRunScraper} 
                  disabled={scraperRunning}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {scraperRunning ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
                  ) : (
                    "🚀 Kích hoạt Scraper Ngay"
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Duyệt nâng cấp đại lý
              </CardTitle>
              <CardDescription>
                Xử lý các yêu cầu user gửi lên để được chuyển sang vai trò đại lý sau thanh toán.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-500">
                  {dealerLoading ? "Đang tải yêu cầu..." : `${openRequests.length} yêu cầu đang chờ xử lý`}
                </div>
                <Button variant="outline" size="sm" onClick={loadDealerRequests} disabled={dealerLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${dealerLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                {dealerRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                    Chưa có yêu cầu nâng cấp đại lý.
                  </div>
                ) : (
                  dealerRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">{request.applicant_name || request.applicant_email}</div>
                          <div className="text-xs text-gray-500">{request.applicant_email}</div>
                        </div>
                        <div className="text-xs text-gray-600 sm:text-right">
                          <div>Gói: {request.plan_name}</div>
                          <div>{Number(request.price_vnd || 0).toLocaleString()} đ / {request.duration_days} ngày</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Trạng thái: {request.status}</span>
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Thanh toán: {request.payment_status}</span>
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Ngày gửi: {new Date(request.created_at).toLocaleString('vi-VN')}</span>
                      </div>

                      {request.note ? (
                        <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                          {request.note}
                        </div>
                      ) : null}

                      {request.admin_note ? (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          Admin note: {request.admin_note}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleReviewRequest(request.id, "approve")}
                          disabled={reviewingId === request.id || request.status === "approved"}
                        >
                          {reviewingId === request.id ? "Đang xử lý..." : "Duyệt đại lý"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReviewRequest(request.id, "reject")}
                          disabled={reviewingId === request.id || request.status === "rejected"}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-rose-600" />
                Báo cáo gian lận từ đại lý
              </CardTitle>
              <CardDescription>
                Admin xem các báo cáo do đại lý gửi lên và quyết định xử lý thủ công.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-500">
                  {reportLoading ? "Đang tải báo cáo..." : `${dealerReports.filter((r) => r.status === "pending").length} báo cáo chờ xử lý`}
                </div>
                <Button variant="outline" size="sm" onClick={loadDealerReports} disabled={reportLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${reportLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                {dealerReports.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                    Chưa có báo cáo nào.
                  </div>
                ) : (
                  dealerReports.map((report) => (
                    <div key={report.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900">{report.reporter_name} báo cáo {report.reported_user_name}</div>
                          <div className="text-xs text-gray-500">{report.reporter_email} • {new Date(report.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                        <div className="text-xs text-gray-600 sm:text-right">
                          <div>Đơn: #{report.request_id} • {report.product_name}</div>
                          <div className="mt-1">Trạng thái: {report.status}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Lý do: {report.reason}</span>
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">User bị báo cáo: {report.reported_user_status}</span>
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Phí đại lý: {Number(report.dealer_fee_amount || 0).toLocaleString()} đ</span>
                      </div>

                      {report.note ? (
                        <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                          {report.note}
                        </div>
                      ) : null}

                      {report.admin_note ? (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          Admin note: {report.admin_note}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={() => handleReportReview(report.id, "resolved", report.reported_user_id)}
                          disabled={reportReviewingId === report.id || report.status !== "pending"}
                        >
                          {reportReviewingId === report.id ? "Đang xử lý..." : "Xử lý & khóa user"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReportReview(report.id, "rejected", report.reported_user_id)}
                          disabled={reportReviewingId === report.id || report.status !== "pending"}
                        >
                          Từ chối báo cáo
                        </Button>
                      </div>
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