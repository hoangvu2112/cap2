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
                {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}
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
          <CostManager />
        </div>
        
      </div>
    </div>
  )
}