import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Navbar from "@/components/Navbar" //
import Footer from "@/components/Footer" //
import api from "@/lib/api" //
import { useAuth } from "@/context/AuthContext" //
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card" //
import { Button } from "@/components/ui/button" //
import { Input } from "@/components/ui/input" //
import { Label } from "@/components/ui/label" //
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog" //
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select" //
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
  BarChart,
  ArrowUp,
  ArrowDown,
  Landmark,
  Newspaper,
  Bot, // <-- 1. THÊM ICON MỚI
} from "lucide-react"
import {
  ComposedChart,
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts" //
import { cn } from "@/lib/utils" // <-- 2. THÊM CN (ĐỂ ĐỔI MÀU)

// ===========================================
// --- 🚀 COMPONENT MỚI: THẺ PHÂN TÍCH AI ---
// ===========================================
function AnalysisCard({ analysis }) {
  // Nếu không có phân tích (hoặc rỗng), không hiển thị gì cả
  if (!analysis || !analysis.summary) return null;

  // Xác định màu dựa trên tâm lý
  const sentimentColor =
    analysis.sentiment.includes("Tích cực") ? "text-green-700"
      : analysis.sentiment.includes("Tiêu cực") ? "text-red-700"
        : "text-gray-700";

  const sentimentBgColor =
    analysis.sentiment.includes("Tích cực") ? "bg-green-100/80 border-green-200"
      : analysis.sentiment.includes("Tiêu cực") ? "bg-red-100/80 border-red-200"
        : "bg-gray-100/80 border-gray-200";

  return (
    <Card className={cn("shadow-md", sentimentBgColor)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
          <Bot className="w-5 h-5" />
          Trợ lý Phân tích AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hiển thị văn bản (dùng dangerouslySetInnerHTML để nhận <b>) */}
        <p
          className="text-sm leading-relaxed text-gray-800"
          dangerouslySetInnerHTML={{ __html: analysis.summary }}
        />
        <div className="flex justify-between items-center pt-3 border-t">
          <span className="text-sm font-medium text-gray-900">Tâm lý thị trường:</span>
          <span className={cn("font-bold text-sm", sentimentColor)}>
            {analysis.sentiment}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}


// ===========================================
// --- COMPONENT CHÍNH (ĐÃ CẬP NHẬT) ---
// ===========================================
export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState("30d")

  // (State của Modal Cảnh báo - Giữ nguyên)
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false)
  const [alertCondition, setAlertCondition] = useState("above")
  const [alertPrice, setAlertPrice] = useState("")
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertError, setAlertError] = useState(null)

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        // API này (từ Bước 1) đã trả về 'product', 'history', 'statistics', 'relevantNews', và 'analysis'
        const res = await api.get(`/products/${id}`, {
          params: { range },
        })

        const formattedHistory = res.data.history.map(item => ({
          ...item,
          date: new Date(item.date).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          }),
          price: parseFloat(item.price),
          forecast: item.forecast ? parseFloat(item.forecast) : null,
        }));

        setProduct({
          ...res.data,
          history: formattedHistory,
        });

        setAlertPrice(Math.round(res.data.currentPrice / 1000) * 1000);

      } catch (err) {
        setError(err.response?.data?.error || "Không thể tải dữ liệu sản phẩm.")
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id, range])

  // (Các hàm xử lý Cảnh báo giá - Giữ nguyên)
  const handleSaveAlert = async () => {
    if (!user) {
      setAlertError("Bạn cần đăng nhập để tạo cảnh báo.");
      return;
    }
    setAlertSaving(true);
    setAlertError(null);
    try {
      await api.post("/alerts", { //
        product_id: id,
        target_price: Number(alertPrice),
        alert_condition: alertCondition,
        email: user.email
      });
      setAlertSaving(false);
      setIsAlertModalOpen(false);
      alert("Đã tạo cảnh báo thành công!");
    } catch (err) {
      console.error("Lỗi khi tạo cảnh báo:", err);
      setAlertError(err.response?.data?.error || "Lỗi khi lưu cảnh báo.");
      setAlertSaving(false);
    }
  };

  const handleAlertButtonClick = () => {
    if (!user) {
      alert("Bạn cần đăng nhập để sử dụng tính năng này.");
      navigate("/login"); //
    } else {
      setAlertError(null);
      // Đảm bảo product không null trước khi truy cập
      if (product) {
        setAlertPrice(Math.round(product.currentPrice / 1000) * 1000);
      }
      setAlertCondition("above");
      setIsAlertModalOpen(true);
    }
  };

  // (Phần JSX loading, error - Giữ nguyên)
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold">Lỗi</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }
  if (!product) return null // Quan trọng: Đảm bảo product có dữ liệu

  const trend = product.trend
  const currentPrice = product.currentPrice.toLocaleString("vi-VN")
  const previousPrice = product.previousPrice.toLocaleString("vi-VN")

  // (Component Biểu đồ - Giữ nguyên)
  const PriceChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
        <XAxis dataKey="date" />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(value) => value.toLocaleString("vi-VN")}
        />
        <Tooltip
          formatter={(value, name) => [
            `${value.toLocaleString("vi-VN")} đ`,
            name === "price" ? "Giá" : "Dự báo (SMA 7-ngày)",
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="price"
          name="Giá"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Dự báo (SMA 7-ngày)"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <div>
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Tiêu đề */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-lg text-muted-foreground">{product.category}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột chính (Biểu đồ) */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lịch sử giá</CardTitle>
                <div className="flex gap-1">
                  {["30d", "6m", "1y"].map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={range === r ? "default" : "outline"}
                      onClick={() => setRange(r)}
                    >
                      {r.replace("30d", "30 Ngày").replace("6m", "6 Tháng").replace("1y", "1 Năm")}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {product.history && product.history.length > 0 ? (
                  <PriceChart data={product.history} />
                ) : (
                  <div className="h-96 flex flex-col justify-center items-center text-muted-foreground">
                    <BarChart className="w-12 h-12" />
                    <p className="mt-2">Không đủ dữ liệu lịch sử cho phạm vi này.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cột phụ (Thông tin) */}
          <div className="lg:col-span-1 space-y-4">

            {/* =========================================== */}
            {/* --- 🚀 3. HIỂN THỊ THẺ PHÂN TÍCH AI --- */}
            {/* =========================================== */}
            <AnalysisCard analysis={product.analysis} />


            {/* Card thông tin giá */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin giá</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Giá hiện tại</p>
                    <p className="text-4xl font-bold text-green-600">
                      {currentPrice} <span className="text-lg font-normal text-muted-foreground">đ/{product.unit}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Giá trước đó</p>
                    <p className="text-2xl font-medium">{previousPrice} đ</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Xu hướng</p>
                    <div
                      className={`flex items-center text-lg font-semibold ${trend === "up"
                        ? "text-green-600"
                        : trend === "down"
                          ? "text-red-600"
                          : "text-gray-500"
                        }`}
                    >
                      {trend === "up" ? (
                        <TrendingUp className="mr-2 h-5 w-5" />
                      ) : trend === "down" ? (
                        <TrendingDown className="mr-2 h-5 w-5" />
                      ) : (
                        <Minus className="mr-2 h-5 w-5" />
                      )}
                      {trend === "up"
                        ? "Tăng"
                        : trend === "down"
                          ? "Giảm"
                          : "Ổn định"}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Khu vực</p>
                    <p className="text-lg font-medium">{product.region}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cập nhật lần cuối</p>
                    <p className="text-lg font-medium">
                      {new Date(product.lastUpdate).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card Thống kê 30 ngày */}
            {product.statistics && (
              <Card>
                <CardHeader>
                  <CardTitle>Thống kê 30 ngày</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <ArrowUp className="w-4 h-4 mr-2 text-green-500" />
                      Cao nhất
                    </span>
                    <span className="font-semibold text-green-600">
                      {product.statistics.high_30d.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <ArrowDown className="w-4 h-4 mr-2 text-red-500" />
                      Thấp nhất
                    </span>
                    <span className="font-semibold text-red-600">
                      {product.statistics.low_30d.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <Landmark className="w-4 h-4 mr-2 text-blue-500" />
                      Trung bình
                    </span>
                    <span className="font-semibold text-blue-600">
                      {Number(product.statistics.avg_30d).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} đ
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card Tin tức liên quan */}
            {product.relevantNews && product.relevantNews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    Tin tức liên quan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {product.relevantNews.map((news) => (
                    <a
                      key={news.id}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <h4 className="font-semibold text-sm leading-snug hover:underline">
                        {news.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {news.source} - {new Date(news.published_at).toLocaleDateString("vi-VN")}
                      </p>
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Card Tạo cảnh báo */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAlertButtonClick}
                >
                  🔔 Tạo cảnh báo giá
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL TẠO CẢNH BÁO (Giữ nguyên) */}
      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tạo cảnh báo cho {product.name}</DialogTitle>
            <DialogDescription>
              Bạn sẽ nhận được email khi giá đạt ngưỡng mong muốn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="condition" className="text-right">
                Điều kiện
              </Label>
              <Select
                id="condition"
                value={alertCondition}
                onValueChange={setAlertCondition}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Chọn điều kiện" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Giá VƯỢT QUÁ</SelectItem>
                  <SelectItem value="below">Giá GIẢM XUỐNG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Giá mục tiêu (đ)
              </Label>
              <Input
                id="price"
                type="number"
                step="1000"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="col-span-3"
              />
            </div>
            {alertError && (
              <p className="col-span-4 text-center text-sm text-red-600">{alertError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlertModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveAlert} disabled={alertSaving}>
              {alertSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu cảnh báo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  )
}