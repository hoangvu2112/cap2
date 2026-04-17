"use client"

import { useEffect, useState } from "react"
import Navbar from "../../components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import PriceCard from "@/components/PriceCard"
import { Button } from "@/components/ui/button"

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchFavorites()
  }, [currentPage])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      // 🔹 Lấy danh sách ID sản phẩm yêu thích của user
      const favRes = await api.get("/favorites")
      const favoriteIds = favRes.data

      if (!favoriteIds.length) {
        setFavorites([])
        setTotalPages(1)
        return
      }

      const favIds = favoriteIds.map(f => f.productId)

      // 🔹 Gọi /products với danh sách IDs và phân trang
      const prodRes = await api.get("/products", {
        params: {
          ids: favIds.join(","),
          page: currentPage,
        },
      })

      const { data, totalPages } = prodRes.data
      const final = data.map(p => ({ ...p, isFavorite: true }))
      setFavorites(final)
      setTotalPages(totalPages)
    } catch (error) {
      console.error("❌ Lỗi khi tải danh sách yêu thích:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          Danh sách yêu thích
        </h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          </div>
        ) : favorites.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            Bạn chưa có sản phẩm nào trong danh sách yêu thích.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map(item => (
                <PriceCard key={item.id} item={item} />
              ))}
            </div>

            {/* ✅ Phân trang */}
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentPage === 1}
              >
                ← Trước
              </Button>
              <span className="text-muted-foreground">
                Trang {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={handleNext}
                disabled={currentPage === totalPages}
              >
                Sau →
              </Button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
