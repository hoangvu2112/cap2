import { useEffect, useState } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function AdminDealers() {
  const { toast } = useToast()

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
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản lý Đại Lý</h1>

        <div className="space-y-6">

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

              <div className="space-y-4 max-h-[700px] overflow-auto pr-2">
                {dealerRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-sm text-gray-500 text-center">
                    Chưa có yêu cầu nâng cấp đại lý.
                  </div>
                ) : (
                  dealerRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                          <div>
                            <div className="font-semibold text-gray-900 text-base">{request.applicant_name || request.applicant_email}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{request.applicant_email}</div>
                          </div>
                          <div className="text-xs text-gray-600 sm:pl-5 sm:border-l sm:border-gray-200">
                            <div className="font-medium text-gray-800 text-sm">Gói: {request.plan_name}</div>
                            <div className="text-gray-500 mt-0.5">{Number(request.price_vnd || 0).toLocaleString()} đ / {request.duration_days} ngày</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 h-9 px-4"
                            onClick={() => handleReviewRequest(request.id, "approve")}
                            disabled={reviewingId === request.id || request.status === "approved"}
                          >
                            {reviewingId === request.id ? "Đang xử lý..." : "Duyệt đại lý"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-9 px-4"
                            onClick={() => handleReviewRequest(request.id, "reject")}
                            disabled={reviewingId === request.id || request.status === "rejected"}
                          >
                            Từ chối
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-medium">Trạng thái: <span className={request.status === 'pending_review' || request.status === 'pending_payment' ? 'text-amber-600' : request.status === 'approved' ? 'text-emerald-600' : 'text-gray-700'}>{request.status}</span></span>
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-medium">Thanh toán: <span className={request.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}>{request.payment_status}</span></span>
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">Ngày gửi: {new Date(request.created_at).toLocaleString('vi-VN')}</span>
                      </div>

                      {request.note ? (
                        <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                          {request.note}
                        </div>
                      ) : null}

                      {request.admin_note ? (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <span className="font-medium">Ghi chú của Admin:</span> {request.admin_note}
                        </div>
                      ) : null}
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

              <div className="space-y-4 max-h-[700px] overflow-auto pr-2">
                {dealerReports.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-sm text-gray-500 text-center">
                    Chưa có báo cáo nào.
                  </div>
                ) : (
                  dealerReports.map((report) => (
                    <div key={report.id} className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                          <div>
                            <div className="font-semibold text-gray-900 text-base">
                              {report.reporter_name} <span className="font-normal text-gray-500 mx-1 text-sm">báo cáo</span> {report.reported_user_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{report.reporter_email} • {new Date(report.created_at).toLocaleString('vi-VN')}</div>
                          </div>
                          
                          <div className="text-xs text-gray-600 sm:pl-5 sm:border-l sm:border-gray-200">
                            <div className="font-medium text-gray-800 text-sm">Sản phẩm: {report.product_name}</div>
                            <div className="text-gray-500 mt-0.5">Trạng thái báo cáo: <span className={report.status === "pending" ? "text-amber-600 font-medium" : "font-medium"}>{report.status}</span></div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 h-9 px-4"
                            onClick={() => handleReportReview(report.id, "resolved", report.reported_user_id)}
                            disabled={reportReviewingId === report.id || report.status !== "pending"}
                          >
                            {reportReviewingId === report.id ? "Đang xử lý..." : "Hợp lệ & Khóa user"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-4"
                            onClick={() => handleReportReview(report.id, "rejected", report.reported_user_id)}
                            disabled={reportReviewingId === report.id || report.status !== "pending"}
                          >
                            Từ chối
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">Lý do: {report.reason}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">Đơn hàng: #{report.request_id}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">User bị báo cáo: {report.reported_user_status}</span>
                        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">Phí đại lý: {Number(report.dealer_fee_amount || 0).toLocaleString()} đ</span>
                      </div>

                      {report.note ? (
                        <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                          <span className="italic">" {report.note} "</span>
                        </div>
                      ) : null}

                      {report.admin_note ? (
                        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <span className="font-medium">Ghi chú xử lý:</span> {report.admin_note}
                        </div>
                      ) : null}
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
