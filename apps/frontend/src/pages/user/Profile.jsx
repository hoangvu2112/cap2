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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Check,
  CheckCircle,
  ArrowRight,
  Clock,
  History
} from "lucide-react"


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
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState([])
  const [requests, setRequests] = useState([])
  const [openRequest, setOpenRequest] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  // Form Data Step 1 - Tự động load từ localStorage nếu có
  const [businessData, setBusinessData] = useState(() => {
    const saved = localStorage.getItem("dealer_upgrade_draft")
    return saved ? JSON.parse(saved) : {
      business_name: "",
      tax_code: "",
      business_address: "",
      representative_name: "",
      phone_contact: "",
      business_items: ""
    }
  })

  // Lưu nháp mỗi khi businessData thay đổi
  useEffect(() => {
    localStorage.setItem("dealer_upgrade_draft", JSON.stringify(businessData))
  }, [businessData])

  // Data Step 2
  const [selectedPlanId, setSelectedPlanId] = useState("")

  useEffect(() => {
    if (user && user.role !== "admin") {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      // Lấy danh sách gói
      try {
        const resPlans = await api.get("/dealer-upgrade/plans")
        const loadedPlans = resPlans.data.plans || []
        setPlans(loadedPlans)
        if (loadedPlans.length > 0 && !selectedPlanId) {
          setSelectedPlanId(loadedPlans[0].id)
        }
      } catch (err) {
        console.error("Lỗi tải danh sách gói:", err)
      }

      // Lấy yêu cầu của tôi
      try {
        const resMe = await api.get("/dealer-upgrade/me")
        const loadedRequests = resMe.data.requests || []
        setRequests(loadedRequests)
        const open = loadedRequests.find(r => ["pending_payment", "pending_review"].includes(r.status))
        setOpenRequest(open || null)
      } catch (err) {
        console.error("Lỗi tải lịch sử yêu cầu:", err)
      }
    } finally {
      setLoading(false)
    }
  }

  const validateStep1 = () => {
    if (!businessData.business_name.trim()) return "Vui lòng nhập tên cơ sở kinh doanh"
    if (!businessData.tax_code.trim()) return "Vui lòng nhập mã số thuế/GPKD"
    if (!businessData.business_address.trim()) return "Vui lòng nhập địa chỉ trụ sở"
    if (!businessData.representative_name.trim()) return "Vui lòng nhập người đại diện"
    if (!/^\d{10,11}$/.test(businessData.phone_contact)) return "Số điện thoại không hợp lệ (10-11 số)"
    return null
  }

  const handleNextStep1 = () => {
    const err = validateStep1()
    if (err) {
      setError(err)
      return
    }
    setError("")
    setStep(2)
  }

  const submitUpgradeRequest = async () => {
    if (!selectedPlanId) return setError("Vui lòng chọn một gói cước")
    try {
      setSubmitting(true)
      setError("")
      const res = await api.post("/dealer-upgrade/apply", {
        plan_id: selectedPlanId,
        ...businessData
      })

      // Nếu Backend trả về checkoutUrl (PayOS), chuyển hướng người dùng
      if (res.data.request.checkoutUrl) {
        window.location.href = res.data.request.checkoutUrl
        return
      }

      localStorage.removeItem("dealer_upgrade_draft") // Xóa bản nháp sau khi thành công
      setOpenRequest(res.data.request)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || "Không thể gửi yêu cầu")
    } finally {
      setSubmitting(false)
    }
  }

  // Xử lý các tham số trả về từ PayOS (status=success/cancel)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const status = urlParams.get("status")
    const id = urlParams.get("id")

    if (status === "success") {
      setMessage("Thanh toán thành công! Tài khoản của bạn đang được nâng cấp.")
      // Xóa query params để không hiện lại message khi F5
      window.history.replaceState({}, document.title, window.location.pathname)
      // Tải lại dữ liệu sau 1.5s để cập nhật role mới
      setTimeout(() => {
        loadData()
        refreshMyProfile()
      }, 1500)
    } else if (status === "cancel") {
      setError("Bạn đã hủy thanh toán. Bạn có thể thử lại bất cứ lúc nào.")
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const markPaid = async (id) => {
    try {
      setSubmitting(true)
      const res = await api.post(`/dealer-upgrade/${id}/mark-paid`)
      setOpenRequest(res.data.request)
      alert("Đã gửi xác nhận thanh toán. Vui lòng chờ Admin duyệt hồ sơ.")
      loadData()
    } catch (err) {
      alert(err.response?.data?.error || "Lỗi xác nhận thanh toán")
    } finally {
      setSubmitting(false)
    }
  }

  const cancelRequest = async (id) => {
    if (!confirm("Bạn có muốn hủy yêu cầu này để nhập lại thông tin hoặc chọn gói khác không?")) return
    try {
      setSubmitting(true)
      await api.delete(`/dealer-upgrade/${id}`)
      setOpenRequest(null)
      setStep(1)
      loadData()
    } catch (err) {
      alert(err.response?.data?.error || "Không thể hủy yêu cầu")
    } finally {
      setSubmitting(false)
    }
  }

  const [refreshing, setRefreshing] = useState(false)
  const refreshMyProfile = async () => {
    try {
      setRefreshing(true)
      // Đợi 1 chút để tạo cảm giác thực tế và đợi Backend
      await new Promise(resolve => setTimeout(resolve, 800))
      const res = await api.get("/users/me")

      // Tải lại cả lịch sử yêu cầu để đồng bộ UI card
      await loadData()

      if (onRoleUpdated) {
        onRoleUpdated(res.data)
      }
      setMessage("Dữ liệu tài khoản đã được làm mới!")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Lỗi khi làm mới profile:", err)
    } finally {
      setRefreshing(false)
    }
  }

  if (user?.role === "admin") return null

  // Tìm yêu cầu đã được duyệt hoặc đang chờ xử lý
  const activeReq = requests.find(r => r.status === "approved" && new Date(r.expires_at) > new Date())
  // Loại trừ trường hợp role bị revoke: chỉ hiển thị giao diện đại lý nếu role thực sự là 'dealer'

  // Nếu đã là đại lý VÀ có yêu cầu đã duyệt còn hạn (không bị revoke)
  if (user?.role === "dealer" && activeReq) {
    localStorage.removeItem("dealer_upgrade_draft") // Xóa bản nháp khi đã là đại lý
    const displayReq = activeReq || requests.find(r => r.status === "approved")
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 rounded-3xl overflow-hidden shadow-lg">
        <CardHeader className="bg-emerald-600 text-white p-6">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6" /> Bạn là Đại lý chuyên nghiệp
          </CardTitle>
          <CardDescription className="text-emerald-50">Tài khoản của bạn đã được kích hoạt đầy đủ tính năng giao dịch.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Thông tin gói hiện tại</p>
              <h4 className="text-xl font-black text-emerald-700 mt-1">{displayReq?.plan_name || "Gói Đại lý"}</h4>
              {displayReq?.expires_at && (
                <div className="flex flex-col gap-1 mt-2">
                  <p className="text-sm font-medium text-gray-600">
                    Ngày hết hạn: <span className="text-emerald-600 font-bold">{new Date(displayReq.expires_at).toLocaleDateString("vi-VN")}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-600">
                    Thời gian còn lại: <span className="text-emerald-600 font-bold">
                      {Math.max(0, Math.ceil((new Date(displayReq.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))} ngày
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl font-bold h-11" onClick={refreshMyProfile} disabled={refreshing}>
                {refreshing ? "Đang làm mới..." : "Làm mới trạng thái"}
              </Button>
              <Button className="flex-1 rounded-xl font-bold h-11 bg-emerald-600" onClick={() => window.location.href = '/manage-products'}>
                Quản lý hàng hóa
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Nếu đang có yêu cầu đang xử lý (chờ thanh toán hoặc chờ duyệt)
  if (openRequest) {
    const selectedPlan = plans.find(p => p.id === openRequest.plan_id) || { price_vnd: openRequest.price_vnd, name: openRequest.plan_name }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu nâng cấp Đại lý</CardTitle>
          <CardDescription>Bạn có một yêu cầu đang được xử lý.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-amber-800 text-lg">{selectedPlan.name}</h4>
                <p className="text-sm text-amber-700 font-medium">Trạng thái:
                  <span className="ml-2 px-2 py-0.5 bg-amber-200 rounded-full text-[11px] font-bold uppercase">
                    {openRequest.status === "pending_payment" ? "Chờ thanh toán" : "Đang chờ duyệt"}
                  </span>
                </p>
              </div>
              <span className="text-xl font-black text-amber-900">{Number(selectedPlan.price_vnd).toLocaleString()}đ</span>
            </div>

            {openRequest.status === "pending_payment" && (
              <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                {/* MoMo Test QR */}
                <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-rose-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#ae2070] flex items-center justify-center text-white font-black text-sm">M</div>
                    <p className="text-sm font-bold text-gray-700">Quét mã MoMo để thanh toán</p>
                  </div>

                  {openRequest.payment_qr ? (
                    // Hiển thị ảnh QR tĩnh (không click được)
                    <img
                      src={openRequest.payment_qr}
                      alt="MoMo QR"
                      className="w-56 h-56 object-contain rounded-2xl shadow-lg border-4 border-white ring-2 ring-[#ae2070]/20 opacity-90"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : openRequest.payment_ref && String(openRequest.payment_ref).startsWith("http") ? (
                    // Hiển thị QR static tạo từ link
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(openRequest.payment_ref)}&size=220x220&bgcolor=ffffff&margin=12&color=ae2070`}
                      alt="MoMo QR Test"
                      className="w-56 h-56 object-contain rounded-2xl shadow-lg border-4 border-white ring-2 ring-[#ae2070]/20 opacity-90"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : (
                    <div className="w-56 h-56 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                      Không có link thanh toán
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    <p className="text-sm font-black text-[#ae2070]">{Number(selectedPlan.price_vnd).toLocaleString()} đ</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Nút mở MoMo trực tiếp */}
                  {openRequest.payment_ref && openRequest.payment_ref.startsWith("http") && (
                    <Button
                      className="w-full h-12 rounded-2xl font-black text-base shadow-xl bg-[#ae2070] hover:bg-[#9a1c63] text-white flex items-center justify-center gap-2 transition-colors"
                      onClick={async () => {
                        try {
                          setSubmitting(true)
                          // Gọi endpoint simulate-success để thay cho việc quét QR
                          await api.post(`/dealer-upgrade/simulate-success/${openRequest.id}`)
                          // Sau khi giả lập thành công, đăng xuất ngay và yêu cầu người dùng đăng nhập lại
                            // (Xóa token & user trên client để đảm bảo tải role mới khi đăng nhập lại)
                            localStorage.removeItem('token')
                            localStorage.removeItem('user')
                            // Thông báo ngắn rồi chuyển sang trang đăng nhập
                            alert('Thanh toán thành công — bạn sẽ được đăng xuất để đăng nhập lại và kích hoạt vai trò Đại lý.')
                            window.location.replace('/login')
                        } catch (err) {
                          setError(err.response?.data?.error || 'Không thể xác nhận thanh toán')
                        } finally {
                          setSubmitting(false)
                        }
                      }}
                      disabled={submitting}
                    >
                      <span className="text-lg font-black">M</span> Xác nhận thanh toán
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-2xl font-bold text-gray-600"
                    onClick={() => cancelRequest(openRequest.id)}
                    disabled={submitting}
                  >
                    Hủy yêu cầu &amp; Chọn lại
                  </Button>
                </div>
              </div>
            )}

            {openRequest.status === "pending_review" && (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="text-sm text-blue-800 font-medium">Hệ thống đã ghi nhận thanh toán. Admin sẽ kiểm tra hồ sơ pháp lý và duyệt tài khoản cho bạn trong vòng 24h.</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h4 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
              <History className="w-4 h-4" /> Lịch sử yêu cầu
            </h4>
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="flex justify-between items-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{r.plan_name}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{new Date(r.created_at).toLocaleString("vi-VN")}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                    r.status === "rejected" ? "bg-red-100 text-red-700" :
                      r.status === "revoked" ? "bg-orange-100 text-orange-700" : "bg-gray-200 text-gray-600"
                    }`}>
                    {r.status === "revoked" ? "Đã hủy vai trò" : r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl shadow-2xl border-none ring-1 ring-gray-200 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-8">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-black">Nâng cấp Đại lý</CardTitle>
            <CardDescription className="text-emerald-50 font-medium">Hoàn thành 3 bước để trở thành đại lý chuyên nghiệp</CardDescription>
          </div>
          <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 font-black">
            Bước {step}/3
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">1</div>
              <h3 className="font-black text-lg text-gray-800 uppercase tracking-tight">Hồ sơ pháp lý đại lý</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Tên cơ sở kinh doanh *</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Ví dụ: Đại lý Nông sản Hùng Mạnh"
                  value={businessData.business_name}
                  onChange={e => setBusinessData({ ...businessData, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Mã số thuế / Số GPKD *</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Số giấy phép hoặc MST"
                  value={businessData.tax_code}
                  onChange={e => setBusinessData({ ...businessData, tax_code: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Địa chỉ trụ sở *</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Số nhà, đường, xã/phường, quận/huyện, tỉnh thành"
                  value={businessData.business_address}
                  onChange={e => setBusinessData({ ...businessData, business_address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Người đại diện pháp luật *</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Họ và tên người đứng tên"
                  value={businessData.representative_name}
                  onChange={e => setBusinessData({ ...businessData, representative_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Số điện thoại liên hệ *</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Số điện thoại di động"
                  value={businessData.phone_contact}
                  onChange={e => setBusinessData({ ...businessData, phone_contact: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="ml-3 font-bold text-gray-600">Mặt hàng kinh doanh chính</Label>
                <Input
                  className="h-12 rounded-2xl bg-gray-50 border-gray-700 placeholder:text-gray-400 font-semibold"
                  placeholder="Ví dụ: Cà phê, hồ tiêu, sầu riêng..."
                  value={businessData.business_items}
                  onChange={e => setBusinessData({ ...businessData, business_items: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="text-sm font-bold text-red-500 ml-3">⚠️ {error}</p>}

            <Button className="w-full h-12 rounded-2xl font-black text-lg shadow-xl" onClick={handleNextStep1}>
              Tiếp theo <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">2</div>
              <h3 className="font-black text-lg text-gray-800 uppercase tracking-tight">Chọn gói thành viên</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading && plans.length === 0 && <p className="text-center py-10 text-gray-500 font-medium animate-pulse">Đang tải danh sách gói...</p>}
              {!loading && plans.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500 font-bold">Hiện không có gói nâng cấp nào khả dụng.</p>
                  <Button variant="link" onClick={loadData} className="mt-2 text-emerald-600 font-bold">Thử tải lại</Button>
                </div>
              )}
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "relative flex items-center justify-between p-6 rounded-3xl border-2 transition-all text-left",
                    selectedPlanId === plan.id
                      ? "border-emerald-500 bg-emerald-50 shadow-md ring-4 ring-emerald-50"
                      : "border-gray-100 bg-gray-50 hover:border-emerald-200"
                  )}
                >
                  <div>
                    <p className="font-black text-lg text-gray-900">{plan.name}</p>
                    <p className="text-sm font-bold text-gray-500">Thời hạn: {plan.duration_days} ngày</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600">{Number(plan.price_vnd).toLocaleString()}đ</p>
                    {plan.duration_days > 30 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-black rounded-full">TIẾT KIỆM</span>
                    )}
                  </div>
                  {selectedPlanId === plan.id && (
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="h-12 rounded-2xl flex-1 font-bold" onClick={() => setStep(1)}>
                Quay lại
              </Button>
              <Button className="h-12 rounded-2xl flex-[2] font-black text-lg shadow-xl" onClick={submitUpgradeRequest} disabled={submitting}>
                {submitting ? "Đang tạo yêu cầu..." : "Xác nhận & Thanh toán"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const VIETNAM_PROVINCES = [
  // Bắc Bộ (15)
  "Hà Nội", "Hải Phòng", "Ninh Bình", "Hưng Yên", "Bắc Ninh",
  "Quảng Ninh", "Thái Nguyên", "Phú Thọ", "Lào Cai", "Tuyên Quang",
  "Lạng Sơn", "Điện Biên", "Lai Châu", "Sơn La", "Cao Bằng",
  // Trung Bộ (11)
  "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Trị", "Huế",
  "Đà Nẵng", "Quảng Ngãi", "Bình Định", "Gia Lai", "Khánh Hòa",
  "Lâm Đồng",
  // Nam Bộ (8)
  "Hồ Chí Minh", "Đồng Nai", "Tây Ninh", "Cần Thơ", "Đồng Tháp",
  "An Giang", "Vĩnh Long", "Cà Mau",
];

export default function Profile() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "")
  const [region, setRegion] = useState(user?.region || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setAvatarUrl(user.avatar_url || "")
      setRegion(user.region || "")
    }
  }, [user])

  const handleSave = async () => {
    if (!user) {
      setError("Chưa đăng nhập!")
      return
    }

    try {
      setSaving(true)
      setMessage("")
      setError("")

      const res = await api.put("/users/me", {
        name,
        avatar_url: avatarUrl,
        region,
      })

      setUser(res.data)
      localStorage.setItem("user", JSON.stringify(res.data))
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
              Vị trí (Khu vực của bạn)
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Chọn tỉnh thành</option>
              {VIETNAM_PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
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