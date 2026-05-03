"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import api from "../../lib/api"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { X, Edit2, Pin, Loader2 } from "lucide-react"

function SupplyManager() {
  const [listings, setListings] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [boostPlans, setBoostPlans] = useState([])
  const [boostingId, setBoostingId] = useState(null)
  
  // States cho Form
  const [editingId, setEditingId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantityAvailable, setQuantityAvailable] = useState("")
  const [harvestStart, setHarvestStart] = useState("")
  const [harvestEnd, setHarvestEnd] = useState("")
  const [supplyStatus, setSupplyStatus] = useState("available")
  const [note, setNote] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const normalizeBoostPlans = (plans) => {
    const planByDuration = new Map()

    for (const plan of plans || []) {
      const key = Number(plan.duration_days)
      const current = planByDuration.get(key)

      if (!current) {
        planByDuration.set(key, plan)
        continue
      }

      const currentPrice = Number(current.price || 0)
      const nextPrice = Number(plan.price || 0)
      const currentIsFree = currentPrice === 0
      const nextIsFree = nextPrice === 0

      if (currentIsFree && !nextIsFree) {
        planByDuration.set(key, plan)
        continue
      }

      if (currentIsFree === nextIsFree && nextPrice < currentPrice) {
        planByDuration.set(key, plan)
      }
    }

    return Array.from(planByDuration.values()).sort(
      (a, b) => Number(a.duration_days) - Number(b.duration_days)
    )
  }

  const fetchListings = async () => {
    try {
      setLoading(true)
      const res = await api.get("/users/me/source-listings")
      setListings(res.data || [])
    } catch (error) {
      console.error("Không tải được nguồn hàng", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await api.get("/products/all")
        setAllProducts(res.data)
        if (res.data.length > 0) setSelectedProduct(String(res.data[0].id))
      } catch (error) {
        console.error("Lỗi tải sản phẩm", error)
      }
    }
    const fetchBoostPlans = async () => {
      try {
        const res = await api.get("/listing-boosts/plans")
        setBoostPlans(normalizeBoostPlans(res.data?.plans || []))
      } catch (error) {
        console.error("Lỗi tải gói ghim", error)
      }
    }

    fetchAllProducts()
    fetchBoostPlans()
    fetchListings()
  }, [])

  const handleEditListing = (item) => {
    setEditingId(item.id)
    setSelectedProduct(String(item.product_id))
    setQuantityAvailable(String(item.quantity_available))
    
    setHarvestStart(item.harvest_start ? new Date(item.harvest_start).toISOString().split('T')[0] : "")
    setHarvestEnd(item.harvest_end ? new Date(item.harvest_end).toISOString().split('T')[0] : "")
    
    setSupplyStatus(item.supply_status)
    setNote(item.note || "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setQuantityAvailable("")
    setHarvestStart("")
    setHarvestEnd("")
    setSupplyStatus("available")
    setNote("")
  }

  const handleSaveListing = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        product_id: Number(selectedProduct),
        quantity_available: Number(quantityAvailable),
        harvest_start: harvestStart || null,
        harvest_end: harvestEnd || null,
        supply_status: supplyStatus,
        note,
      }

      if (editingId) {
        await api.put(`/users/me/source-listings/${editingId}`, payload)
        alert("Đã cập nhật lô hàng!")
      } else {
        await api.post("/users/me/source-listings", payload)
        alert("Đã lưu lô hàng mới!")
      }

      handleCancelEdit()
      fetchListings()
    } catch (error) {
      console.error("Lỗi khi lưu nguồn hàng", error)
      alert(error.response?.data?.error || "Lỗi! Không thể lưu.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteListing = async (listingId, productName) => {
    if (!confirm(`Bạn có chắc muốn xoá lô hàng "${productName}" này không?`)) return

    try {
      await api.delete(`/users/me/source-listings/${listingId}`)
      setListings((prev) => prev.filter((item) => item.id !== listingId))
      alert("Đã xoá nguồn hàng.")
      if (editingId === listingId) handleCancelEdit()
    } catch (error) {
      console.error("Lỗi khi xoá", error)
      alert(error.response?.data?.error || "Lỗi! Không thể xoá.")
    }
  }

  const handleBoostListing = async (item) => {
    const availablePlans = normalizeBoostPlans(boostPlans)

    if (item.is_boosted) {
      alert("Nguồn hàng này đang được ghim, chưa cần mua thêm gói.")
      return
    }

    if (availablePlans.length === 0) {
      alert("Chưa có gói ghim khả dụng. Vui lòng thử lại sau.")
      return
    }

    const planText = availablePlans
      .map((plan, index) => `${index + 1}. ${plan.name} - ${Number(plan.price).toLocaleString("vi-VN")}đ`)
      .join("\n")
    const selected = prompt(`Chọn gói ghim cho ${item.product_name}:\n${planText}\n\nNhập số thứ tự gói:`)
    if (!selected) return

    const plan = availablePlans[Number(selected) - 1]
    if (!plan) {
      alert("Gói ghim không hợp lệ")
      return
    }

    const ok = confirm(`Mô phỏng thanh toán ${Number(plan.price).toLocaleString("vi-VN")}đ cho gói ${plan.name}?`)
    if (!ok) return

    try {
      setBoostingId(item.id)
      const paymentRes = await api.post("/listing-boosts/create-payment", {
        listing_id: item.id,
        plan_id: plan.id,
      })
      const paymentId = paymentRes.data?.payment?.id
      if (!paymentId) throw new Error("Không tạo được mã thanh toán")

      await api.post(`/listing-boosts/payments/${paymentId}/simulate-success`)
      alert("Thanh toán mô phỏng thành công. Tin của bạn đã được ghim!")
      fetchListings()
    } catch (error) {
      console.error("Lỗi ghim tin", error)
      alert(error.response?.data?.error || "Không thể ghim nguồn hàng")
    } finally {
      setBoostingId(null)
    }
  }


  const statusLabel = { available: "Đang có hàng", soon: "Sắp thu hoạch", partial: "Bán một phần", sold: "Đã bán gần hết" }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingId ? "Cập nhật lô hàng" : "Thêm lô hàng mới"}</CardTitle>
        <CardDescription>Khai báo chi tiết các lô hàng đang và sắp thu hoạch của bạn.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <form onSubmit={handleSaveListing} className={`space-y-4 rounded-lg border p-4 transition-colors ${editingId ? "border-emerald-500 bg-emerald-50/20" : "border-border"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Sản phẩm</label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm">
                {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.region})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Trạng thái</label>
              <select value={supplyStatus} onChange={(e) => setSupplyStatus(e.target.value)} className="flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm">
                <option value="available">Đang có hàng</option>
                <option value="soon">Sắp thu hoạch</option>
                <option value="partial">Bán một phần</option>
                <option value="sold">Đã bán gần hết</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Sản lượng (kg)</label>
              <Input type="number" value={quantityAvailable} onChange={(e) => setQuantityAvailable(e.target.value)} placeholder="VD: 5000" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ghi chú</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Hàng loại 1..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Bắt đầu thu hoạch</label>
              <Input type="date" value={harvestStart} onChange={(e) => setHarvestStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Kết thúc thu hoạch</label>
              <Input type="date" value={harvestEnd} onChange={(e) => setHarvestEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className={editingId ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
              {saving ? "Đang lưu..." : (editingId ? "Cập nhật lô hàng" : "Lưu lô hàng mới")}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                Hủy thay đổi
              </Button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold border-b pb-2">Danh sách lô hàng của bạn</h3>
          {loading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn chưa khai báo lô hàng nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map((item) => (
                <div key={item.id} className={`flex justify-between items-start p-4 rounded-md border transition-colors ${editingId === item.id ? "border-emerald-500 bg-emerald-50/50" : "bg-muted/50"}`}>
                  <div className="flex-grow space-y-1">
                    <p className="font-bold text-foreground text-lg">{item.product_name}</p>
                    <p className="text-sm">📦 Sản lượng: <span className="font-medium">{item.quantity_available.toLocaleString()} kg</span></p>
                    <p className="text-sm">🏷️ Trạng thái: <span className="font-medium text-emerald-700">{statusLabel[item.supply_status]}</span></p>
                    {item.is_boosted ? (
                      <p className="text-sm font-semibold text-amber-700">
                        📌 Đang ghim{item.boost_end_at ? ` đến ${new Date(item.boost_end_at).toLocaleDateString("vi-VN")}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Tin thường — có thể mua gói ghim để hiển thị nổi bật với đại lý.</p>
                    )}
                    {item.harvest_start && (
                      <p className="text-sm">🗓️ Thu hoạch: {new Date(item.harvest_start).toLocaleDateString("vi-VN")} - {new Date(item.harvest_end).toLocaleDateString("vi-VN")}</p>
                    )}
                    {item.note && <p className="text-sm italic text-muted-foreground">📝 {item.note}</p>}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                      onClick={() => handleBoostListing(item)}
                      disabled={boostingId === item.id || item.is_boosted}
                      title={item.is_boosted ? "Tin đang được ghim" : "Mua gói ghim tin"}
                    >
                      {boostingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEditListing(item)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteListing(item.id, item.product_name)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function MySupplyPage() {
  return (
    <div className="space-y-6">
      <SupplyManager />
    </div>
  )
}