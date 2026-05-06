"use client"

import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import { motion } from "framer-motion"
import { Activity } from "lucide-react"
import api from "../lib/api"
// import { socket } from "@/socket"
export default function LivePriceTicker() {
    const [items, setItems] = useState([])

    // 🧠 Hàm tính change và trend từ 2 giá
    const computeChange = (newPrice, previousPrice) => {
        const change = previousPrice ? ((newPrice - previousPrice) / previousPrice) * 100 : 0
        const trend = newPrice > previousPrice ? "up" : newPrice < previousPrice ? "down" : "stable"
        return { change: Number(change.toFixed(1)), trend }
    }

    // 🧩 Load dữ liệu ban đầu
    const fetchPrices = async () => {
        try {
            const res = await api.get("/products/ticker")
            setItems(res.data)
        } catch (err) {
            console.error("❌ Lỗi khi lấy giá:", err)
        }
    }

    useEffect(() => {
        fetchPrices()

        // 🔌 Kết nối socket.io
        const socket = io("http://localhost:5000")

        // Khi có sự kiện cập nhật giá
        socket.on("priceUpdate", ({ id, newPrice, previousPrice }) => {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? {
                            ...item,
                            price: newPrice,
                            ...computeChange(newPrice, previousPrice),
                        }
                        : item
                )
            )
        })

        // Khi có sản phẩm mới
        socket.on("productAdded", (newProduct) => {
            setItems((prev) => [...prev, newProduct])
        })

        // Khi sản phẩm bị xóa
        socket.on("productDeleted", ({ id }) => {
            setItems((prev) => prev.filter((item) => item.id !== id))
        })

        return () => socket.disconnect()
    }, [])

    return (
        <div className="bg-card border-b border-border overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                        <Activity className="h-4 w-4 text-primary animate-pulse" />
                        <span>Giá trực tiếp:</span>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <motion.div 
                            className="flex w-max gap-6"
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
                        >
                            {[...items, ...items].map((item, index) => (
                                <div key={index} className="flex items-center gap-2 whitespace-nowrap text-sm">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-muted-foreground">
                                        {item.price?.toLocaleString("vi-VN")}đ
                                    </span>
                                    <span
                                        className={
                                            item.trend === "up"
                                                ? "text-green-600"
                                                : item.trend === "down"
                                                    ? "text-red-500"
                                                    : "text-muted-foreground"
                                        }
                                    >
                                        {item.change > 0 ? "+" : ""}
                                        {item.change}%
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}
