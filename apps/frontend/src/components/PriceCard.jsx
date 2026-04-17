import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Minus, Heart, Coins } from "lucide-react" // <-- THÊM ICON COINS
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { io } from "socket.io-client"
import api from "@/lib/api"
// import { socket } from "@/socket"
// Ẩn 'formatDistanceToNow' vì nó không được sử dụng trong code bạn cung cấp
// import { formatDistanceToNow } from "date-fns" 

// Kết nối Socket.IO tới backend (chạy 1 lần toàn web)
const socket = io("http://localhost:5000") //

export default function PriceCard({ item, onCreateAlert, showAlertButton = false }) {
    // --- SỬA ĐỔI: Thêm userCost từ item ---
    const [currentPrice, setCurrentPrice] = useState(item.currentPrice)
    const [previousPrice, setPreviousPrice] = useState(item.previousPrice)
    const [userCost, setUserCost] = useState(item.userCost || 0) // <-- THÊM DÒNG NÀY

    const [isUpdating, setIsUpdating] = useState(false)
    const [isFavorite, setIsFavorite] = useState(item.isFavorite)
    const [product, setProduct] = useState(item)

    useEffect(() => {
        const handleServerUpdate = (data) => {
            if (data.id === item.id) {
                setIsUpdating(true)

                if (data.newPrice !== undefined) {
                    setPreviousPrice(data.previousPrice ?? currentPrice)
                    setCurrentPrice(data.newPrice)
                }

                // Cập nhật cả userCost nếu có (mặc dù hiện tại server chưa gửi)
                setProduct((prev) => ({
                    ...prev,
                    name: data.name ?? prev.name,
                    category: data.category ?? prev.category,
                    unit: data.unit ?? prev.unit,
                    region: data.region ?? prev.region,
                    userCost: data.userCost ?? prev.userCost, // <-- THÊM DÒNG NÀY
                }))

                // Cập nhật state userCost riêng
                if (data.userCost !== undefined) {
                    setUserCost(data.userCost);
                }

                setTimeout(() => setIsUpdating(false), 1000)
            }
        }

        socket.on("priceUpdate", handleServerUpdate) //
        socket.on("productUpdated", handleServerUpdate) //

        return () => {
            socket.off("priceUpdate", handleServerUpdate)
            socket.off("productUpdated", handleServerUpdate)
        }
    }, [item.id, currentPrice])

    // Toggle yêu thích
    const toggleFavorite = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            await api.post(`/favorites/${item.id}`) //
            setIsFavorite(!isFavorite)
        } catch (error) {
            console.error("Toggle favorite failed:", error)
        }
    }

    // --- TÍNH TOÁN LỢI NHUẬN ---
    const hasUserCost = userCost > 0
    const profit = currentPrice - userCost
    // --- KẾT THÚC TÍNH TOÁN ---

    // Tính phần trăm thay đổi giá
    const priceChange = currentPrice - previousPrice
    const percentChange =
        previousPrice > 0 ? ((priceChange / previousPrice) * 100).toFixed(2) : 0

    const getTrendIcon = () => {
        if (priceChange > 0) return <TrendingUp className="h-4 w-4" />
        if (priceChange < 0) return <TrendingDown className="h-4 w-4" />
        return <Minus className="h-4 w-4" />
    }

    const getTrendColor = () => {
        if (priceChange > 0) return "text-green-600"
        if (priceChange < 0) return "text-red-600"
        return "text-muted-foreground"
    }

    return (
        <Link to={`/product/${product.id}`} className="block">
            <Card
                className={`hover:shadow-md transition-all duration-500 ease-in-out cursor-pointer ${isUpdating
                    ? priceChange > 0
                        ? "ring-2 ring-green-400/50"
                        : priceChange < 0
                            ? "ring-2 ring-red-400/50"
                            : "ring-2 ring-gray-300/50"
                    : ""
                    }`}
            >
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-semibold text-foreground">{product.name}</h3>
                                <p className="text-sm text-muted-foreground">{product.category}</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 -mt-1"
                                onClick={toggleFavorite}
                            >
                                <Heart
                                    className={`h-5 w-5 transition-colors duration-200 ${isFavorite
                                        ? "fill-red-500 text-red-500"
                                        : "text-muted-foreground hover:text-red-400"
                                        }`}
                                />
                            </Button>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={`text-2xl font-bold transition-all duration-500 ${isUpdating
                                        ? priceChange > 0
                                            ? "scale-110 text-green-600"
                                            : priceChange < 0
                                                ? "scale-110 text-red-600"
                                                : "text-foreground"
                                        : "text-foreground"
                                        }`}
                                >
                                    {currentPrice.toLocaleString("vi-VN")}
                                </span>
                                <span className="text-sm text-muted-foreground">đ/{product.unit}</span>
                            </div>
                            <div
                                className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}
                            >
                                {getTrendIcon()}
                                <span>
                                    {priceChange > 0 ? "+" : ""}
                                    {priceChange.toLocaleString("vi-VN")} ({percentChange}%)
                                </span>
                            </div>
                        </div>

                        {hasUserCost && (
                            <div
                                className={`flex items-center p-2 rounded-md ${profit > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}
                            >
                                <Coins size={16} className="mr-2 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                    Lợi nhuận: {profit.toLocaleString()} đ/{product.unit}
                                </span>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                            <Badge variant="secondary" className="text-xs">
                                {product.region}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {new Date(product.lastUpdate).toLocaleString("vi-VN", {
                                    day: "2-digit",
                                    month: "2-digit", // <-- Sửa 'long' thành '2-digit' cho ngắn gọn
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>

                        {/* Chỉ hiện nút nếu showAlertButton = true */}
                        {showAlertButton && (
                            <Button
                                className="w-full bg-green-600 text-white mt-3"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onCreateAlert(item)
                                }}
                            >
                                🔔 Tạo cảnh báo
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}