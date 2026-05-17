"use client"

import { useState, useEffect, useRef } from "react"
import Navbar from "../../components/Navbar"
import { useAuth } from "../../context/AuthContext"
import { User, X, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react"
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


function PaymentAlert({ type = 'error', title, message, onClose, autoCloseMs }) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (autoCloseMs && onClose) {
      timerRef.current = setTimeout(onClose, autoCloseMs)
    }
    return () => clearTimeout(timerRef.current)
  }, [autoCloseMs, onClose])

  const styles = {
    success: {
      wrapper: 'bg-emerald-50 border-emerald-300 shadow-emerald-100',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />,
      title: 'text-emerald-800',
      message: 'text-emerald-700',
      close: 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100',
      bar: 'bg-emerald-500',
    },
    error: {
      wrapper: 'bg-red-50 border-red-300 shadow-red-100',
      icon: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />,
      title: 'text-red-800',
      message: 'text-red-700',
      close: 'text-red-400 hover:text-red-600 hover:bg-red-100',
      bar: 'bg-red-500',
    },
    warning: {
      wrapper: 'bg-amber-50 border-amber-300 shadow-amber-100',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />,
      title: 'text-amber-800',
      message: 'text-amber-700',
      close: 'text-amber-400 hover:text-amber-600 hover:bg-amber-100',
      bar: 'bg-amber-500',
    },
  }

  const s = styles[type] || styles.error

  return (
    <div
      className={cn(
        'relative flex gap-3 rounded-2xl border-2 px-5 py-4 shadow-md text-left animate-in fade-in slide-in-from-top-2 duration-300',
        s.wrapper
      )}
    >
      {/* Thanh màu bên trái */}
      <div className={cn('absolute left-0 top-0 h-full w-1.5 rounded-l-2xl', s.bar)} />

      {/* Icon */}
      {s.icon}

      {/* Nội dung */}
      <div className="flex-1 min-w-0 pl-1">
        {title && <p className={cn('font-black text-sm leading-snug mb-0.5', s.title)}>{title}</p>}
        <p className={cn('text-sm font-medium leading-relaxed whitespace-pre-line', s.message)}>{message}</p>
      </div>

      {/* Nút đóng */}
      {onClose && (
        <button
          onClick={onClose}
          className={cn('flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors mt-0.5', s.close)}
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}


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

  // Overlay thông báo thanh toán thành công (luôn render trên cùng)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentError, setPaymentError] = useState("")

  // Toast in-page: { title, message } | null
  const [toast, setToast] = useState(null)
  // 'success' | 'error' | 'warning'
  const [toastType, setToastType] = useState('error')

  const showToast = (type, title, message, autoCloseMs) => {
    setToastType(type)
    setToast({ title, message, autoCloseMs })
  }
  const closeToast = () => setToast(null)

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

  // Danh mục thu mua (multi-select)
  const [availableCategories, setAvailableCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => {
    const saved = localStorage.getItem("dealer_upgrade_categories")
    return saved ? JSON.parse(saved) : []
  })

  // Lưu nháp mỗi khi businessData thay đổi
  useEffect(() => {
    localStorage.setItem("dealer_upgrade_draft", JSON.stringify(businessData))
  }, [businessData])

  // Lưu nháp danh mục thu mua
  useEffect(() => {
    localStorage.setItem("dealer_upgrade_categories", JSON.stringify(selectedCategoryIds))
  }, [selectedCategoryIds])

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

      // Lấy danh sách categories cho multi-select
      try {
        const resCats = await api.get("/products/categories")
        setAvailableCategories(resCats.data || [])
      } catch (err) {
        console.error("Lỗi tải danh mục:", err)
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
    if (selectedCategoryIds.length === 0) return "Vui lòng chọn ít nhất 1 danh mục nông sản thu mua"
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
        ...businessData,
        category_ids: selectedCategoryIds
      })

      // Nếu Backend trả về checkoutUrl (PayOS), chuyển hướng người dùng
      if (res.data.request.checkoutUrl) {
        window.location.href = res.data.request.checkoutUrl
        return
      }

      localStorage.removeItem("dealer_upgrade_draft") // Xóa bản nháp sau khi thành công
      localStorage.removeItem("dealer_upgrade_categories")
      setOpenRequest(res.data.request)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || "Không thể gửi yêu cầu")
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // Xử lý kết quả redirect từ MoMo / PayOS
  // MoMo luôn redirect về cùng 1 URL (redirectUrl hoặc cancelUrl)
  // và append các param: resultCode, orderId, message, ...
  // resultCode=0 → thành công | resultCode!=0 → hủy / thất bại
  // ============================================================
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const momoReturn = urlParams.get("momo-return")   // marker URL generic của MoMo
    const status = urlParams.get("status")             // PayOS dùng status=success/cancel
    const id = urlParams.get("id")
    const resultCode = urlParams.get("resultCode")     // MoMo append vào URL (0=OK, khác=lỗi)
    const simulate = urlParams.get("simulate")         // simulate=true khi PAYMENT_SIMULATE=true

    // Không có params thanh toán → bỏ qua
    if (!momoReturn && !status) return

    // Xóa query params ngay để không trigger lại khi F5
    window.history.replaceState({}, document.title, window.location.pathname)

    const handlePaymentReturn = async () => {
      // ── Xử lý MoMo return (momo-return=1) ──
      if (momoReturn === "1" && id) {
        const isSuccess = resultCode === "0"

        if (isSuccess) {
          // Gọi API confirm để update role (vì webhook MoMo không gọi được localhost)
          try {
            await api.post(`/dealer-upgrade/confirm-local-test/${id}`)
          } catch (err) {
            console.warn("[MoMo Confirm] Error:", err?.response?.data?.error || err?.message)
          }

          setPaymentSuccess(true)
          setTimeout(() => {
            localStorage.removeItem("token")
            localStorage.removeItem("user")
            localStorage.removeItem("dealer_upgrade_draft")
            localStorage.removeItem("dealer_upgrade_categories")
            window.location.replace("/login")
          }, 4000)

        } else {
          // ❌ HỦY / THẤT BẠI
          try {
            await api.delete(`/dealer-upgrade/momo/cancel-return/${id}`)
          } catch (err) {
            console.warn("[MoMo Cancel] Delete request:", err?.response?.data?.error || err?.message)
          }
          setOpenRequest(null)
          setStep(2)
          await loadData()
          const msg = resultCode === "1006"
            ? "Bạn đã hủy thanh toán. Vui lòng chọn gói và thử lại."
            : `Giao dịch không thành công (mã ${resultCode || "N/A"}). Vui lòng thử lại.`
          setPaymentError(msg)
        }

      // ── Xử lý PayOS / Simulate return (status=success/cancel) ──
      } else if (status === "success" && id) {
        // Gọi API để update role trong DB
        try {
          if (simulate === "true") {
            await api.post(`/dealer-upgrade/simulate-success/${id}`)
          } else {
            await api.post(`/dealer-upgrade/confirm-local-test/${id}`)
          }
        } catch (err) {
          console.warn("[Payment Confirm] Error:", err?.response?.data?.error || err?.message)
        }

        setPaymentSuccess(true)
        setTimeout(() => {
          localStorage.removeItem("token")
          localStorage.removeItem("user")
          localStorage.removeItem("dealer_upgrade_draft")
          localStorage.removeItem("dealer_upgrade_categories")
          window.location.replace("/login")
        }, 4000)

      } else if (status === "cancel" && id) {
        try {
          await api.delete(`/dealer-upgrade/momo/cancel-return/${id}`)
        } catch (err) {
          console.warn("[Cancel] Delete request:", err?.response?.data?.error || err?.message)
        }
        setOpenRequest(null)
        setStep(2)
        await loadData()
        setPaymentError("Bạn đã hủy thanh toán. Vui lòng chọn gói và thử lại.")
      }
    }

    handlePaymentReturn()
  }, [])



  const markPaid = async (id) => {
    try {
      setSubmitting(true)
      const res = await api.post(`/dealer-upgrade/${id}/mark-paid`)
      setOpenRequest(res.data.request)
      showToast('warning', 'Xác nhận thanh toán', 'Đã gửi xác nhận thanh toán. Vui lòng chờ Admin duyệt hồ sơ.')
      loadData()
    } catch (err) {
      showToast('error', 'Lỗi', err.response?.data?.error || 'Lỗi xác nhận thanh toán')
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
      showToast('error', 'Lỗi', err.response?.data?.error || 'Không thể hủy yêu cầu')
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

  // ===== OVERLAY THÔNG BÁO THANH TOÁN (luôn render trên cùng) =====
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl animate-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">🎉 Thanh toán thành công!</h2>
          <p className="text-gray-600 mb-4">
            Tài khoản của bạn đã được nâng cấp lên <span className="font-bold text-emerald-600">Đại lý</span>.
          </p>
          <p className="text-sm text-gray-500">
            Bạn sẽ được đăng xuất sau vài giây — vui lòng đăng nhập lại để kích hoạt quyền Đại lý.
          </p>
          <div className="mt-4">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-[shrink_4s_linear_forwards]" style={{ width: '100%', animation: 'shrink 4s linear forwards' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (paymentError) {
    return (
      <Card className="border-red-200 bg-red-50/30 rounded-3xl overflow-hidden">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Thanh toán không thành công</h3>
          <p className="text-sm text-red-600 mb-4">{paymentError}</p>
          <Button onClick={() => setPaymentError("")} variant="outline" className="rounded-xl">
            Thử lại
          </Button>
        </CardContent>
      </Card>
    )
  }

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
                <Label className="ml-3 font-bold text-gray-600">Danh mục nông sản thu mua *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  {availableCategories.length === 0 ? (
                    <p className="text-sm text-gray-400 col-span-full">Đang tải danh mục...</p>
                  ) : (
                    availableCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                          selectedCategoryIds.includes(cat.id)
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-white border-gray-100 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategoryIds(prev => [...prev, cat.id])
                            } else {
                              setSelectedCategoryIds(prev => prev.filter(id => id !== cat.id))
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-semibold">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {selectedCategoryIds.length > 0 && (
                  <p className="text-xs text-emerald-600 font-medium ml-3">
                    Đã chọn {selectedCategoryIds.length} danh mục
                  </p>
                )}
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
  // 6 Thành phố trực thuộc Trung ương
  "Hà Nội", "Hồ Chí Minh", "Hải Phòng", "Đà Nẵng", "Cần Thơ", "Huế",
  // Miền Bắc (12 tỉnh)
  "Quảng Ninh", "Cao Bằng", "Lạng Sơn", "Lai Châu", "Điện Biên", "Sơn La",
  "Tuyên Quang", "Lào Cai", "Thái Nguyên", "Phú Thọ", "Bắc Ninh", "Hưng Yên",
  // Miền Trung & Tây Nguyên (8 tỉnh)
  "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Ninh Bình", "Quảng Trị",
  "Quảng Ngãi", "Gia Lai", "Khánh Hòa",
  // Nam Trung Bộ & Nam Bộ (8 tỉnh)
  "Lâm Đồng", "Đắk Lắk", "Đồng Nai", "Tây Ninh",
  "Vĩnh Long", "Đồng Tháp", "An Giang", "Cà Mau",
];

