"use client"

import { useState, useEffect } from "react"
import Navbar from "../../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { User, X } from "lucide-react" // <-- THÊM ICON 'X'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "../../lib/api"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"


function CostManager() {
  const [myProducts, setMyProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [cost, setCost] = useState(0)

  // 1. Tải danh sách tất cả sản phẩm (để chọn)
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await api.get("/products/all") //
        setAllProducts(res.data)
        if (res.data.length > 0) {
          setSelectedProduct(res.data[0].id)
        }
      } catch (error) {
        console.error("Không tải được danh sách sản phẩm", error)
      }
    }
    fetchAllProducts()
  }, [])

  // 2. Tải chi phí đã lưu của tôi
  const fetchMyCosts = async () => {
    try {
      const res = await api.get("/costs")
      setMyProducts(res.data)
    } catch (error) {
      console.error("Không tải được chi phí đã lưu", error)
    }
  }
  useEffect(() => {
    fetchMyCosts()
  }, [])

  // 3. Hàm lưu chi phí
  const handleSaveCost = async (e) => {
    e.preventDefault()
    try {
      await api.post("/costs", {
        product_id: Number(selectedProduct),
        cost_price: Number(cost),
      })
      fetchMyCosts() // Tải lại danh sách
      alert("Đã lưu chi phí!")
    } catch (error) {
      console.error("Lỗi khi lưu chi phí", error)
      alert("Lỗi! Không thể lưu chi phí.")
    }
  }
  
  
  const handleDeleteCost = async (productId, productName) => {
    // Hỏi xác nhận trước khi xóa
    if (!confirm(`Bạn có chắc muốn xóa chi phí cho "${productName}" không?`)) {
      return;
    }
    
    try {
      await api.delete(`/costs/${productId}`); // Gọi API DELETE mới
      fetchMyCosts(); // Tải lại danh sách
      alert("Đã xóa chi phí.");
    } catch (error) {
      console.error("Lỗi khi xóa chi phí", error);
      alert("Lỗi! Không thể xóa chi phí.");
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi phí sản xuất</CardTitle>
        <CardDescription>
          Nhập chi phí (giống, phân bón,...) cho mỗi kg nông sản của bạn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Form thêm/cập nhật chi phí */}
        <form
          onSubmit={handleSaveCost}
          className="flex flex-col sm:flex-row gap-4 mb-6"
        >
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.region})
              </option>
            ))}
          </select>

          <Input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Chi phí (VNĐ)"
            required
          />
          <Button type="submit">Lưu</Button>
        </form>

        {/* Danh sách chi phí đã lưu (ĐÃ THÊM NÚT XÓA) */}
        <div className="space-y-2">
          <h4 className="font-semibold">Chi phí đã lưu của bạn:</h4>
          {myProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bạn chưa lưu chi phí nào.
            </p>
          ) : (
            myProducts.map((item) => (
              <div
                key={item.product_id}
                className="flex justify-between items-center p-2 rounded-md bg-muted"
              >
                {/* Tên và giá */}
                <div>
                  <span className="font-medium">{item.product_name}</span>
                  <br />
                  <span className="text-sm text-muted-foreground">
                    {item.cost_price.toLocaleString()} đ / {item.product_unit}
                  </span>
                </div>
                {/* --- NÚT XÓA MỚI --- */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => handleDeleteCost(item.product_id, item.product_name)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DealerUpgradeCard({ user, onRoleUpdated }) {
  const [plans, setPlans] = useState([])
  const [requests, setRequests] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [payingRequestId, setPayingRequestId] = useState(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      setError("")

      const [plansRes, requestsRes] = await Promise.all([
        api.get("/dealer-upgrade/plans"),
        api.get("/dealer-upgrade/me"),
      ])

      const loadedPlans = plansRes.data?.plans || []
      const loadedRequests = requestsRes.data?.requests || []

      setPlans(loadedPlans)
      setRequests(loadedRequests)
      if (!selectedPlanId && loadedPlans.length > 0) {
        setSelectedPlanId(String(loadedPlans[0].id))
      }
    } catch (err) {
      console.error("Không thể tải dữ liệu nâng cấp đại lý", err)
      setError(err.response?.data?.error || "Không thể tải dữ liệu nâng cấp đại lý")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role !== "admin") {
      loadData()
    }
  }, [user?.role])

  const approvedRequest = requests.find((r) => r.status === "approved" && r.expires_at)

  const openRequest = requests.find((r) => ["pending_payment", "pending_review"].includes(r.status))

  const submitUpgradeRequest = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setMessage("")
      setError("")

      const res = await api.post("/dealer-upgrade/apply", {
        plan_id: Number(selectedPlanId),
        note,
      })

      setMessage("Đã tạo yêu cầu nâng cấp đại lý")
      setRequests((prev) => [res.data.request, ...prev])
      setNote("")
    } catch (err) {
      setError(err.response?.data?.error || "Không thể tạo yêu cầu nâng cấp")
    } finally {
      setSubmitting(false)
    }
  }

  const markPaid = async (requestId) => {
    try {
      setPayingRequestId(requestId)
      setMessage("")
      setError("")

      const res = await api.post(`/dealer-upgrade/${requestId}/mark-paid`)
      const updated = res.data.request

      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)))
      setMessage("Đã xác nhận thanh toán, vui lòng chờ admin duyệt")
    } catch (err) {
      setError(err.response?.data?.error || "Không thể xác nhận thanh toán")
    } finally {
      setPayingRequestId(null)
    }
  }

  const refreshMyProfile = async () => {
    try {
      const meRes = await api.get("/auth/me")
      const me = meRes.data
      onRoleUpdated(me)
      if (me.role === "dealer") {
        setMessage("Tài khoản đã được nâng cấp lên Đại lý")
      }
    } catch (err) {
      console.error("Không thể tải lại hồ sơ", err)
    }
  }

  if (user?.role === "dealer") {
    let daysLeftText = ""
    let isExpiringSoon = false

    if (approvedRequest) {
      const expiresAt = new Date(approvedRequest.expires_at)
      const now = new Date()
      const diffMs = expiresAt - now
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        daysLeftText = `Còn ${diffDays} ngày`
        if (diffDays <= 3) isExpiringSoon = true
      } else {
        daysLeftText = `Đã hết hạn vào ${expiresAt.toLocaleDateString('vi-VN')}`
      }
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Gói Đại Lý Của Bạn</CardTitle>
          <CardDescription>Trạng thái và thời hạn sử dụng đặc quyền đại lý.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="font-semibold text-lg text-emerald-600 mb-1">Tài khoản Đại Lý Đang Hoạt Động</div>
            {loading ? (
               <p className="text-sm text-muted-foreground mt-2">Đang tải dữ liệu nâng cấp...</p>
            ) : approvedRequest ? (
              <div className="space-y-1 text-sm text-gray-700 mt-2">
                <p>Gói đã đăng ký: <span className="font-medium">{approvedRequest.plan_name}</span></p>
                <p>Ngày bắt đầu tính: <span className="font-medium">{new Date(approvedRequest.approved_at).toLocaleString('vi-VN')}</span></p>
                <p>Ngày kết thúc: <span className="font-medium">{new Date(approvedRequest.expires_at).toLocaleString('vi-VN')}</span></p>
                <div className={`mt-3 p-3 rounded-md font-medium max-w-lg ${isExpiringSoon ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {isExpiringSoon ? `⏳ Sắp hết hạn! (${daysLeftText}). Hãy sẵn sàng gia hạn sau khi gói kết thúc.` : `✅ Đang trong thời gian hiệu lực (${daysLeftText}).`}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Không tìm thấy thông tin gói chi tiết. (Có thể bạn được nâng cấp đặc cách bởi Admin)</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (user?.role === "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nâng cấp đại lý</CardTitle>
          <CardDescription>Tài khoản quản trị không áp dụng nâng cấp đại lý.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nâng cấp lên Đại lý</CardTitle>
        <CardDescription>
          Mặc định tài khoản mới là Nông dân. Bạn có thể chọn gói, gửi yêu cầu, thanh toán và chờ admin duyệt.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Đang tải dữ liệu nâng cấp...</p> : null}

        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!openRequest ? (
          <form onSubmit={submitUpgradeRequest} className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Chọn gói đại lý</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - {Number(plan.price_vnd || 0).toLocaleString()} đ / {plan.duration_days} ngày
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Ghi chú (tuỳ chọn)</label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Cần nâng cấp để đăng sản phẩm thường xuyên"
              />
            </div>

            <Button type="submit" disabled={submitting || !selectedPlanId}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu nâng cấp"}
            </Button>
          </form>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Bạn đang có yêu cầu đang xử lý</p>
            <p className="mt-1">
              Trạng thái: <span className="font-medium">{openRequest.status}</span> | Thanh toán: <span className="font-medium">{openRequest.payment_status}</span>
            </p>
            <p className="mt-1">
              Gói: {openRequest.plan_name} ({Number(openRequest.price_vnd || 0).toLocaleString()} đ)
            </p>

            {openRequest.status === "pending_payment" ? (
              <Button
                className="mt-3"
                onClick={() => markPaid(openRequest.id)}
                disabled={payingRequestId === openRequest.id}
              >
                {payingRequestId === openRequest.id ? "Đang xác nhận..." : "Tôi đã thanh toán"}
              </Button>
            ) : null}
          </div>
        )}

        {requests.length > 0 ? (
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">Lịch sử yêu cầu</h4>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                Làm mới
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              {requests.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-md bg-muted p-2">
                  <p>
                    <span className="font-medium">#{r.id}</span> - {r.plan_name}
                  </p>
                  <p className="text-muted-foreground">
                    {r.status} | {r.payment_status} | {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Button variant="ghost" size="sm" onClick={refreshMyProfile}>
          Kiểm tra trạng thái tài khoản
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Profile() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!user) {
      setError("Chưa đăng nhập!")
      return
    }

    try {
      setSaving(true)
      setMessage("")
      setError("")

      const res = await api.put("/users/me", { //
        name,
        avatar_url: avatarUrl,
      })

      setUser(res.data)
      setMessage("Cập nhật hồ sơ thành công!")
    } catch (err) {
      console.error("❌ Lỗi cập nhật:", err)
      setError(err.response?.data?.error || "Lỗi không xác định khi cập nhật.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Hồ sơ cá nhân</h1>

        <div className="bg-card rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {user?.email}
              </h2>
              <p className="text-sm text-muted-foreground">
                {user?.role === "admin"
                  ? "Quản trị viên"
                  : user?.role === "dealer"
                  ? "Đại lý"
                  : "Nông dân"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tên hiển thị
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Avatar URL
            </label>
            <Input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>

        <div className="mt-8">
          <DealerUpgradeCard
            user={user}
            onRoleUpdated={(me) => {
              setUser(me)
              localStorage.setItem("user", JSON.stringify(me))
            }}
          />
        </div>

        <div className="mt-8">
          <CostManager />
        </div>
        
      </div>
    </div>
  )
}