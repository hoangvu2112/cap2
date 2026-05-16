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
  pending: "Chß╗¥ phß║ún hß╗ôi",
  responded: "─É├ú phß║ún hß╗ôi",
  closed: "─Éang chß╗æt ─æ╞ín",
  completed: "Ho├án th├ánh",
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
      // Gß╗ìi API /all ─æß╗â lß║Ñy to├án bß╗Ö ─æ╞ín li├¬n quan ─æß║┐n m├¼nh
      const res = await api.get("/purchase-requests/all")
      const list = res.data || []
      
      setRequests(list)
      
      // Nß║┐u c├│ requestId tß╗½ URL, ╞░u ti├¬n chß╗ìn n├│
      const rid = Number(searchParams.get("requestId"))
      if (rid && list.some(i => i.id === rid)) {
        setSelectedId(rid)
      } else if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
      }
    } catch (error) {
      console.error("Lß╗ùi tß║úi danh s├ích th╞░╞íng l╞░ß╗úng:", error)
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
      console.error("Lß╗ùi tß║úi tin nhß║»n th╞░╞íng l╞░ß╗úng:", error)
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
      alert(error.response?.data?.error || "Kh├┤ng gß╗¡i ─æ╞░ß╗úc tin nhß║»n")
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
      alert(error.response?.data?.error || "Kh├┤ng thß╗â lß║Ñy th├┤ng tin ho├í ─æ╞ín")
    }
  }

  const handlePaymentSuccess = () => {
    alert("Thanh to├ín th├ánh c├┤ng!")
    fetchMessages(selectedId) // refresh data
  }

  const handleDealerReport = async () => {
    if (!selected) return
    const reason = window.prompt("Nhß║¡p l├╜ do b├ío c├ío user:")
    if (!reason?.trim()) return
    const note = window.prompt("Ghi ch├║ th├¬m (tuß╗│ chß╗ìn):", "") || ""

    try {
      setActioningId(selected.id)
      await api.post(`/purchase-requests/${selected.id}/report`, {
        reason: reason.trim(),
        note: note.trim(),
      })
      setRequests((prev) => prev.map((item) => (item.id === selected.id ? { ...item, dealer_report_status: "reported" } : item)))
      alert("─É├ú gß╗¡i b├ío c├ío cho admin")
    } catch (error) {
      alert(error.response?.data?.error || "Kh├┤ng thß╗â gß╗¡i b├ío c├ío")
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
      fetchRequests() // Cß║¡p nhß║¡t danh s├ích b├¬n tr├íi
    })

    socket.on("order_completed", (data) => {
      if (data.request_id === selectedId) {
        fetchMessages(selectedId)
        alert("─É╞ín h├áng ─æ├ú ho├án th├ánh! Cß║ú hai b├¬n ─æ├ú thanh to├ín hoa hß╗ông.")
      }
      fetchRequests() // Cß║¡p nhß║¡t danh s├ích b├¬n tr├íi
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
              <CardTitle>Th╞░╞íng l╞░ß╗úng mua b├ín</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">─Éang tß║úi...</p>
              ) : requests.length === 0 ? (
                <p className="text-muted-foreground">Ch╞░a c├│ y├¬u cß║ºu n├áo ─æß╗â th╞░╞íng l╞░ß╗úng.</p>
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
                          ? `─Éß╗æi t├íc (Ng╞░ß╗¥i b├ín): ${item.farmer_name}` 
                          : `─Éß╗æi t├íc (Ng╞░ß╗¥i mua): ${item.buyer_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ─Éß╗ü xuß║Ñt: {Number(item.proposed_price).toLocaleString("vi-VN")} ─æ/{item.product_unit || "kg"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className={`inline-flex px-2 py-1 border rounded-full text-[11px] font-semibold ${STATUS_CLASS[item.status] || STATUS_CLASS.pending}`}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                        {item.status === 'closed' && (
                          <>
                            {(item.farmer_id !== user?.id && item.farmer_status === 'paid') && (
                              <span className="inline-flex px-2 py-1 border border-green-200 bg-green-50 text-green-700 rounded-full text-[11px] font-semibold animate-pulse">
                                ─Éß╗æi t├íc ─æ├ú thanh to├ín
                              </span>
                            )}
                            {(item.buyer_id !== user?.id && item.buyer_status === 'paid') && (
                              <span className="inline-flex px-2 py-1 border border-green-200 bg-green-50 text-green-700 rounded-full text-[11px] font-semibold animate-pulse">
                                ─Éß╗æi t├íc ─æ├ú thanh to├ín
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
                  ? `Y├¬u cß║ºu #${selected.id} - ${selected.product_name}`
                  : "Chß╗ìn mß╗Öt y├¬u cß║ºu ─æß╗â bß║»t ─æß║ºu th╞░╞íng l╞░ß╗úng"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <div className="rounded-lg border p-3 text-sm bg-muted/20">
                    <p>
                      <span className="text-muted-foreground">Sß╗æ l╞░ß╗úng:</span> {Number(selected.quantity).toLocaleString("vi-VN")} {selected.product_unit || "kg"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Gi├í ─æß╗ü xuß║Ñt:</span> {Number(selected.proposed_price).toLocaleString("vi-VN")} ─æ/{selected.product_unit || "kg"}
                    </p>
                    {selected.note && (
                      <p>
                        <span className="text-muted-foreground">Ghi ch├║:</span> {selected.note}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3 h-[360px] overflow-y-auto space-y-2 bg-white">
                    {messages.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Ch╞░a c├│ tin nhß║»n, h├úy bß║»t ─æß║ºu th╞░╞íng l╞░ß╗úng.</p>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.sender_id === user?.id
                        return (
                          <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <p>{msg.content}</p>
                              <p className={`text-[11px] mt-1 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                {msg.sender_name} ΓÇó {new Date(msg.created_at).toLocaleString("vi-VN")}
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
                      placeholder="Nhß║¡p nß╗Öi dung th╞░╞íng l╞░ß╗úng..."
                      className="min-h-[88px]"
                      disabled={selected.status === "closed"}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSendMessage} disabled={selected.status === "completed" || !draft.trim()}>
                        Gß╗¡i tin nhß║»n
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
                            ? "─É├ú thanh to├ín (Chß╗¥ ─æß╗æi t├íc)" 
                            : (selected.status === "closed" ? "Thanh to├ín Hoa hß╗ông" : "Chß╗æt ─æ╞ín")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {selected.status === "completed" && (
                    <div className="rounded-lg border p-3 bg-emerald-50/60 space-y-2">
                      <p className="text-sm font-medium text-emerald-800">─É╞ín h├áng ─æ├ú ho├án th├ánh. Cß║ú hai b├¬n ─æ├ú thanh to├ín hoa hß╗ông.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleDealerReport} disabled={actioningId === selected.id || selected.dealer_report_status === "reported"}>
                          {selected.dealer_report_status === "reported" ? "─É├ú b├ío c├ío" : "B├ío c├ío ng╞░ß╗¥i d├╣ng"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Chß╗ìn mß╗Öt y├¬u cß║ºu ─æß╗â xem nß╗Öi dung th╞░╞íng l╞░ß╗úng.</p>
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
