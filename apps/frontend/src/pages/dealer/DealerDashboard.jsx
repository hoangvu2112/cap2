"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import LivePriceTicker from "@/components/live-price-ticker.jsx"
import PriceCard from "@/components/PriceCard"
import { io } from "socket.io-client"

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [regions, setRegions] = useState(["all"])
  const [harvestFrom, setHarvestFrom] = useState("")
  const [harvestTo, setHarvestTo] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState(["all"])

  // Cache favorites & costs
  const [favoriteIds, setFavoriteIds] = useState([])
  const [userCosts, setUserCosts] = useState(new Map())
  const [isUserDataReady, setIsUserDataReady] = useState(false)

  const socketRef = useRef(null)

  // Debounce search - chờ 400ms sau khi user ngừng gõ mới gọi API
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch categories & regions song song (chỉ 1 lần)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [catRes, regionRes] = await Promise.all([
          api.get("/products/categories"),
          api.get("/products/regions")
        ])
        setCategories(["all", ...catRes.data.map(c => c.name)])
        setRegions(["all", ...(regionRes.data || [])])
      } catch (error) {
        console.error("⚠️ Failed to fetch initial data:", error)
      }
    }
    fetchInitialData()
  }, [])

  // Fetch favorites & costs - phải hoàn thành trước khi fetchProducts chạy
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setIsUserDataReady(true)
      return
    }

    const fetchUserData = async () => {
      try {
        const [favRes, costRes] = await Promise.all([
          api.get("/favorites"),
          api.get("/costs")
        ])
        setFavoriteIds(favRes.data.map(f => f.productId))
        const costsMap = new Map()
        costRes.data.forEach(c => costsMap.set(c.product_id, c.cost_price))
        setUserCosts(costsMap)
      } catch (err) {
        console.warn("⚠️ Không thể tải favorites/costs:", err)
      } finally {
        setIsUserDataReady(true)
      }
    }
    fetchUserData()
  }, [])

  // Socket.io - khởi tạo 1 lần, cleanup khi unmount
  useEffect(() => {
    const socketUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/api\/?$/, "")
    socketRef.current = io(socketUrl, { transports: ["websocket", "polling"] })

    socketRef.current.on("productAdded", (newProduct) => {
      setProducts((prev) => [...prev, newProduct])
    })

    socketRef.current.on("productDeleted", (deleted) => {
      setProducts((prev) => prev.filter((p) => p.id !== deleted.id))
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  // Fetch products - chỉ khi filter/page thay đổi
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)

      const response = await api.get("/products", {
        params: {
          page,
          search: debouncedSearch || undefined,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          region: selectedRegion === "all" ? undefined : selectedRegion,
          harvestFrom: harvestFrom || undefined,
          harvestTo: harvestTo || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
        },
      })

      const { data, totalPages: tp } = response.data

      const merged = data.map(p => {
        const productId = p.id || p.productId
        return {
          ...p,
          id: productId,
          isFavorite: favoriteIds.includes(productId),
          userCost: userCosts.get(productId) || 0,
        }
      })

      setProducts(merged)
      setTotalPages(tp)
    } catch (error) {
      console.error("❌ Lỗi khi tải sản phẩm:", error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategory, selectedRegion, harvestFrom, harvestTo, minPrice, maxPrice, page, favoriteIds, userCosts])

  // Chỉ fetch products sau khi favorites đã được load xong
  useEffect(() => {
    if (!isUserDataReady) return
    fetchProducts()
  }, [fetchProducts, isUserDataReady])

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1)
  }

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1)
  }

  return (
    <div>
      <Navbar />
      <LivePriceTicker />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tiêu đề */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Giá nông sản hôm nay</h1>
          <p className="text-muted-foreground">Cập nhật giá thời gian thực từ các khu vực trên toàn quốc</p>
        </div>

        {/* Tìm kiếm + Lọc */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm nông sản..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setPage(1)
                      setSelectedCategory(category)
                    }}
                    className="whitespace-nowrap"
                  >
                    {category === "all" ? "Tất cả" : category}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setPage(1)
                    setSelectedRegion(e.target.value)
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region === "all" ? "Tất cả khu vực" : region}
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  placeholder="Giá từ (đ/kg)"
                  value={minPrice}
                  onChange={(e) => {
                    setPage(1)
                    setMinPrice(e.target.value)
                  }}
                />

                <Input
                  type="number"
                  placeholder="Giá đến (đ/kg)"
                  value={maxPrice}
                  onChange={(e) => {
                    setPage(1)
                    setMaxPrice(e.target.value)
                  }}
                />

                <Button
                  variant="outline"
                  onClick={() => {
                    setPage(1)
                    setHarvestFrom("")
                    setHarvestTo("")
                    setMinPrice("")
                    setMaxPrice("")
                    setSelectedRegion("all")
                  }}
                >
                  Xóa bộ lọc nhanh
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Thu hoạch từ ngày</label>
                  <Input
                    type="date"
                    value={harvestFrom}
                    onChange={(e) => {
                      setPage(1)
                      setHarvestFrom(e.target.value)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Thu hoạch đến ngày</label>
                  <Input
                    type="date"
                    value={harvestTo}
                    onChange={(e) => {
                      setPage(1)
                      setHarvestTo(e.target.value)
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danh sách sản phẩm */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.length > 0 ? (
                products.map((product) => <PriceCard key={product.id} item={product} />)
              ) : (
                <div className="col-span-full text-center text-muted-foreground py-10">
                  Không tìm thấy sản phẩm phù hợp
                </div>
              )}
            </div>

            {/* Điều hướng phân trang */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button onClick={handlePrevPage} disabled={page === 1} variant="outline">
                  Trang trước
                </Button>
                <span className="text-muted-foreground">
                  Trang {page} / {totalPages}
                </span>
                <Button onClick={handleNextPage} disabled={page === totalPages} variant="outline">
                  Trang sau
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
