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
    available: { label: "─Éang c├│ h├áng", color: "#16a34a", bg: "bg-emerald-50", text: "text-emerald-700" },
    soon: { label: "Sß║»p thu hoß║ích", color: "#ca8a04", bg: "bg-amber-50", text: "text-amber-700" },
    partial: { label: "B├ín mß╗Öt phß║ºn", color: "#0284c7", bg: "bg-sky-50", text: "text-sky-700" },
    sold: { label: "─É├ú b├ín gß║ºn hß║┐t", color: "#dc2626", bg: "bg-red-50", text: "text-red-700" },
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
                console.error("Lß╗ùi tß║úi nguß╗ôn h├áng dealer:", error)
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

    // ─Éß║┐m sß╗æ l╞░ß╗úng khu vß╗▒c thß╗▒c tß║┐ ─æang c├│ h├áng (trß╗½ ─æi option "all")
    const totalRegions = regions.length > 1 ? regions.length - 1 : 0;

    const openRequestDialog = (item) => {
        setSelectedListing(item)
        setRequestQuantity(String(Number(item.quantity_available || 0)))
        const suggestedPrice = Number(item.current_price || 0)
        setRequestPrice(suggestedPrice > 0 ? String(suggestedPrice) : "")
        setRequestNote(`Quan t├óm ${item.product_name} tß║íi ${item.product_region || "khu vß╗▒c n├áy"}`)
    }

    const handleCreateRequest = async () => {
        if (!selectedListing) return

        if (!requestQuantity || !requestPrice) {
            alert("Vui l├▓ng nhß║¡p sß╗æ l╞░ß╗úng v├á gi├í ─æß╗ü xuß║Ñt")
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
            alert("─É├ú gß╗¡i y├¬u cß║ºu mua tß╗½ nguß╗ôn h├áng n├áy")
            setSelectedListing(null)
        } catch (error) {
            alert(error.response?.data?.error || "Kh├┤ng thß╗â gß╗¡i y├¬u cß║ºu mua")
        } finally {
            setRequestSaving(false)
        }
    }

    return (
        <div>
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Nguß╗ôn h├áng dealer</p>
                    <h1 className="text-3xl font-bold text-foreground">Danh s├ích nguß╗ôn h├áng v├á c╞í hß╗Öi mua</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        ─É├óy l├á lß╗¢p dß╗» liß╗çu t├ích ri├¬ng khß╗Åi bß║úng gi├í thß╗ï tr╞░ß╗¥ng. Dealer d├╣ng m├án h├¼nh n├áy ─æß╗â nh├¼n nhanh n╞íi n├áo ─æang c├│ h├áng,
                        n╞íi n├áo sß║»p thu hoß║ích, v├á ─æ├óu l├á c╞í hß╗Öi mua ─æ├íng ch├║ ├╜.
                    </p>
                </div>

                {/* THß╗ÉNG K├è */}
                <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Tß╗òng nguß╗ôn h├áng</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{filteredListings.length}</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Tß╗òng sß║ún l╞░ß╗úng</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{totalQuantity.toLocaleString("vi-VN")} kg</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Khu vß╗▒c hiß╗ân thß╗ï</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{totalRegions}</div>
                        </div>
                        <div className="rounded-xl bg-white border border-emerald-100 p-4">
                            <div className="text-sm text-muted-foreground">Nguß╗ôn h├áng mß╗¢i</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-700">{listings.length}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* DANH S├üCH NGUß╗ÆN H├ÇNG */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sprout className="h-5 w-5 text-emerald-700" />
                            Opportunity List
                        </CardTitle>
                        <CardDescription>
                            Danh s├ích nguß╗ôn h├áng c├│ thß╗â khai th├íc ngay. D├╣ng bß╗Ö lß╗ìc ─æß╗â t├¼m kiß║┐m c╞í hß╗Öi mua ph├╣ hß╗úp.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Bß╗ÿ Lß╗îC */}
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="relative md:col-span-2">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="T├¼m theo sß║ún phß║⌐m, ng╞░ß╗¥i khai b├ío, khu vß╗▒c, ghi ch├║..."
                                    className="pl-10"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="all">Tß║Ñt cß║ú trß║íng th├íi</option>
                                <option value="available">─Éang c├│ h├áng</option>
                                <option value="soon">Sß║»p thu hoß║ích</option>
                                <option value="partial">B├ín mß╗Öt phß║ºn</option>
                                <option value="sold">─É├ú b├ín gß║ºn hß║┐t</option>
                            </select>
                            <select
                                value={regionFilter}
                                onChange={(e) => setRegionFilter(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-1"
                            >
                                <option value="all">Tß║Ñt cß║ú khu vß╗▒c</option>
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

                        {/* HIß╗éN THß╗è DANH S├üCH HOß║╢C LOADING */}
                        {loading ? (
                            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20">
                                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
                                <span className="ml-3 text-sm text-muted-foreground">─Éang tß║úi nguß╗ôn h├áng...</span>
                            </div>
                        ) : filteredListings.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-muted-foreground/20 p-8 text-center text-sm text-muted-foreground">
                                Kh├┤ng t├¼m thß║Ñy nguß╗ôn h├áng ph├╣ hß╗úp vß╗¢i bß╗Ö lß╗ìc hiß╗çn tß║íi.
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
                                                        Gi├í ─æß╗ü xuß║Ñt: {Number(item.current_price || 0).toLocaleString("vi-VN")} ─æ/{item.product_unit || "kg"}
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
                                                <div>Ng╞░ß╗¥i b├ín: <span className="font-medium text-foreground">{item.user_name}</span></div>
                                                <div>Khu vß╗▒c: {item.product_region || "Ch╞░a x├íc ─æß╗ïnh"}</div>
                                                {(item.harvest_start || item.harvest_end) && (
                                                    <div>
                                                        Thu hoß║ích: {item.harvest_start ? new Date(item.harvest_start).toLocaleDateString("vi-VN") : "?"} ─æß║┐n {item.harvest_end ? new Date(item.harvest_end).toLocaleDateString("vi-VN") : "?"}
                                                    </div>
                                                )}
                                                {item.note && <div className="italic">Ghi ch├║: {item.note}</div>}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                                <span>
                                                    {item.is_boosted && item.boost_end_at
                                                        ? `Ghim ─æß║┐n: ${new Date(item.boost_end_at).toLocaleDateString("vi-VN")}`
                                                        : `Cß║¡p nhß║¡t: ${new Date(item.updated_at || Date.now()).toLocaleDateString("vi-VN")}`}
                                                </span>
                                                <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50" onClick={() => openRequestDialog(item)}>
                                                    Tß║ío y├¬u cß║ºu mua
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

            {/* DIALOG Y├èU Cß║ªU MUA - Giß╗» nguy├¬n kh├┤ng ─æß╗òi */}
            <Dialog open={!!selectedListing} onOpenChange={(open) => !open && setSelectedListing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Tß║ío y├¬u cß║ºu mua cho {selectedListing?.product_name || "nguß╗ôn h├áng"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Sß╗æ l╞░ß╗úng</label>
                                <Input
                                    type="number"
                                    value={requestQuantity}
                                    onChange={(e) => setRequestQuantity(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Gi├í ─æß╗ü xuß║Ñt</label>
                                <Input
                                    type="number"
                                    value={requestPrice}
                                    onChange={(e) => setRequestPrice(e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium">Ghi ch├║</label>
                            <Input value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Nhß║¡p th├┤ng ─æiß╗çp gß╗¡i ─æß║┐n ng╞░ß╗¥i b├ín..." />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedListing(null)}>
                            Hß╗ºy
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateRequest} disabled={requestSaving}>
                            {requestSaving ? "─Éang gß╗¡i..." : "Gß╗¡i y├¬u cß║ºu"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Footer />
        </div>
    )
}
