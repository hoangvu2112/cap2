import { useEffect, useState } from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Heart, 
  MapPin, 
  Sparkles, 
  Tag, 
  Bot,
  ArrowRight,
  CheckCircle2
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { io } from "socket.io-client"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

const socket = io("http://localhost:5000")

export default function PriceCard({ item, onCreateAlert, showAlertButton = false }) {
    const [currentPrice, setCurrentPrice] = useState(item.currentPrice)
    const [previousPrice, setPreviousPrice] = useState(item.previousPrice)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isFavorite, setIsFavorite] = useState(item.isFavorite)
    const [product, setProduct] = useState(item)

    // State cho AI Analysis
    const [analysis, setAnalysis] = useState(null)
    const [analysisLoading, setAnalysisLoading] = useState(false)

    useEffect(() => {
        const handleServerUpdate = (data) => {
            if (data.id === item.id) {
                setIsUpdating(true)
                if (data.newPrice !== undefined) {
                    setPreviousPrice(data.previousPrice ?? currentPrice)
                    setCurrentPrice(data.newPrice)
                }
                setProduct((prev) => ({ ...prev, ...data }))
                setTimeout(() => setIsUpdating(false), 1000)
            }
        }
        socket.on("priceUpdate", handleServerUpdate)
        socket.on("productUpdated", handleServerUpdate)
        return () => {
            socket.off("priceUpdate", handleServerUpdate)
            socket.off("productUpdated", handleServerUpdate)
        }
    }, [item.id, currentPrice])

    // Fetch AI Analysis (Lazy Loading)
    useEffect(() => {
        const fetchAnalysis = async () => {
            setAnalysisLoading(true)
            try {
                const res = await api.get(`/products/${item.id}/analysis`)
                setAnalysis(res.data)
            } catch (err) {
                console.error("Lỗi tải AI Card:", err)
            } finally {
                setAnalysisLoading(false)
            }
        }
        fetchAnalysis()
    }, [item.id])

    const toggleFavorite = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            await api.post(`/favorites/${item.id}`)
            setIsFavorite(!isFavorite)
        } catch (error) {
            console.error("Toggle favorite failed:", error)
        }
    }

    const priceChange = currentPrice - previousPrice
    const percentChange = previousPrice > 0 ? ((priceChange / previousPrice) * 100).toFixed(2) : 0

    return (
        <Link to={`/product/${product.id}`} className="block group">
            <Card className={cn(
                "rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden ring-1 ring-gray-100",
                isUpdating && (priceChange > 0 ? "ring-2 ring-emerald-400" : "ring-2 ring-red-400")
            )}>
                <CardContent className="p-5 space-y-3">
                    {/* Header: Name & Region */}
                    <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                {product.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-gray-400">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{product.region}</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-red-50"
                            onClick={toggleFavorite}
                        >
                            <Heart className={cn("w-4 h-4 transition-all", isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-gray-400")} />
                        </Button>
                    </div>

                    {/* Price Section */}
                    <div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-3xl font-black text-gray-900 tracking-tight">
                                    {currentPrice.toLocaleString("vi-VN")}
                                </span>
                                <span className="text-xs font-bold text-gray-400 ml-1">đ/{product.unit}</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border shadow-sm",
                                priceChange > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                priceChange < 0 ? "bg-red-50 text-red-700 border-red-100" :
                                "bg-gray-50 text-gray-600 border-gray-100"
                            )}>
                                {priceChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : 
                                 priceChange < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                {priceChange > 0 ? "Tăng" : priceChange < 0 ? "Giảm" : "Ổn định"}
                            </div>
                        </div>

                        <div className={cn(
                            "flex items-center gap-1 mt-1.5 text-[11px] font-bold",
                            priceChange > 0 ? "text-emerald-600" : priceChange < 0 ? "text-red-600" : "text-gray-500"
                        )}>
                            <span>{priceChange > 0 ? "+" : ""}{percentChange}% so với lần trước</span>
                        </div>
                    </div>

                    {/* AI Insight Section */}
                    <div className={cn(
                        "rounded-xl p-3.5 border transition-all duration-500",
                        analysisLoading ? "bg-gray-50 border-gray-100 animate-pulse" : 
                        cn("bg-emerald-50/50 border-emerald-100 shadow-sm")
                    )}>
                        {analysisLoading ? (
                            <div className="space-y-1.5">
                                <div className="h-3 w-20 bg-gray-200 rounded" />
                                <div className="h-2 w-full bg-gray-200 rounded" />
                            </div>
                        ) : analysis ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-emerald-700">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span className="text-[11px] font-bold">Insight AI</span>
                                        {analysis.confidence > 90 && (
                                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase ring-1 ring-emerald-200 ml-1 shadow-sm animate-in fade-in zoom-in duration-500">
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                Xác thực
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 shadow-sm italic">
                                        {analysis.sentiment === "Tích cực" ? "🔥 Tăng mạnh" : 
                                         analysis.sentiment === "Tiêu cực" ? "❄️ Giảm mạnh" : "⚓ Đi ngang"}
                                    </span>
                                </div>
                                <p className="text-[10px] leading-relaxed text-gray-700 font-medium">
                                    {analysis.summary?.replace(/<[^>]*>?/gm, '')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                                <Bot className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-medium">Đang chuẩn bị...</span>
                            </div>
                        )}
                    </div>

                    {/* Prediction Grid: Tích hợp phân tích dữ liệu AI chuyên sâu */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-gray-50/50 p-3 ring-1 ring-gray-100 flex flex-col justify-between">
                            <div>
                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Dự đoán AI</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <p className="text-[13px] font-black text-gray-900">
                                        {analysis?.direction === "up" ? "↑" : analysis?.direction === "down" ? "↓" : "→"}
                                    </p>
                                    <p className={cn(
                                        "text-[12px] font-black",
                                        analysis?.direction === "up" ? "text-emerald-600" : analysis?.direction === "down" ? "text-red-600" : "text-gray-600"
                                    )}>
                                        {analysis?.change_amount ? `${analysis.direction === "up" ? "+" : "-"}${Number(analysis.change_amount).toLocaleString()}đ` : "---"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[9px] font-bold text-gray-400">
                                    Mục tiêu: {analysis ? (
                                        `${Number(product.currentPrice + (analysis.direction === "up" ? analysis.change_amount : -analysis.change_amount)).toLocaleString()}đ`
                                    ) : "---đ"}
                                </span>
                                <span className={cn(
                                    "text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                                    analysis?.volatility === "Cao" ? "bg-red-100 text-red-700" :
                                    analysis?.volatility === "Trung bình" ? "bg-orange-100 text-orange-700" :
                                    "bg-emerald-100 text-emerald-700"
                                )}>
                                    {analysis?.volatility || "Thấp"}
                                </span>
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-50/50 p-3 ring-1 ring-gray-100 flex flex-col justify-between min-h-[85px]">
                            <div>
                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400">Tín hiệu / Lệnh</span>
                                <p className="text-[10px] font-bold text-gray-700 mt-1 leading-tight">
                                    {analysis?.signal || "Đang phân tích..."}
                                </p>
                            </div>
                            <div className="mt-2 text-right">
                                <span className={cn(
                                    "inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase border shadow-sm",
                                    analysis?.recommendation === "Mua" ? "bg-emerald-500 text-white border-emerald-600" :
                                    analysis?.recommendation === "Bán" ? "bg-red-500 text-white border-red-600" :
                                    "bg-blue-500 text-white border-blue-600"
                                )}>
                                    {analysis?.recommendation || "Giữ"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dealer Section */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 ring-1 ring-dashed ring-gray-200">
                        <span className="text-[10px] font-bold text-gray-600">3 đại lý đang giao dịch</span>
                        <div className="flex items-center gap-1 text-emerald-700 text-[10px] font-black group-hover:gap-1.5 transition-all">
                            <span>Xem mua bán</span>
                            <ArrowRight className="w-3 h-3" />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <Badge variant="outline" className="rounded-lg px-2 py-0.5 text-[9px] font-black uppercase text-gray-400 border-gray-100">
                            <Tag className="w-2.5 h-2.5 mr-1 text-emerald-600 opacity-70" /> {product.category}
                        </Badge>
                        <span className="text-[9px] font-bold text-gray-300 tracking-tighter uppercase font-mono">
                            {new Date(product.lastUpdate).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                            })}
                        </span>
                    </div>

                    {showAlertButton && (
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg h-10 text-xs font-black rounded-xl gap-2 active:scale-95 transition-all mt-1"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onCreateAlert(item)
                            }}
                        >
                            🔔 Tạo cảnh báo
                        </Button>
                    )}
                </CardContent>
            </Card>
        </Link>
    )
}