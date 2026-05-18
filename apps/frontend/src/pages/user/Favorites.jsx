"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Navbar from "../../components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import { Heart, TrendingUp, TrendingDown, Minus, Sparkles, Loader2, Search, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState({})
  const [loadingInsights, setLoadingInsights] = useState({})
  const navigate = useNavigate()

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [categories, setCategories] = useState(["all"])
  const [regions, setRegions] = useState(["all"])

  useEffect(() => {
    fetchFavorites()
  }, [])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      const favRes = await api.get("/favorites")
      const favoriteIds = favRes.data

      if (!favoriteIds.length) {
        setFavorites([])
        return
      }

      const favIds = favoriteIds.map(f => f.productId)

      const prodRes = await api.get("/products", {
        params: { ids: favIds.join(","), limit: 50 },
      })

      const { data } = prodRes.data
      const items = data || []
      setFavorites(items)

      // Extract categories & regions
      const cats = [...new Set(items.map(p => p.category).filter(Boolean))]
      setCategories(["all", ...cats])
      const regs = [...new Set(items.map(p => p.region).filter(Boolean))]
      setRegions(["all", ...regs])
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách yêu thích:", error)
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (productId) => {
    try {
      await api.delete(`/favorites/${productId}`)
      setFavorites(prev => prev.filter(p => p.id !== productId))
    } catch (error) {
      console.error("Lỗi xóa yêu thích:", error)
    }
  }

  const fetchInsight = async (productId) => {
    if (insights[productId]) return
    try {
      setLoadingInsights(prev => ({ ...prev, [productId]: true }))
      const res = await api.get(`/products/${productId}/analysis`)
      const analysisData = res.data?.analysis || res.data?.analysis_json
      let summary = ""
      if (analysisData) {
        const parsed = typeof analysisData === "string" ? JSON.parse(analysisData) : analysisData
        summary = parsed?.summary || parsed?.insight || parsed?.recommendation || "Chưa có phân tích cho sản phẩm này."
      } else {
        summary = "Chưa có dữ liệu phân tích AI."
      }
      setInsights(prev => ({ ...prev, [productId]: summary }))
    } catch {
      setInsights(prev => ({ ...prev, [productId]: "Không thể tải phân tích AI." }))
    } finally {
      setLoadingInsights(prev => ({ ...prev, [productId]: false }))
    }
  }

  const getPriceChange = (current, previous) => {
    const cur = Number(current) || 0
    const prev = Number(previous) || 0
    if (!prev || !cur) return { diff: 0, percent: 0, direction: "stable" }
    const diff = cur - prev
    const percent = ((diff / prev) * 100).toFixed(1)
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "stable"
    return { diff, percent: Number(percent), direction }
  }

  // Lọc
  const filtered = favorites.filter(item => {
    const matchSearch = !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategory = selectedCategory === "all" || item.category === selectedCategory
    const matchRegion = selectedRegion === "all" || item.region === selectedRegion
    return matchSearch && matchCategory && matchRegion
  })

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCategory("all")
    setSelectedRegion("all")
  }

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedRegion !== "all"

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
            Danh sách yêu thích
          </h1>
          <p className="text-muted-foreground mt-1">Theo dõi biến động giá các sản phẩm bạn quan tâm.</p>
        </div>

        {/* Bộ lọc */}
        {!loading && favorites.length > 0 && (
          <div className="mb-6 bg-card border border-border/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc loại..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa lọc
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === "all" ? "Tất cả loại" : cat}</option>
                ))}
              </select>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
              >
                {regions.map(reg => (
                  <option key={reg} value={reg}>{reg === "all" ? "Tất cả khu vực" : reg}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            <p className="text-muted-foreground mt-4">Đang tải...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
            <Heart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Bạn chưa có sản phẩm nào trong danh sách yêu thích.</p>
            <p className="text-sm text-muted-foreground mt-1">Hãy thêm sản phẩm từ trang chủ để theo dõi giá.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
            <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Không tìm thấy sản phẩm phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(item => {
              const { diff, percent, direction } = getPriceChange(item.currentPrice, item.previousPrice)
              const hasInsight = insights[item.id]
              const isLoadingInsight = loadingInsights[item.id]

              return (
                <div
                  key={item.id}
                  className="bg-card border border-border/50 rounded-2xl p-5 hover:shadow-md transition-all group"
                >
                  {/* Row chính */}
                  <div className="flex items-center gap-4">
                    {/* Icon tim */}
                    <button
                      onClick={() => removeFavorite(item.id)}
                      className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                      title="Bỏ yêu thích"
                    >
                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                    </button>

                    {/* Tên sản phẩm + region */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/product/${item.id}`)}
                    >
                      <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{item.region || "Chưa rõ khu vực"}</p>
                    </div>

                    {/* Giá trước đó */}
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Giá trước</p>
                      <p className="text-sm font-medium text-muted-foreground line-through">
                        {formatCurrency(item.previousPrice || 0)}
                      </p>
                    </div>

                    {/* Giá hiện tại */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Hiện tại</p>
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(item.currentPrice || 0)}
                      </p>
                    </div>

                    {/* Badge thay đổi */}
                    <div className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                      direction === "up" ? "bg-green-50 text-green-700" :
                      direction === "down" ? "bg-red-50 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {direction === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                      {direction === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                      {direction === "stable" && <Minus className="w-3.5 h-3.5" />}
                      <span>{direction === "stable" ? "0%" : `${percent > 0 ? "+" : ""}${percent}%`}</span>
                    </div>
                  </div>

                  {/* Insight AI */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    {hasInsight ? (
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{insights[item.id]}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => fetchInsight(item.id)}
                        disabled={isLoadingInsight}
                        className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors disabled:opacity-50"
                      >
                        {isLoadingInsight ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang phân tích...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Xem Insight AI
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
