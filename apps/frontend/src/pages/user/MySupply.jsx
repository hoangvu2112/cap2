"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import api from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { X, Edit2, Pin, Loader2 } from "lucide-react"

function SupplyManager() {
  const [listings, setListings] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [boostPlans, setBoostPlans] = useState([])
  const [boostingId, setBoostingId] = useState(null)
  const formRef = useRef(null)
  
  const { user, setUser } = useAuth()
  const { toast } = useToast()
  
  const [boostModalOpen, setBoostModalOpen] = useState(false)
  const [boostItem, setBoostItem] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState("")

  // States cho Form
  const [editingId, setEditingId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantityAvailable, setQuantityAvailable] = useState("")
  const [harvestStart, setHarvestStart] = useState("")
  const [harvestEnd, setHarvestEnd] = useState("")
  const [supplyStatus, setSupplyStatus] = useState("available")
  const [note, setNote] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const normalizeBoostPlans = (plans) => {
    const planByDuration = new Map()

    for (const plan of plans || []) {
      const key = Number(plan.duration_days)
      const current = planByDuration.get(key)

      if (!current) {
        planByDuration.set(key, plan)
        continue
      }

      const currentPrice = Number(current.price || 0)
      const nextPrice = Number(plan.price || 0)
      const currentIsFree = currentPrice === 0
      const nextIsFree = nextPrice === 0

      if (currentIsFree && !nextIsFree) {
        planByDuration.set(key, plan)
        continue
      }

      if (currentIsFree === nextIsFree && nextPrice < currentPrice) {
        planByDuration.set(key, plan)
      }
    }

    return Array.from(planByDuration.values()).sort(
      (a, b) => Number(a.duration_days) - Number(b.duration_days)
    )
  }

  const fetchListings = async () => {
    try {
      setLoading(true)
      const res = await api.get("/users/me/source-listings")
      setListings(res.data || [])
    } catch (error) {
      console.error("Kh├┤ng tß║úi ─æ╞░ß╗úc nguß╗ôn h├áng", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const res = await api.get("/products/all")
        setAllProducts(res.data)
        if (res.data.length > 0) setSelectedProduct(String(res.data[0].id))
      } catch (error) {
        console.error("Lß╗ùi tß║úi sß║ún phß║⌐m", error)
      }
    }
    const fetchBoostPlans = async () => {
      try {
        const res = await api.get("/listing-boosts/plans")
        setBoostPlans(normalizeBoostPlans(res.data?.plans || []))
      } catch (error) {
        console.error("Lß╗ùi tß║úi g├│i ghim", error)
      }
    }

    fetchAllProducts()
    fetchBoostPlans()
    fetchListings()
  }, [])

  const handleEditListing = (item) => {
    setEditingId(item.id)
    setSelectedProduct(String(item.product_id))
    setQuantityAvailable(String(item.quantity_available))
    
    setHarvestStart(item.harvest_start ? new Date(item.harvest_start).toISOString().split('T')[0] : "")
    setHarvestEnd(item.harvest_end ? new Date(item.harvest_end).toISOString().split('T')[0] : "")
    
    setSupplyStatus(item.supply_status)
    setNote(item.note || "")
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setQuantityAvailable("")
    setHarvestStart("")
    setHarvestEnd("")
    setSupplyStatus("available")
    setNote("")
  }

  const handleSaveListing = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        product_id: Number(selectedProduct),
        quantity_available: Number(quantityAvailable),
        harvest_start: harvestStart || null,
        harvest_end: harvestEnd || null,
        supply_status: supplyStatus,
        note,
      }

      if (editingId) {
        await api.put(`/users/me/source-listings/${editingId}`, payload)
        alert("─É├ú cß║¡p nhß║¡t l├┤ h├áng!")
      } else {
        await api.post("/users/me/source-listings", payload)
        alert("─É├ú l╞░u l├┤ h├áng mß╗¢i!")
      }

      handleCancelEdit()
      fetchListings()
    } catch (error) {
      console.error("Lß╗ùi khi l╞░u nguß╗ôn h├áng", error)
      alert(error.response?.data?.error || "Lß╗ùi! Kh├┤ng thß╗â l╞░u.")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteListing = async (listingId, productName) => {
    if (!confirm(`Bß║ín c├│ chß║»c muß╗æn xo├í l├┤ h├áng "${productName}" n├áy kh├┤ng?`)) return

    try {
      await api.delete(`/users/me/source-listings/${listingId}`)
      setListings((prev) => prev.filter((item) => item.id !== listingId))
      alert("─É├ú xo├í nguß╗ôn h├áng.")
      if (editingId === listingId) handleCancelEdit()
    } catch (error) {
      console.error("Lß╗ùi khi xo├í", error)
      alert(error.response?.data?.error || "Lß╗ùi! Kh├┤ng thß╗â xo├í.")
    }
  }

  const handleBoostListing = (item) => {
    const availablePlans = normalizeBoostPlans(boostPlans)

    if (item.is_boosted) {
      toast({
        variant: "destructive",
        title: "Th├┤ng b├ío",
        description: "Nguß╗ôn h├áng n├áy ─æang ─æ╞░ß╗úc ghim, ch╞░a cß║ºn mua th├¬m g├│i."
      })
      return
    }

    if (availablePlans.length === 0) {
      toast({
        variant: "destructive",
        title: "Th├┤ng b├ío",
        description: "Ch╞░a c├│ g├│i ghim khß║ú dß╗Ñng. Vui l├▓ng thß╗¡ lß║íi sau."
      })
      return
    }

    setBoostItem(item)
    setSelectedPlanId(String(availablePlans[0].id))
    setBoostModalOpen(true)
  }

  const handleConfirmBoost = async () => {
    if (!boostItem || !selectedPlanId) return

    try {
      setBoostingId(boostItem.id)
      const paymentRes = await api.post("/listing-boosts/create-payment", {
        listing_id: boostItem.id,
        plan_id: Number(selectedPlanId),
      })
      
      toast({
        title: "Ghim tin th├ánh c├┤ng. ─É├ú trß╗½ tiß╗ün tß╗½ V├¡ N├┤ng Xu",
        className: "bg-emerald-500 text-white border-none",
      })

      // Cß║¡p nhß║¡t profile ─æß╗â update sß╗æ d╞░
      try {
        const profileRes = await api.get("/auth/me")
        if (profileRes.data && typeof setUser === "function") {
          setUser(profileRes.data)
        }
      } catch (e) {
        // ignore
      }

      setBoostModalOpen(false)
      fetchListings()
    } catch (error) {
      console.error("Lß╗ùi ghim tin", error)
      toast({
        variant: "destructive",
        title: "Lß╗ùi",
        description: error.response?.data?.error || "Kh├┤ng thß╗â ghim nguß╗ôn h├áng",
      })
    } finally {
      setBoostingId(null)
    }
  }


  const statusLabel = { available: "─Éang c├│ h├áng", soon: "Sß║»p thu hoß║ích", partial: "B├ín mß╗Öt phß║ºn", sold: "─É├ú b├ín gß║ºn hß║┐t" }

  const availableProducts = allProducts.filter((p) => {
    if (editingId && selectedProduct === String(p.id)) return true
    return !listings.some((listing) => listing.product_id === p.id)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingId ? "Cß║¡p nhß║¡t l├┤ h├áng" : "Th├¬m l├┤ h├áng mß╗¢i"}</CardTitle>
        <CardDescription>Khai b├ío chi tiß║┐t c├íc l├┤ h├áng ─æang v├á sß║»p thu hoß║ích cß╗ºa bß║ín.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <form ref={formRef} onSubmit={handleSaveListing} className={`space-y-4 rounded-lg border p-4 transition-colors ${editingId ? "border-emerald-500 bg-emerald-50/20" : "border-border"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Sß║ún phß║⌐m</label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm">
                {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.region})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Trß║íng th├íi</label>
              <select value={supplyStatus} onChange={(e) => setSupplyStatus(e.target.value)} className="flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm">
                <option value="available">─Éang c├│ h├áng</option>
                <option value="soon">Sß║»p thu hoß║ích</option>
                <option value="partial">B├ín mß╗Öt phß║ºn</option>
                <option value="sold">─É├ú b├ín gß║ºn hß║┐t</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Sß║ún l╞░ß╗úng (kg)</label>
              <Input type="number" value={quantityAvailable} onChange={(e) => setQuantityAvailable(e.target.value)} placeholder="VD: 5000" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ghi ch├║</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: H├áng loß║íi 1..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Bß║»t ─æß║ºu thu hoß║ích</label>
              <Input type="date" value={harvestStart} onChange={(e) => setHarvestStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Kß║┐t th├║c thu hoß║ích</label>
              <Input type="date" value={harvestEnd} onChange={(e) => setHarvestEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className={editingId ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
              {saving ? "─Éang l╞░u..." : (editingId ? "Cß║¡p nhß║¡t l├┤ h├áng" : "L╞░u l├┤ h├áng mß╗¢i")}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                Hß╗ºy thay ─æß╗òi
              </Button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold border-b pb-2">Danh s├ích l├┤ h├áng cß╗ºa bß║ín</h3>
          {loading ? (
            <p className="text-muted-foreground">─Éang tß║úi...</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bß║ín ch╞░a khai b├ío l├┤ h├áng n├áo.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map((item) => (
                <div key={item.id} className={`flex justify-between items-start p-4 rounded-md border transition-colors ${editingId === item.id ? "border-emerald-500 bg-emerald-50/50" : "bg-muted/50"}`}>
                  <div className="flex-grow space-y-1">
                    <p className="font-bold text-foreground text-lg">{item.product_name}</p>
                    <p className="text-sm">≡ƒôª Sß║ún l╞░ß╗úng: <span className="font-medium">{item.quantity_available.toLocaleString()} kg</span></p>
                    <p className="text-sm flex items-center gap-2">
                      ≡ƒÅ╖∩╕Å Trß║íng th├íi:
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none">
                        {statusLabel[item.supply_status]}
                      </Badge>
                    </p>
                    {item.is_boosted ? (
                      <p className="text-sm font-semibold text-amber-700">
                        ≡ƒôî ─Éang ghim{item.boost_end_at ? ` ─æß║┐n ${new Date(item.boost_end_at).toLocaleDateString("vi-VN")}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Tin th╞░ß╗¥ng ΓÇö c├│ thß╗â mua g├│i ghim ─æß╗â hiß╗ân thß╗ï nß╗òi bß║¡t vß╗¢i ─æß║íi l├╜.</p>
                    )}
                    {item.harvest_start && (
                      <p className="text-sm">≡ƒùô∩╕Å Thu hoß║ích: {new Date(item.harvest_start).toLocaleDateString("vi-VN")} - {new Date(item.harvest_end).toLocaleDateString("vi-VN")}</p>
                    )}
                    {item.note && <p className="text-sm italic text-muted-foreground">≡ƒô¥ {item.note}</p>}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                      onClick={() => handleBoostListing(item)}
                      disabled={boostingId === item.id || item.is_boosted}
                      title={item.is_boosted ? "Tin ─æang ─æ╞░ß╗úc ghim" : "Mua g├│i ghim tin"}
                    >
                      {boostingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => handleEditListing(item)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteListing(item.id, item.product_name)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={boostModalOpen} onOpenChange={setBoostModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>X├íc nhß║¡n thanh to├ín g├│i Ghim tin bß║▒ng V├¡ N├┤ng Xu</DialogTitle>
            <DialogDescription>
              Vui l├▓ng chß╗ìn g├│i ghim cho sß║ún phß║⌐m <span className="font-bold text-foreground">{boostItem?.product_name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Chß╗ìn g├│i ghim</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="flex h-10 w-full items-center rounded-md border bg-background px-3 py-2 text-sm"
            >
              {normalizeBoostPlans(boostPlans).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {Number(plan.price).toLocaleString("vi-VN")}─æ ({plan.duration_days} ng├áy)
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBoostModalOpen(false)} disabled={boostingId === boostItem?.id}>
              Hß╗ºy
            </Button>
            <Button onClick={handleConfirmBoost} disabled={boostingId === boostItem?.id} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {boostingId === boostItem?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              X├íc nhß║¡n
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function MySupplyPage() {
  return (
    <div className="space-y-6">
      <SupplyManager />
    </div>
  )
}
