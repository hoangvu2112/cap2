import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Bot,
  MapPin,
  Heart,
  Sparkles,
  Tag,
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
} from "recharts"
import { cn } from "@/lib/utils"

// ===========================================
// --- 🚀 COMPONENT: THẺ PHÂN TÍCH AI (ĐÃ TỐI ƯU LOADING) ---
// ===========================================
function AnalysisCard({ analysis, loading, product }) {
  // Trạng thái đang tải (Skeleton)
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="rounded-xl border border-gray-100 bg-gray-50 h-32 flex flex-col p-4">
           <div className="flex gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-200" />
              <div className="h-4 w-24 bg-gray-200 rounded mt-2" />
           </div>
           <div className="space-y-2">
              <div className="h-3 w-full bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
           </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
           <div className="h-20 bg-gray-50 rounded-2xl border border-gray-100" />
           <div className="h-20 bg-gray-50 rounded-2xl border border-gray-100" />
        </div>
      </div>
    )
  }

  if (!analysis || !analysis.summary) return null;

  const sentimentBg =
    analysis.sentiment === "Tích cực" || analysis.sentiment === "Rất Tích cực" ? "bg-emerald-50 border-emerald-200"
      : analysis.sentiment === "Tiêu cực" || analysis.sentiment === "Rất Tiêu cực" ? "bg-red-50 border-red-200"
        : "bg-gray-50 border-gray-200";

  const recommendBg =
    analysis.recommendation === "Mua" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : analysis.recommendation === "Bán" ? "bg-red-100 text-red-800 border-red-300"
        : "bg-blue-100 text-blue-800 border-blue-300";

  return (
    <div className="space-y-3 transition-all duration-500">
      {/* AI Insight Card */}
      <div className={cn("rounded-xl border p-4", sentimentBg)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="font-semibold text-emerald-700">Insight AI</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700 font-medium">
          {analysis.summary}
        </p>
      </div>

      {/* Dự đoán + Khuyến nghị */}
      <div className="grid grid-cols-2 gap-3">
        {/* Dự đoán ngắn hạn */}
        <div className="rounded-2xl border bg-gray-50/30 p-4">
          <p className="text-sm text-muted-foreground mb-1 font-medium">Dự đoán ngắn hạn</p>
          <p className="text-lg font-bold text-gray-900">
            {analysis.predictedPrice
              ? `${Number(analysis.predictedPrice).toLocaleString("vi-VN")} đ/${product?.unit || 'kg'}`
              : "N/A"}
          </p>
          {analysis.confidence && (
            <p className="text-xs text-muted-foreground mt-1 text-emerald-600 font-medium">
              Độ tin cậy {analysis.confidence}%
            </p>
          )}
        </div>

        {/* Khuyến nghị */}
        <div className="rounded-2xl border bg-gray-50/30 p-4">
          <p className="text-sm text-muted-foreground mb-1 font-medium">Khuyến nghị</p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border shadow-sm",
              recommendBg
            )}>
              {analysis.recommendation || "Giữ"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// --- COMPONENT CHÍNH ---
// ===========================================
export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState("30d")

  // State riêng cho AI Analysis
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false)
  const [alertCondition, setAlertCondition] = useState("above")
  const [alertPrice, setAlertPrice] = useState("")
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertError, setAlertError] = useState(null)

  // 1. Fetch thông tin sản phẩm chính (Giá, Biểu đồ) - Cần nhanh
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
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

        // ✅ Cập nhật Insight AI ngay lập tức từ dữ liệu gộp
        if (res.data.analysis_data) {
          setAnalysis(res.data.analysis_data);
        }

        setAlertPrice(Math.round(res.data.currentPrice / 1000) * 1000);

      } catch (err) {
        setError(err.response?.data?.error || "Không thể tải dữ liệu sản phẩm.")
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id, range])


  const handleSaveAlert = async () => {
    if (!user) {
      setAlertError("Bạn cần đăng nhập để tạo cảnh báo.");
      return;
    }
    setAlertSaving(true);
    setAlertError(null);
    try {
      await api.post("/alerts", {
        product_id: id,
        target_price: Number(alertPrice),
        alert_condition: alertCondition,
        email: user.email
      });
      setAlertSaving(false);
      setIsAlertModalOpen(false);
      alert("Đã tạo cảnh báo thành công!");
    } catch (err) {
      setAlertError(err.response?.data?.error || "Lỗi khi lưu cảnh báo.");
      setAlertSaving(false);
    }
  };

  const handleAlertButtonClick = () => {
    if (!user) {
      alert("Bạn cần đăng nhập để sử dụng tính năng này.");
      navigate("/login");
    } else {
      setAlertError(null);
      if (product) {
        setAlertPrice(Math.round(product.currentPrice / 1000) * 1000);
      }
      setAlertCondition("above");
      setIsAlertModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold">Lỗi</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Thử lại</Button>
      </div>
    )
  }
  if (!product) return null

  const trend = product.trend
  const currentPrice = Number(product.currentPrice).toLocaleString("vi-VN")
  const percentChange = product.percentChange || 0

  const PriceChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="date" tick={{fontSize: 12}} />
        <YAxis
          domain={["auto", "auto"]}
          tickFormatter={(value) => value.toLocaleString("vi-VN")}
          tick={{fontSize: 12}}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toLocaleString("vi-VN")} đ`,
            name === "price" ? "Giá thực tế" : "Dự báo (SMA)",
          ]}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="price"
          name="Giá"
          stroke="#059669"
          strokeWidth={3}
          dot={{ r: 4, fill: '#059669' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Dự báo (SMA)"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded uppercase">
                {product.category}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {product.region}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cột chính (Biểu đồ) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-gray-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-gray-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-emerald-600" />
                  Biến động giá thị trường
                </CardTitle>
                <div className="flex gap-1">
                  {["30d", "6m", "1y"].map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={range === r ? "default" : "outline"}
                      className={cn("h-8 px-3 text-xs font-bold rounded-lg transition-all", range === r ? "bg-emerald-600 shadow-md" : "hover:bg-emerald-50")}
                      onClick={() => setRange(r)}
                    >
                      {r === "30d" ? "30 Ngày" : r === "6m" ? "6 Tháng" : "1 Năm"}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                {product.history && product.history.length > 0 ? (
                  <PriceChart data={product.history} />
                ) : (
                  <div className="h-96 flex flex-col justify-center items-center text-muted-foreground bg-gray-50 rounded-xl">
                    <BarChart className="w-12 h-12 opacity-20" />
                    <p className="mt-2 font-medium">Không đủ dữ liệu lịch sử cho phạm vi này.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thống kê 30 ngày */}
            {product.statistics && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <ArrowUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Cao nhất</span>
                  </div>
                  <p className="text-xl font-bold">{Number(product.statistics.high_30d).toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <ArrowDown className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Thấp nhất</span>
                  </div>
                  <p className="text-xl font-bold">{Number(product.statistics.low_30d).toLocaleString("vi-VN")} đ</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Landmark className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Trung bình</span>
                  </div>
                  <p className="text-xl font-bold">{Math.round(Number(product.statistics.avg_30d)).toLocaleString("vi-VN")} đ</p>
                </div>
              </div>
            )}
          </div>

          {/* Cột phụ (Thông tin & AI) */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden shadow-xl border-none ring-1 ring-gray-200 rounded-3xl">
              <CardContent className="p-6 space-y-6">
                
                {/* Section Giá & Xu hướng */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h2>
                      <div className="flex items-center gap-1.5 text-muted-foreground mt-1.5 font-semibold text-sm">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>{product.region}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Heart className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-5xl font-black text-gray-900 tracking-tighter leading-none">
                          {currentPrice}
                        </p>
                        <p className="text-sm font-bold text-muted-foreground mt-2 ml-1">đ /{product.unit}</p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold shadow-sm border",
                          trend === "up"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : trend === "down"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-gray-100 text-gray-800 border-gray-200"
                        )}
                      >
                        {trend === "up" ? <TrendingUp className="w-4 h-4" /> : trend === "down" ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        {trend === "up" ? "Tăng" : trend === "down" ? "Giảm" : "Ổn định"}
                      </span>
                    </div>

                    <div className={cn(
                      "flex items-center gap-2 mt-4 text-sm font-bold p-2.5 rounded-xl border-l-[4px]",
                      percentChange > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-500" : 
                      percentChange < 0 ? "text-red-700 bg-red-50 border-red-500" : "text-gray-600 bg-gray-50 border-gray-400"
                    )}>
                      {percentChange > 0 ? <TrendingUp className="w-4 h-4" /> : percentChange < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      <span>{percentChange > 0 ? "+" : ""}{percentChange}% so với phiên trước</span>
                    </div>
                  </div>

                  <div className="h-[2px] w-full bg-blue-500/80 rounded-full my-6 opacity-60" />

                  {/* AI INSIGHT SECTION (Bây giờ có loading state) */}
                  <AnalysisCard 
                    analysis={analysis} 
                    loading={analysisLoading} 
                    product={product} 
                  />
                  
                  {/* Dealer Section Placeholder */}
                  <div className="rounded-2xl border border-gray-100 p-4 flex justify-between items-center bg-gray-50/50 hover:bg-gray-100/50 transition-colors cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">3 Đại lý đang giao dịch</span>
                      <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Cập nhật bởi AI
                      </span>
                    </div>
                    <button className="text-sm font-bold text-emerald-600 bg-white px-3 py-1 rounded-lg border shadow-sm">Xem</button>
                  </div>

                  {/* Footer Info */}
                  <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest font-black bg-gray-100 text-gray-500">
                      <Tag className="w-3 h-3" /> {product.category}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                      {new Date(product.lastUpdate).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 space-y-4">
               <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg h-14 text-base font-black rounded-2xl gap-2 active:scale-95 transition-all"
                onClick={handleAlertButtonClick}
              >
                🔔 Tạo cảnh báo giá
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Cảnh báo giá {product.name}</DialogTitle>
            <DialogDescription className="font-medium">
              Nhận thông báo qua email khi giá thay đổi theo mong muốn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="condition" className="text-right font-bold">Khi</Label>
              <Select id="condition" value={alertCondition} onValueChange={setAlertCondition}>
                <SelectTrigger className="col-span-3 rounded-xl font-medium">
                  <SelectValue placeholder="Chọn điều kiện" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="above">Giá VƯỢT QUÁ</SelectItem>
                  <SelectItem value="below">Giá GIẢM XUỐNG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right font-bold">Mức (đ)</Label>
              <Input
                id="price"
                type="number"
                step="1000"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="col-span-3 rounded-xl font-bold text-lg"
              />
            </div>
            {alertError && (
              <p className="col-span-4 text-center text-sm font-bold text-red-600 bg-red-50 py-2 rounded-xl border border-red-100">{alertError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsAlertModalOpen(false)}>Hủy</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold" onClick={handleSaveAlert} disabled={alertSaving}>
              {alertSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Đặt cảnh báo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  )
}