"use client"

import { useEffect, useMemo, useState } from "react"
import { Newspaper, ExternalLink } from "lucide-react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function normalizeExternalUrl(rawUrl) {
  const url = (rawUrl || "").trim()
  if (!url || url === "#") return null
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export default function News() {
  const [newsList, setNewsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true)
      try {
        const res = await api.get("/news")
        setNewsList(Array.isArray(res.data) ? res.data : [])
      } catch (error) {
        console.error("❌ Lỗi tải tin tức người dùng:", error)
        setNewsList([])
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  const filteredNews = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return newsList
    return newsList.filter((item) => {
      const title = item.title?.toLowerCase() || ""
      const content = item.content?.toLowerCase() || ""
      const source = item.source?.toLowerCase() || ""
      return title.includes(q) || content.includes(q) || source.includes(q)
    })
  }, [newsList, query])

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Newspaper className="w-7 h-7 text-primary" />
          Tin tức thị trường
        </h1>
        <p className="text-muted-foreground mt-1">
          Cập nhật các bài viết đã xuất bản từ hệ thống AgriTrend.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, nội dung, nguồn..."
          />
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center py-10 text-muted-foreground">Đang tải tin tức...</p>
      ) : filteredNews.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">Chưa có tin tức phù hợp.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNews.map((news) => (
            <Card key={news.id} className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{news.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {news.content ? (
                  <p className="text-sm text-muted-foreground line-clamp-4">{news.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Chưa có nội dung chi tiết.</p>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Nguồn: {news.source || "AgriTrend"}</p>
                  <p>
                    Ngày đăng:{" "}
                    {news.published_at
                      ? new Date(news.published_at).toLocaleDateString("vi-VN")
                      : "Chưa xuất bản"}
                  </p>
                </div>

                {normalizeExternalUrl(news.url) && (
                  <a
                    href={normalizeExternalUrl(news.url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                    title={normalizeExternalUrl(news.url)}
                  >
                    {normalizeExternalUrl(news.url)}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
