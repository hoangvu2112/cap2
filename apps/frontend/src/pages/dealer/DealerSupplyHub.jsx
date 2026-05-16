"use client"

import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Search, Sprout, Pin } from "lucide-react"

const STATUS_META = {
    available: { label: "Đang có hàng", color: "#16a34a", bg: "bg-emerald-50", text: "text-emerald-700" },
    soon: { label: "Sắp thu hoạch", color: "#ca8a04", bg: "bg-amber-50", text: "text-amber-700" },
    partial: { label: "Bán một phần", color: "#0284c7", bg: "bg-sky-50", text: "text-sky-700" },
    sold: { label: "Đã bán gần hết", color: "#dc2626", bg: "bg-red-50", text: "text-red-700" },
}

export default function DealerSupplyHub() {
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [regionFilter, setRegionFilter] = useState("all")
    const [selectedListing, setSelectedListing] = useState(null)
    const [requestQuantity, setRequestQuantity] = useState("")
    const [requestPrice, setRequestPrice] = useState("")
    const [requestNote, setRequestNote] = useState("")
    const [requestSaving, setRequestSaving] = useState(false)

    useEffect(() => {
        const fetchSupply = async () => {
            try {
                setLoading(true)
                const res = await api.get("/dealer-supplies/listings")
                setListings(res.data?.listings || [])
            } catch (error) {
                console.error("Lỗi tải nguồn hàng dealer:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchSupply()
    }, [])

    const regions = ["all", ...Array.from(new Set(listings.map((item) => item.product_region).filter(Boolean)))]

    const filteredListings = listings.filter((item) => {
        const haystack = [item.product_name, item.user_name, item.product_region, item.category_name, item.note]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()

        const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === "all" || item.supply_status === statusFilter
        const matchesRegion = regionFilter === "all" || item.product_region === regionFilter

        return matchesSearch && matchesStatus && matchesRegion
    })

    const totalQuantity = filteredListings.reduce((sum, item) => sum + Number(item.quantity_available || 0), 0)

    // Đếm số lượng khu vực thực tế đang có hàng (trừ đi option "all")
    const totalRegions = regions.length > 1 ? regions.length - 1 : 0;

    const openRequestDialog = (item) => {
        setSelectedListing(item)
        setRequestQuantity(String(Number(item.quantity_available || 0)))
        const suggestedPrice = Number(item.current_price || 0)
        setRequestPrice(suggestedPrice > 0 ? String(suggestedPrice) : "")
        setRequestNote(`Quan tâm ${item.product_name} tại ${item.product_region || "khu vực này"}`)
    }

    const handleCreateRequest = async () => {
        if (!selectedListing) return

        if (!requestQuantity || !requestPrice) {
            alert("Vui lòng nhập số lượng và giá đề xuất")
            return
        }

        try {
            setRequestSaving(true)
            await api.post("/purchase-requests", {
                product_id: selectedListing.product_id,
                partner_id: selectedListing.user_id,
                quantity: Number(requestQuantity),
                proposed_price: Number(requestPrice),
                note: requestNote,
            })
            alert("Đã gửi yêu cầu mua từ nguồn hàng này")
            setSelectedListing(null)
        } catch (error) {
            alert(error.response?.data?.error || "Không thể gửi yêu cầu mua")
        } finally {
            setRequestSaving(false)
        }
    }

    return (
        <div>
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Nguồn hàng dealer</p>
                    <h1 className="text-3xl font-bold text-foreground">Danh sách nguồn hàng và cơ hội mua</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Đây là lớp dữ liệu tách riêng khỏi bảng giá thị trường. Dealer dùng màn hình này để nhìn nhanh nơi nào đang có hàng,
                        nơi nào sắp thu hoạch, và đâu là cơ hội mua đáng chú ý.
                    </p>
                </div>

                {/* THỐNG KÊ */}
                <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Tổng nguồn hàng</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{filteredListings.length}</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Tổng sản lượng</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{totalQuantity.toLocaleString("vi-VN")} kg</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Khu vực hiển thị</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{totalRegions}</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Nguồn hàng mới</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{listings.length}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* DANH SÁCH NGUỒN HÀNG */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sprout className="h-5 w-5 text-emerald-700" />
                            Opportunity List
                        </CardTitle>
                        <CardDescription>
                            Danh sách nguồn hàng có thể khai thác ngay. Dùng bộ lọc để tìm kiếm cơ hội mua phù hợp.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* BỘ LỌC */}
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="relative md:col-span-2">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm theo sản phẩm, người khai báo, khu vực, ghi chú..."
                                    className="pl-10"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="available">Đang có hàng</option>
                                <option value="soon">Sắp thu hoạch</option>
                                <option value="partial">Bán một phần</option>
                                <option value="sold">Đã bán gần hết</option>
                            </select>
                            <select
                                value={regionFilter}
                                onChange={(e) => setRegionFilter(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-1"
                            >
                                <option value="all">Tất cả khu vực</option>
                                {regions.slice(1).map((region) => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {Object.entries(STATUS_META).map(([key, meta]) => (
                                <div key={key} className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}>
                                    {meta.label}: {filteredListings.filter((item) => item.supply_status === key).length}
                                </div>
                            ))}
                        </div>

                        {/* HIỂN THỊ DANH SÁCH HOẶC LOADING */}
                        {loading ? (
                            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20">
                                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                                <span className="ml-3 text-sm text-muted-foreground">Đang tải nguồn hàng...</span>
                            </div>
                        ) : filteredListings.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-muted-foreground/20 p-8 text-center text-sm text-muted-foreground">
                                Không tìm thấy nguồn hàng phù hợp với bộ lọc hiện tại.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {filteredListings.map((item) => {
                                    const meta = STATUS_META[item.supply_status] || STATUS_META.available
                                    return (
                                        <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-emerald-700">{item.product_name}</div>
                                                    <div className="text-xl font-bold text-foreground">
                                                        {Number(item.quantity_available).toLocaleString("vi-VN")} {item.product_unit || "kg"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Giá đề xuất: {Number(item.current_price || 0).toLocaleString("vi-VN")} đ/{item.product_unit || "kg"}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {item.is_boosted ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                            <Pin className="h-3 w-3" /> Tin ghim
                                                        </span>
                                                    ) : null}
                                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${meta.bg} ${meta.text}`}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                                                <div>Người bán: <span className="font-medium text-foreground">{item.user_name}</span></div>
                                                <div>Khu vực: {item.product_region || "Chưa xác định"}</div>
                                                {(item.harvest_start || item.harvest_end) && (
                                                    <div>
                                                        Thu hoạch: {item.harvest_start ? new Date(item.harvest_start).toLocaleDateString("vi-VN") : "?"} đến {item.harvest_end ? new Date(item.harvest_end).toLocaleDateString("vi-VN") : "?"}
                                                    </div>
                                                )}
                                                {item.note && <div className="italic">Ghi chú: {item.note}</div>}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {item.is_boosted && item.boost_end_at
                                                        ? `Ghim đến: ${new Date(item.boost_end_at).toLocaleDateString("vi-VN")}`
                                                        : `Cập nhật: ${new Date(item.updated_at || Date.now()).toLocaleDateString("vi-VN")}`}
                                                </span>
                                                <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50" onClick={() => openRequestDialog(item)}>
                                                    Tạo yêu cầu mua
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* DIALOG YÊU CẦU MUA - Giữ nguyên không đổi */}
            <Dialog open={!!selectedListing} onOpenChange={(open) => !open && setSelectedListing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Tạo yêu cầu mua cho {selectedListing?.product_name || "nguồn hàng"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Số lượng</label>
                                <Input
                                    type="number"
                                    value={requestQuantity}
                                    onChange={(e) => setRequestQuantity(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Giá đề xuất</label>
                                <Input
                                    type="number"
                                    value={requestPrice}
                                    onChange={(e) => setRequestPrice(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium">Ghi chú</label>
                            <Input value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Nhập thông điệp gửi đến người bán..." />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedListing(null)}>
                            Hủy
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateRequest} disabled={requestSaving}>
                            {requestSaving ? "Đang gửi..." : "Gửi yêu cầu"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Footer />
        </div>
    )
}