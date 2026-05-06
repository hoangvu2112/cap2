"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Heart, Search } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"
import PriceCard from "@/components/PriceCard"
import { io } from "socket.io-client"
// import { socket } from "@/socket"
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000")

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
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

  const fetchCategories = async () => {
    try {
      const res = await api.get("/products/categories") //
      setCategories(["all", ...res.data.map(c => c.name)])
    } catch (error) {
      console.error("⚠️ Failed to fetch categories:", error)
    }
  }

  const fetchRegions = async () => {
    try {
      const res = await api.get("/products/all")
      const unique = Array.from(new Set((res.data || []).map((item) => item.region).filter(Boolean)))
      setRegions(["all", ...unique])
    } catch (error) {
      console.error("⚠️ Failed to fetch regions:", error)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchRegions()
    // socket.onAny((event, data) => {
    //   console.log("📥 nhận event bất kỳ:", event, data);
    // });

    socket.on("productAdded", (newProduct) => {
      setProducts((prev) => [...prev, newProduct])
    })

    socket.on("productDeleted", (deleted) => {
      setProducts((prev) => prev.filter((p) => p.id !== deleted.id))
    })

    return () => {
      socket.off("productAdded")
      socket.off("productDeleted")
    }
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)

      const response = await api.get("/products", { //
        params: {
          page,
          search: searchQuery,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          region: selectedRegion === "all" ? undefined : selectedRegion,
          harvestFrom: harvestFrom || undefined,
          harvestTo: harvestTo || undefined,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
        },
      })

      const { data, totalPages } = response.data

      const token = localStorage.getItem("token")
      let favoriteIds = []
      let userCosts = new Map()

      if (token) {
        try {
          const [favResponse, costResponse] = await Promise.all([
            api.get("/favorites"), //
            // --- SỬA LỖI Ở ĐÂY: Bỏ "/api" ---
            api.get("/costs")
          ]);

          favoriteIds = favResponse.data.map(f => f.productId)

          costResponse.data.forEach(c => {
            userCosts.set(c.product_id, c.cost_price);
          });

        } catch (err) {
          console.warn("⚠️ Không thể tải danh sách yêu thích hoặc chi phí:", err)
        }
      }

      const merged = data.map(p => {
        const productId = p.id || p.productId;
        const userCost = userCosts.get(productId) || 0;

        return {
          ...p,
          id: productId,
          isFavorite: favoriteIds.includes(productId),
          userCost: userCost,
        };
      });

      setProducts(merged)
      setTotalPages(totalPages)
    } catch (error) {
      console.error("❌ Lỗi khi tải sản phẩm:", error)
    } finally {
      setLoading(false)
    }
  }

  // Tự động gọi API khi thay đổi tìm kiếm, danh mục hoặc trang
  useEffect(() => {
    fetchProducts()
  }, [searchQuery, selectedCategory, selectedRegion, harvestFrom, harvestTo, minPrice, maxPrice, page])

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1)
  }

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1)
  }

  return (
    <div>
      <Navbar />

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
                  onChange={(e) => {
                    setPage(1)
                    setSearchQuery(e.target.value)
                  }}
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