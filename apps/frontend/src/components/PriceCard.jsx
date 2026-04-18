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
                "rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden ring-1 ring-gray-100 h-full",
                isUpdating && (priceChange > 0 ? "ring-2 ring-emerald-400" : "ring-2 ring-red-400")
            )}>
                <CardContent className="p-5 space-y-3 flex flex-col h-full">
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

                    {/* AI Intelligence Hub - Đồng bộ hóa không gian */}
                    <div className="flex-1 flex flex-col gap-3">
                        {/* 1. Phân tích văn bản (Stretch to fill) */}
                        <div className={cn(
                            "flex-1 rounded-2xl p-4 border transition-all duration-500 relative overflow-hidden group/insight flex flex-col justify-start",
                            analysisLoading ? "bg-gray-50 border-gray-100 animate-pulse" : 
                            "bg-gradient-to-br from-emerald-50/80 to-white border-emerald-100/50 shadow-sm"
                        )}>
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-100/10 rounded-full blur-2xl" />

                            {analysisLoading ? (
                                <div className="space-y-2">
                                    <div className="h-3 w-20 bg-gray-200 rounded-full" />
                                    <div className="h-2 w-full bg-gray-200 rounded-full" />
                                    <div className="h-2 w-2/3 bg-gray-200 rounded-full" />
                                </div>
                            ) : analysis ? (
                                <div className="space-y-2 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-emerald-700">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Insight AI</span>
                                        </div>
                                        <Badge className={cn(
                                            "px-1.5 py-0 text-[8px] font-black border shadow-none uppercase",
                                            analysis.sentiment === "Tích cực" ? "bg-emerald-500 text-white border-emerald-400" : 
                                            analysis.sentiment === "Tiêu cực" ? "bg-red-500 text-white border-red-400" : 
                                            "bg-blue-500 text-white border-blue-400"
                                        )}>
                                            {analysis.sentiment === "Tích cực" ? "Tăng" : analysis.sentiment === "Tiêu cực" ? "Giảm" : "Ngang"}
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-gray-700 font-semibold italic">
                                        "{analysis.summary?.replace(/<[^>]*>?/gm, '')}"
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-2 text-gray-400 text-[10px] font-medium italic">
                                    Đang tổng hợp...
                                </div>
                            )}
                        </div>

                        {/* 2. Grid thông số kỹ thuật (Fixed height blocks) */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100/50 hover:bg-white transition-colors">
                                <span className="text-[8px] uppercase tracking-widest font-black text-gray-400 block mb-1">Dự báo ngắn</span>
                                <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                        "p-1 rounded-md",
                                        (analysis?.direction === "up" || (analysis?.change_amount > 0 && analysis?.direction !== "down")) ? "bg-emerald-100 text-emerald-600" : 
                                        (analysis?.direction === "down" || analysis?.change_amount < 0) ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                                    )}>
                                        {(analysis?.direction === "up" || (analysis?.change_amount > 0 && analysis?.direction !== "down")) ? <TrendingUp className="w-2.5 h-2.5" /> : 
                                         (analysis?.direction === "down" || analysis?.change_amount < 0) ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className={cn(
                                        "text-[13px] font-black tracking-tighter",
                                        (analysis?.direction === "up" || (analysis?.change_amount > 0 && analysis?.direction !== "down")) ? "text-emerald-600" : 
                                        (analysis?.direction === "down" || analysis?.change_amount < 0) ? "text-red-600" : "text-gray-600"
                                    )}>
                                        {analysis?.change_amount ? `${(analysis.direction === "up" || (analysis?.change_amount > 0 && analysis?.direction !== "down")) ? "+" : "-"}${Math.abs(Number(analysis.change_amount)).toLocaleString()}đ` : "---"}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100/50 hover:bg-white transition-colors">
                                <span className="text-[8px] uppercase tracking-widest font-black text-gray-400 block mb-1">Tín hiệu</span>
                                <div className="flex flex-col justify-between h-full">
                                    <p className="text-[10px] font-black text-gray-700 leading-tight line-clamp-2 mb-2">
                                        {analysis?.signal || "Đang phân tích..."}
                                    </p>
                                    <div className={cn(
                                        "h-1 w-full rounded-full bg-gray-100 overflow-hidden"
                                    )}>
                                        <div className={cn(
                                            "h-full transition-all duration-1000",
                                            analysis?.recommendation === "Mua" ? "bg-emerald-500 w-full" :
                                            analysis?.recommendation === "Bán" ? "bg-red-500 w-full" :
                                            "bg-blue-500 w-1/2"
                                        )} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Sticky Section */}
                    <div className="pt-3 space-y-3">
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