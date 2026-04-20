"use client"

import { useEffect, useState } from "react"
import { Filter, PlusCircle, Search } from "lucide-react"
import { io } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { useAuth } from "@/context/AuthContext"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "")

export default function Community() {
  const { user } = useAuth()
  const token = localStorage.getItem("token")

  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState("")
  const [tags, setTags] = useState("")
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [search, setSearch] = useState("")
  const [filterMyPosts, setFilterMyPosts] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [search, filterMyPosts, user?.id])

  useEffect(() => {
    if (!token) return undefined

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    })

    socket.on("community:new_post", (post) => {
      setPosts((prev) => {
        if (prev.some((item) => item.id === post.id)) return prev
        return [post, ...prev]
      })
    })

    socket.on("community:post_deleted", ({ id }) => {
      setPosts((prev) => prev.filter((post) => post.id !== id))
    })

    socket.on("community:post_updated", (post) => {
      setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)))
    })

    socket.on("community:like", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post))
      )
    })

    socket.on("community:unlike", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likes: Math.max((post.likes || 1) - 1, 0) } : post
        )
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [token])

  const fetchPosts = async () => {
    setLoadingPosts(true)
    try {
      const res = await api.get("/community/posts", {
        params: {
          search,
          limit: 20,
        },
      })

      let list = res.data.data || []
      if (filterMyPosts && user?.id) {
        list = list.filter((post) => post.user_id === user.id)
      }
      setPosts(list)
    } catch (error) {
      console.error("Lỗi lấy posts:", error)
    } finally {
      setLoadingPosts(false)
    }
  }

  const handlePost = async () => {
    if (!newPost.trim()) return

    try {
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)

      const res = await api.post("/community/posts", {
        content: newPost,
        tags: tagList,
      })

      setPosts((prev) => {
        if (prev.some((item) => item.id === res.data.data.id)) return prev
        return [res.data.data, ...prev]
      })
      setNewPost("")
      setTags("")
    } catch (error) {
      console.error("Lỗi đăng bài:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />

      <main className="container mx-auto space-y-6 px-4 py-6 max-w-4xl">
        <div className="flex gap-3">
          <div className="flex w-full overflow-hidden rounded-lg border">
            <input
              type="text"
              placeholder="Tìm kiếm bài đăng bán sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 outline-none"
            />
            <button className="px-3 text-gray-600" type="button">
              <Search className="h-5 w-5" />
            </button>
          </div>

          <Button
            variant={filterMyPosts ? "default" : "outline"}
            onClick={() => setFilterMyPosts((prev) => !prev)}
          >
            <Filter className="mr-2 h-4 w-4" /> Bài của tôi
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Textarea
                placeholder="Đăng bài bán sản phẩm, chia sẻ nhu cầu mua bán..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
              />

              <input
                type="text"
                placeholder="Thẻ bài viết (VD: bán-cà-phê, sầu-riêng, giá-sỉ...)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              />

              <div className="flex justify-end">
                <Button onClick={handlePost}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Đăng bài
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadingPosts ? (
          <p className="py-6 text-center">Đang tải...</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={(postId) =>
                  setPosts((prev) => prev.filter((item) => item.id !== postId))
                }
                onUpdate={(updatedPost) =>
                  setPosts((prev) =>
                    prev.map((item) => (item.id === updatedPost.id ? updatedPost : item))
                  )
                }
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
