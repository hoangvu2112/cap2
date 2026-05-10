"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import InvoicePopup from "@/components/InvoicePopup"
import { socket } from "@/socket"

const STATUS_LABEL = {
  pending: "Chờ phản hồi",
  responded: "Đã phản hồi",
  closed: "Đang chốt đơn",
  completed: "Hoàn thành",
}

const STATUS_CLASS = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  responded: "bg-blue-100 text-blue-700 border-blue-200",
  closed: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

export default function Negotiation() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [invoiceData, setInvoiceData] = useState(null)

  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) || null,
    [requests, selectedId]
  )

  const fetchRequests = async () => {
    setLoading(true)
    try {
      // Gọi API /all để lấy toàn bộ đơn liên quan đến mình
      const res = await api.get("/purchase-requests/all")
      const list = res.data || []
      
      setRequests(list)
      
      // Nếu có requestId từ URL, ưu tiên chọn nó
      const rid = Number(searchParams.get("requestId"))
      if (rid && list.some(i => i.id === rid)) {
        setSelectedId(rid)
      } else if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
      }
    } catch (error) {
      console.error("Lỗi tải danh sách thương lượng:", error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (requestId) => {
    if (!requestId) {
      setMessages([])
      return
    }

    try {
      const res = await api.get(`/purchase-requests/${requestId}/messages`)
      setMessages(res.data.messages || [])
      if (res.data.request) {
        setRequests((prev) =>
          prev.map((item) =>
            item.id === requestId ? { 
              ...item, 
              status: res.data.request.status, 
              updated_at: res.data.request.updated_at,
              farmer_status: res.data.request.farmer_status,
              buyer_status: res.data.request.buyer_status,
              fee_amount: res.data.request.fee_amount
            } : item
          )
        )
      }
    } catch (error) {
      console.error("Lỗi tải tin nhắn thương lượng:", error)
      setMessages([])
    }
  }

  const handleSendMessage = async () => {
    if (!selected || !draft.trim()) return

    try {
      const res = await api.post(`/purchase-requests/${selected.id}/messages`, {
        content: draft,
      })
      setDraft("")
      setMessages((prev) => [...prev, res.data.message])
      setRequests((prev) =>
        prev.map((item) => (item.id === selected.id ? { ...item, status: res.data.request.status, updated_at: res.data.request.updated_at } : item))
      )
    } catch (error) {
      alert(error.response?.data?.error || "Không gửi được tin nhắn")
    }
  }

  const handleOpenInvoice = async () => {
    if (!selected) return
    try {
      const res = await api.get(`/wallet/invoice-preview/${selected.id}`)
      if (res.data.success) {
        setInvoiceData(res.data)
        setShowInvoice(true)
      }
    } catch (error) {
      alert(error.response?.data?.error || "Không thể lấy thông tin hoá đơn")
    }
  }

  const handlePaymentSuccess = () => {
    alert("Thanh toán thành công!")
    fetchMessages(selectedId) // refresh data
  }

  const handleDealerReport = async () => {
    if (!selected) return
    const reason = window.prompt("Nhập lý do báo cáo user:")
    if (!reason?.trim()) return
    const note = window.prompt("Ghi chú thêm (tuỳ chọn):", "") || ""

    try {
      setActioningId(selected.id)
      await api.post(`/purchase-requests/${selected.id}/report`, {
        reason: reason.trim(),
        note: note.trim(),
      })
      setRequests((prev) => prev.map((item) => (item.id === selected.id ? { ...item, dealer_report_status: "reported" } : item)))
      alert("Đã gửi báo cáo cho admin")
    } catch (error) {
      alert(error.response?.data?.error || "Không thể gửi báo cáo")
    } finally {
      setActioningId(null)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [user?.role])

  useEffect(() => {
    const requestId = Number(searchParams.get("requestId"))
    if (!requestId || !requests.length) return

    if (requests.some((item) => item.id === requestId)) {
      setSelectedId(requestId)
    }
  }, [searchParams, requests])

  useEffect(() => {
    fetchMessages(selectedId)
  }, [selectedId])

  useEffect(() => {
    socket.on("commission_paid", (data) => {
      if (data.request_id === selectedId) {
        fetchMessages(selectedId)
      }
      fetchRequests() // Cập nhật danh sách bên trái
    })

    socket.on("order_completed", (data) => {
      if (data.request_id === selectedId) {
        fetchMessages(selectedId)
        alert("Đơn hàng đã hoàn thành! Cả hai bên đã thanh toán hoa hồng.")
      }
      fetchRequests() // Cập nhật danh sách bên trái
    })

    return () => {
      socket.off("commission_paid")
      socket.off("order_completed")
    }
  }, [selectedId])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thương lượng mua bán</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Đang tải...</p>
              ) : requests.length === 0 ? (
                <p className="text-muted-foreground">Chưa có yêu cầu nào để thương lượng.</p>
              ) : (
                <div className="space-y-2">
                  {requests.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left rounded-lg border p-3 transition ${selectedId === item.id ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                    >
                      <p className="font-semibold text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.buyer_id === user?.id 
                          ? `Đối tác (Người bán): ${item.farmer_name}` 
                          : `Đối tác (Người mua): ${item.buyer_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Đề xuất: {Number(item.proposed_price).toLocaleString("vi-VN")} đ/{item.product_unit || "kg"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className={`inline-flex px-2 py-1 border rounded-full text-[11px] font-semibold ${STATUS_CLASS[item.status] || STATUS_CLASS.pending}`}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                        {item.status === 'closed' && (
                          <>
                            {(item.farmer_id !== user?.id && item.farmer_status === 'paid') && (
                              <span className="inline-flex px-2 py-1 border border-green-200 bg-green-50 text-green-700 rounded-full text-[11px] font-semibold animate-pulse">
                                Đối tác đã thanh toán
                              </span>
                            )}
                            {(item.buyer_id !== user?.id && item.buyer_status === 'paid') && (
                              <span className="inline-flex px-2 py-1 border border-green-200 bg-green-50 text-green-700 rounded-full text-[11px] font-semibold animate-pulse">
                                Đối tác đã thanh toán
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {selected
                  ? `Yêu cầu #${selected.id} - ${selected.product_name}`
                  : "Chọn một yêu cầu để bắt đầu thương lượng"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <div className="rounded-lg border p-3 text-sm bg-muted/20">
                    <p>
                      <span className="text-muted-foreground">Số lượng:</span> {Number(selected.quantity).toLocaleString("vi-VN")} {selected.product_unit || "kg"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Giá đề xuất:</span> {Number(selected.proposed_price).toLocaleString("vi-VN")} đ/{selected.product_unit || "kg"}
                    </p>
                    {selected.note && (
                      <p>
                        <span className="text-muted-foreground">Ghi chú:</span> {selected.note}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3 h-[360px] overflow-y-auto space-y-2 bg-white">
                    {messages.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Chưa có tin nhắn, hãy bắt đầu thương lượng.</p>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.sender_id === user?.id
                        return (
                          <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <p>{msg.content}</p>
                              <p className={`text-[11px] mt-1 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                {msg.sender_name} • {new Date(msg.created_at).toLocaleString("vi-VN")}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Nhập nội dung thương lượng..."
                      className="min-h-[88px]"
                      disabled={selected.status === "closed"}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSendMessage} disabled={selected.status === "completed" || !draft.trim()}>
                        Gửi tin nhắn
                      </Button>
                      {selected.status !== "completed" && (
                        <Button 
                          variant={selected.status === "closed" ? "default" : "outline"} 
                          onClick={handleOpenInvoice}
                          disabled={(selected.farmer_id === user?.id && selected.farmer_status === "paid") || 
                                    (selected.buyer_id === user?.id && selected.buyer_status === "paid")}
                        >
                          {(selected.farmer_id === user?.id && selected.farmer_status === "paid") || 
                           (selected.buyer_id === user?.id && selected.buyer_status === "paid")
                            ? "Đã thanh toán (Chờ đối tác)" 
                            : (selected.status === "closed" ? "Thanh toán Hoa hồng" : "Chốt đơn")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {selected.status === "completed" && (
                    <div className="rounded-lg border p-3 bg-emerald-50/60 space-y-2">
                      <p className="text-sm font-medium text-emerald-800">Đơn hàng đã hoàn thành. Cả hai bên đã thanh toán hoa hồng.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleDealerReport} disabled={actioningId === selected.id || selected.dealer_report_status === "reported"}>
                          {selected.dealer_report_status === "reported" ? "Đã báo cáo" : "Báo cáo người dùng"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Chọn một yêu cầu để xem nội dung thương lượng.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
      
      {showInvoice && (
        <InvoicePopup 
          isOpen={showInvoice}
          onClose={() => setShowInvoice(false)}
          requestId={selectedId}
          invoiceData={invoiceData}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
