"use client"

import { useEffect, useRef, useState } from "react"
import { io } from "socket.io-client"
import { Search, Image as ImageIcon, Tag, Users, MessageCircle, Sparkles, ThumbsUp, X } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import PostCard from "@/components/PostCard"
import { useAuth } from "../../context/AuthContext"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "")

export default function Community() {
  const { user } = useAuth()
  const token = localStorage.getItem("token")

  const [posts, setPosts] = useState([])
  const [featuredPosts, setFeaturedPosts] = useState([])
  const [dealers, setDealers] = useState([])
  const [newPost, setNewPost] = useState("")
  const [images, setImages] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [tagSearch, setTagSearch] = useState("")
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const imageInputRef = useRef(null)
  const textareaRef = useRef(null)

  const availableTags = ["Sß║ºu ri├¬ng", "L├║a gß║ío", "C├á ph├¬", "Hß╗ô ti├¬u", "Thß╗ºy sß║ún", "Kß╗╣ thuß║¡t", "Gi├í cß║ú"]

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = "32px"
    const scrollHeight = textareaRef.current.scrollHeight
    textareaRef.current.style.height = scrollHeight > 32 ? `${scrollHeight}px` : "32px"
  }, [newPost])

  useEffect(() => {
    fetchPosts()
    fetchFeaturedPosts()
    fetchDealers()
  }, [])

  useEffect(() => {
    if (!token) return undefined

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    })

    socket.on("community:new_post", (post) => {
      setPosts((prev) => (prev.some((item) => item.id === post.id) ? prev : [post, ...prev]))
    })

    socket.on("community:post_deleted", ({ id }) => {
      setPosts((prev) => prev.filter((post) => post.id !== id))
    })

    socket.on("community:post_updated", (post) => {
      setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)))
    })

    socket.on("community:like", ({ postId, userId: likerId }) => {
      if (Number(likerId) === Number(user?.id)) return
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post)))
    })

    socket.on("community:unlike", ({ postId, userId: unlikerId }) => {
      if (Number(unlikerId) === Number(user?.id)) return
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likes: Math.max((post.likes || 1) - 1, 0) } : post)))
    })

    socket.on("community:comment_added", ({ postId }) => {
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_count: (post.comments_count || 0) + 1 } : post)))
    })

    socket.on("community:comment_deleted", ({ postId }) => {
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_count: Math.max((post.comments_count || 1) - 1, 0) } : post)))
    })

    return () => {
      socket.disconnect()
    }
  }, [token, user?.id])

  const fetchPosts = async () => {
    setLoadingPosts(true)
    try {
      const res = await api.get("/community/posts", { params: { limit: 20 } })
      setPosts(res.data.data || [])
    } catch (error) {
      console.error("Lß╗ùi lß║Ñy posts:", error)
    } finally {
      setLoadingPosts(false)
    }
  }

  const fetchFeaturedPosts = async () => {
    try {
      const res = await api.get("/community/posts/featured", { params: { limit: 5 } })
      setFeaturedPosts(res.data?.data || [])
    } catch (error) {
      console.error("Lß╗ùi lß║Ñy b├ái viß║┐t nß╗òi bß║¡t:", error)
    }
  }

  const fetchDealers = async () => {
    try {
      const res = await api.get("/users/dealers")
      setDealers(res.data || [])
    } catch (error) {
      console.error("Lß╗ùi lß║Ñy ─æß║íi l├╜:", error)
    }
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = Math.max(5 - images.length, 0)
    const allowedFiles = files.slice(0, remainingSlots)

    if (allowedFiles.length < files.length) {
      alert("Mß╗ùi b├ái viß║┐t chß╗ë ─æ╞░ß╗úc ─æ├¡nh k├¿m tß╗æi ─æa 5 ß║únh.")
    }

    setImages((prev) => [
      ...prev,
      ...allowedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      })),
    ])

    e.target.value = ""
  }

  const removeImage = (index) => {
    setImages((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  const handlePost = async () => {
    if (!newPost.trim() && images.length === 0) return
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("content", newPost)
      formData.append("tags", JSON.stringify(selectedTags))
      images.forEach((img) => formData.append("images", img.file))

      await api.post("/community/posts", formData)

      setNewPost("")
      setImages([])
      setSelectedTags([])
      setShowTagSelector(false)
    } catch (error) {
      console.error("Lß╗ùi ─æ─âng b├ái:", error)
      alert("Kh├┤ng thß╗â ─æ─âng b├ái l├║c n├áy. Vui l├▓ng thß╗¡ lß║íi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-visible">
              <CardContent className="p-4 space-y-4">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border shadow-sm overflow-hidden">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} className="h-full w-full object-cover" alt="Avatar" />
                    ) : (
                      <span className="text-gray-400 font-bold text-xs">{user?.name?.[0]}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <Textarea
                      ref={textareaRef}
                      placeholder={`Bß║ín ─æang ngh─⌐ g├¼, ${user?.name?.split(" ").pop()}?`}
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="w-full min-h-[60px] bg-transparent border-none p-0 text-base focus-visible:ring-0 placeholder:text-gray-400 resize-none scrollbar-hide"
                    />

                    {images.length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-2 no-scrollbar">
                        {images.map((img, idx) => (
                          <div key={idx} className="relative h-20 w-20 rounded-xl overflow-hidden border shrink-0">
                            <img src={img.preview} className="h-full w-full object-cover" alt="Preview" />
                            <button
                              onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedTags.map((tag) => (
                          <Badge key={tag} className="bg-orange-50 text-orange-600 border-none px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            #{tag}
                            <X className="h-3 w-3 cursor-pointer hover:text-orange-800" onClick={() => toggleTag(tag)} />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1">
                    <input type="file" multiple accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageChange} />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-2.5 px-4 py-2 rounded-2xl text-gray-600 bg-gray-50/80 hover:bg-green-50 hover:text-green-600 transition-all active:scale-95 border border-transparent hover:border-green-100"
                    >
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-[13px] font-black hidden sm:inline">ß║ónh</span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setShowTagSelector((prev) => !prev)}
                        className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all active:scale-95 border ${
                          showTagSelector
                            ? "bg-orange-50 text-orange-600 border-orange-100"
                            : "bg-gray-50/80 text-gray-600 border-transparent hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100"
                        }`}
                      >
                        <Tag className="h-5 w-5" />
                        <span className="text-[13px] font-black hidden sm:inline">Thß║╗</span>
                      </button>

                      {showTagSelector && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowTagSelector(false)} />
                          <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-[24px] shadow-[0_25px_60px_rgba(0,0,0,0.2)] border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-gray-100 rotate-45 shadow-[-2px_-2px_2px_rgba(0,0,0,0.01)]" />

                            <div className="relative z-10">
                              <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-3 px-1">Chß╗ìn chß╗º ─æß╗ü</p>

                              <div className="flex items-center gap-2 mb-4 bg-gray-50/80 border border-gray-100 rounded-2xl px-4 py-2.5 transition-all focus-within:border-orange-200 focus-within:bg-white focus-within:shadow-sm">
                                <Search className="h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="T├¼m hoß║╖c th├¬m thß║╗ mß╗¢i..."
                                  className="bg-transparent border-none focus:ring-0 text-[13px] font-medium w-full p-0 placeholder:text-gray-400"
                                  value={tagSearch}
                                  onChange={(e) => setTagSearch(e.target.value)}
                                />
                              </div>

                              <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                {tagSearch.trim() && !availableTags.some((tag) => tag.toLowerCase() === tagSearch.toLowerCase()) && (
                                  <button
                                    onClick={() => {
                                      toggleTag(tagSearch)
                                      setTagSearch("")
                                    }}
                                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-black text-orange-600 bg-orange-50/50 hover:bg-orange-50 transition-all border border-dashed border-orange-200 mb-2"
                                  >
                                    + Tß║ío thß║╗ "#{tagSearch}"
                                  </button>
                                )}

                                <div className="grid grid-cols-1 gap-1">
                                  {availableTags
                                    .filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase()))
                                    .map((tag) => {
                                      const isSelected = selectedTags.includes(tag)
                                      return (
                                        <button
                                          key={tag}
                                          onClick={() => toggleTag(tag)}
                                          className={`w-full text-left px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-between group ${
                                            isSelected ? "bg-orange-600 text-white shadow-lg shadow-orange-200" : "text-gray-600 hover:bg-gray-50"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className={`${isSelected ? "text-white/70" : "text-orange-400"}`}>#</span>
                                            <span>{tag}</span>
                                          </div>
                                          {isSelected && <X className="h-4 w-4" />}
                                        </button>
                                      )
                                    })}
                                </div>
                              </div>

                              {availableTags.filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && !tagSearch.trim() && (
                                <div className="py-8 text-center">
                                  <Tag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                  <p className="text-xs text-gray-400 font-bold italic">Ch╞░a c├│ thß║╗ n├áo</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handlePost}
                    disabled={isSubmitting || (!newPost.trim() && images.length === 0)}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-6 h-10 font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? "─Éang ─æ─âng..." : "─É─âng b├ái"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {loadingPosts ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm font-medium text-gray-400">─Éang cß║¡p nhß║¡t bß║ún tin...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="py-20 text-center bg-gray-50/50 rounded-3xl border border-dashed">
                  <p className="text-gray-400 font-medium">Ch╞░a c├│ b├ái viß║┐t n├áo mß╗¢i</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
                    onUpdate={(updated) => setPosts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] bg-white rounded-3xl overflow-hidden">
              <CardHeader className="space-y-4 px-5 pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    B├ái viß║┐t nß╗òi bß║¡t
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-6">
                {featuredPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ch╞░a c├│ b├ái viß║┐t nß╗òi bß║¡t.</p>
                ) : (
                  featuredPosts.map((item, idx) => (
                    <div key={item.id} className="group cursor-pointer">
                      <div className="flex gap-3 mb-1">
                        <span className="text-xs font-black text-gray-300 group-hover:text-primary transition-colors">0{idx + 1}</span>
                        <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{item.content}</p>
                      </div>
                      <div className="flex items-center justify-between pl-7">
                        <span className="text-[10px] font-bold text-gray-400">@{item.author_name}</span>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> {item.likes || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" /> {item.comments_count || 0}
                          </span>
                        </div>
                      </div>
                      {idx < 2 && <div className="mt-3 border-b border-gray-50" />}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] bg-white rounded-3xl overflow-hidden">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Danh s├ích ─Éß║íi l├╜
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                {dealers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ch╞░a c├│ ─æß║íi l├╜ n├áo.</p>
                ) : (
                  dealers.slice(0, 5).map((dealer) => (
                    <div key={dealer.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm shrink-0">
                          {dealer.avatar_url ? (
                            <img src={dealer.avatar_url} className="h-full w-full object-cover" alt={dealer.name} />
                          ) : (
                            <span className="text-xs font-black text-gray-400">{dealer.name?.[0]}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 truncate">{dealer.name}</p>
                          <p className="text-[10px] font-medium text-gray-400 truncate">{dealer.region || "Ch╞░a c├│ khu vß╗▒c"}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700 border-none shrink-0">
                        {dealer.status === "active" ? "─Éang hoß║ít ─æß╗Öng" : dealer.status || "Ch╞░a r├╡"}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