export default function Profile() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [region, setRegion] = useState(user?.region || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setRegion(user.region || "")
    }
  }, [user])

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingAvatar(true)
      setError("")
      const formData = new FormData()
      formData.append("avatar", file)

      const res = await api.post("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })

      setUser(res.data)
      localStorage.setItem("user", JSON.stringify(res.data))
      setMessage("Cập nhật ảnh đại diện thành công!")
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi khi upload ảnh")
    } finally {
      setUploadingAvatar(false)
      e.target.value = ""
    }
  }

  const handleSave = async () => {
    if (!user) {
      setError("Chưa đăng nhập!")
      return
    }

    try {
      setSaving(true)
      setMessage("")
      setError("")

      const res = await api.put("/users/me", { name, region })

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

  // Tính toán trạng thái đổi tên
  const getNameChangeInfo = () => {
    if (!user?.name_changed_at) return { canChange: true, remaining: 3 }
    const lastChanged = new Date(user.name_changed_at)
    const now = new Date()
    const diffMs = now - lastChanged
    const diffMinutes = diffMs / (1000 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    const count = user.name_change_count || 0

    if (diffDays >= 30) return { canChange: true, remaining: 3 }
    if (diffMinutes <= 15 && count < 3) return { canChange: true, remaining: 3 - count }
    if (diffMinutes > 15) {
      const unlockDate = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000)
      return { canChange: false, remaining: 0, unlockDate }
    }
    return { canChange: false, remaining: 0 }
  }

  const nameInfo = getNameChangeInfo()

  const avatarSrc = user?.avatar_url
    ? (user.avatar_url.startsWith("http") ? user.avatar_url : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000"}${user.avatar_url}`)
    : null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">Hồ sơ cá nhân</h1>

        <div className="bg-card rounded-xl shadow-sm p-6 space-y-6">
          {/* Avatar - click để upload */}
          <div className="flex items-center gap-4">
            <div
              className="relative cursor-pointer group"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors border-2 border-dashed border-border group-hover:border-primary">
                  <User className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold">Đổi ảnh</span>
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />

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
              <p className="text-xs text-muted-foreground mt-0.5">Nhấn vào ảnh để thay đổi</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tên hiển thị
              {nameInfo.canChange ? (
                <span className="text-xs text-muted-foreground ml-2">(Còn {nameInfo.remaining} lượt đổi trong 15 phút)</span>
              ) : (
                <span className="text-xs text-red-500 ml-2">
                  (Đã khóa — mở lại {nameInfo.unlockDate?.toLocaleDateString("vi-VN") || "sau 30 ngày"})
                </span>
              )}
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!nameInfo.canChange}
              className={!nameInfo.canChange ? "opacity-60 cursor-not-allowed" : ""}
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

          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleSave} disabled={saving || (!nameInfo.canChange && name !== user?.name)}>
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