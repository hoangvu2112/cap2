"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STATUS_LABEL = {
  pending: "Chờ phản hồi",
  responded: "Đã phản hồi",
  closed: "Đã chốt",
}

const STATUS_CLASS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  responded: "bg-blue-100 text-blue-700 border-blue-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

const FEE_LABEL = {
  unpaid: "Chưa ghi phí 30k",
  recorded: "Đã ghi phí 30k",
}

const FEE_CLASS = {
  unpaid: "bg-slate-100 text-slate-700 border-slate-200",
  recorded: "bg-violet-100 text-violet-700 border-violet-200",
}

export default function PurchaseRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await api.get("/purchase-requests/sent")
      setRequests(res.data || [])
    } catch (error) {
      console.error("Lỗi tải yêu cầu mua:", error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDeal = async (requestId) => {
    try {
      setActioningId(requestId)
      const res = await api.patch(`/purchase-requests/${requestId}/dealer-confirm`)
      setRequests((prev) => prev.map((item) => (item.id === requestId ? { ...item, ...res.data } : item)))
      alert("Đã ghi nhận phí đại lý 30k cho giao dịch này")
    } catch (error) {
      alert(error.response?.data?.error || "Không thể ghi nhận phí")
    } finally {
      setActioningId(null)
    }
  }

  const handleReport = async (requestId) => {
    const reason = window.prompt("Nhập lý do báo cáo user:")
    if (!reason?.trim()) return
    const note = window.prompt("Ghi chú thêm (tuỳ chọn):", "") || ""

    try {
      setActioningId(requestId)
      await api.post(`/purchase-requests/${requestId}/report`, {
        reason: reason.trim(),
        note: note.trim(),
      })
      setRequests((prev) => prev.map((item) => (item.id === requestId ? { ...item, dealer_report_status: "reported" } : item)))
      alert("Đã gửi báo cáo cho admin")
    } catch (error) {
      alert(error.response?.data?.error || "Không thể gửi báo cáo")
    } finally {
      setActioningId(null)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Yêu cầu mua đã gửi</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Đang tải yêu cầu...</div>
            ) : requests.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Bạn chưa gửi yêu cầu nào. <Link to="/" className="text-primary hover:underline">Quay về bảng giá</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Gửi cho: {item.farmer_name} • Khu vực: {item.product_region || "N/A"}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit px-3 py-1 text-xs border rounded-full font-semibold ${STATUS_CLASS[item.status] || STATUS_CLASS.pending}`}>
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex w-fit px-3 py-1 border rounded-full font-semibold ${FEE_CLASS[item.dealer_fee_status || "unpaid"]}`}>
                        {FEE_LABEL[item.dealer_fee_status || "unpaid"]}
                      </span>
                      {item.dealer_action_at ? (
                        <span className="inline-flex w-fit px-3 py-1 border rounded-full font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                          Xác nhận lúc {new Date(item.dealer_action_at).toLocaleString("vi-VN")}
                        </span>
                      ) : null}
                      {item.dealer_report_status === "reported" ? (
                        <span className="inline-flex w-fit px-3 py-1 border rounded-full font-semibold bg-rose-50 text-rose-700 border-rose-200">
                          Đã báo cáo user
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Số lượng:</span> {Number(item.quantity).toLocaleString("vi-VN")} {item.product_unit || "kg"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Giá đề xuất:</span> {Number(item.proposed_price).toLocaleString("vi-VN")} đ/{item.product_unit || "kg"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cập nhật:</span> {new Date(item.updated_at || item.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>

                    {item.note && (
                      <p className="mt-2 text-sm text-muted-foreground">Ghi chú: {item.note}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/negotiation?requestId=${item.id}`} className="ml-auto">
                        <Button size="sm" variant="ghost">Vào thương lượng</Button>
                      </Link>
                      {item.status === "closed" && item.dealer_fee_status !== "recorded" && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmDeal(item.id)}
                          disabled={actioningId === item.id}
                        >
                          {actioningId === item.id ? "Đang ghi phí..." : "Đã mua / ghi phí 30k"}
                        </Button>
                      )}
                      {item.status === "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReport(item.id)}
                          disabled={actioningId === item.id || item.dealer_report_status === "reported"}
                        >
                          {item.dealer_report_status === "reported" ? "Đã báo cáo" : "Báo cáo user"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
