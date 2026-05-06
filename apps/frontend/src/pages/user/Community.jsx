"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Search, 
  Plus, 
  Image as ImageIcon, 
  Tag, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  PlusCircle,
  ExternalLink,
  Download,
  Users,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  X
} from "lucide-react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import PostCard from "@/components/PostCard";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export default function Community() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [images, setImages] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [trends, setTrends] = useState({ topGainers: [], topLosers: [] });
  const [dealers, setDealers] = useState([]);
  const [hotTab, setHotTab] = useState("day"); // "day" or "week"

  const imageInputRef = useRef(null);
  const textareaRef = useRef(null);

  const availableTags = ["Sầu riêng", "Lúa gạo", "Cà phê", "Hồ tiêu", "Thủy sản", "Kỹ thuật", "Giá cả"];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '32px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = scrollHeight > 32 ? `${scrollHeight}px` : '32px';
    }
  }, [newPost]);

  useEffect(() => {
    fetchPosts();
    fetchTrends();
    fetchDealers();
  }, [search]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("community:new_post", (post) => {
      setPosts((prev) => {
        if (prev.some((item) => item.id === post.id)) return prev;
        return [post, ...prev];
      });
    });

    socket.on("community:post_deleted", ({ id }) => {
      setPosts((prev) => prev.filter((post) => post.id !== id));
    });

    socket.on("community:post_updated", (post) => {
      setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)));
    });

    socket.on("community:like", ({ postId, userId: likerId }) => {
      // Don't double-count if it's the current user (they already updated locally)
      if (Number(likerId) === Number(user?.id)) return;
      
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post))
      );
    });

    socket.on("community:unlike", ({ postId, userId: unlikerId }) => {
      if (Number(unlikerId) === Number(user?.id)) return;

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likes: Math.max((post.likes || 1) - 1, 0) } : post
        )
      );
    });

    socket.on("community:comment_added", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, comments_count: (post.comments_count || 0) + 1 } : post
        )
      );
    });

    socket.on("community:comment_deleted", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, comments_count: Math.max((post.comments_count || 1) - 1, 0) } : post
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.get("/community/posts", {
        params: { search, limit: 20 },
      });
      setPosts(res.data.data || []);
    } catch (error) {
      console.error("Lỗi lấy posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const res = await api.get("/stats/trends");
      setTrends(res.data);
    } catch (error) {
      console.error("Lỗi lấy xu hướng:", error);
    }
  };

  const fetchDealers = async () => {
    try {
      const res = await api.get("/users/dealers");
      setDealers(res.data);
    } catch (error) {
      console.error("Lỗi lấy đại lý:", error);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handlePost = async () => {
    if (!newPost.trim() && images.length === 0) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // In a real app, you would upload images to a server/S3 first
      // and get back URLs. Here we'll simulate it for the UI.
      const formData = new FormData();
      formData.append("content", newPost);
      formData.append("tags", JSON.stringify(selectedTags));
      console.log("Gửi bài viết:", { content: newPost, tags: selectedTags, imageCount: images.length });
      if (images.length > 0) {
        images.forEach((img, i) => {
          formData.append("images", img.file);
        });
        console.log(`Đã thêm ${images.length} ảnh vào FormData`);
      }

      await api.post("/community/posts", formData);

      setNewPost("");
      setImages([]);
      setSelectedTags([]);
      setShowTagSelector(false);
      // Removed manual setPosts, letting socket handles it for consistency
    } catch (error) {
      console.error("Lỗi đăng bài:", error);
      alert("Không thể đăng bài lúc này. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        
        {/* Main Feed Column */}
        <div className="space-y-6">
          
          {/* Modernized Post Box */}
          <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-visible">
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border shadow-sm overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} className="h-full w-full object-cover" alt="Avatar" />
                  ) : (
                    <span className="text-gray-400 font-bold text-xs">{user?.name?.[0]}</span>
                  )}
                </div>
                
                {/* Textarea Area */}
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    placeholder={`Bạn đang nghĩ gì, ${user?.name?.split(' ').pop()}?`}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="w-full min-h-[60px] bg-transparent border-none p-0 text-base focus-visible:ring-0 placeholder:text-gray-400 resize-none scrollbar-hide"
                  />
                  
                  {/* Image Previews */}
                  {images.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2 no-scrollbar">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative h-20 w-20 rounded-xl overflow-hidden border shrink-0">
                          <img src={img.preview} className="h-full w-full object-cover" alt="Preview" />
                          <button 
                            onClick={() => setImages(images.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags Display */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedTags.map(tag => (
                        <Badge key={tag} className="bg-orange-50 text-orange-600 border-none px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          #{tag}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-orange-800" 
                            onClick={() => toggleTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Toolbar */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={imageInputRef}
                    onChange={handleImageChange}
                  />
                  <button 
                    onClick={() => imageInputRef.current.click()}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-2xl text-gray-600 bg-gray-50/80 hover:bg-green-50 hover:text-green-600 transition-all active:scale-95 border border-transparent hover:border-green-100"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[13px] font-black hidden sm:inline">Ảnh</span>
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setShowTagSelector(!showTagSelector)}
                      className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all active:scale-95 border ${
                        showTagSelector 
                          ? 'bg-orange-50 text-orange-600 border-orange-100' 
                          : 'bg-gray-50/80 text-gray-600 border-transparent hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100'
                      }`}
                    >
                      <Tag className="h-5 w-5" />
                      <span className="text-[13px] font-black hidden sm:inline">Thẻ</span>
                    </button>

                    {showTagSelector && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTagSelector(false)}></div>
                        <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-[24px] shadow-[0_25px_60px_rgba(0,0,0,0.2)] border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                          {/* Triangle Arrow (Top) */}
                          <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-gray-100 rotate-45 shadow-[-2px_-2px_2px_rgba(0,0,0,0.01)]"></div>
                          
                          <div className="relative z-10">
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-3 px-1">Chọn chủ đề</p>
                            
                            {/* Search Bar */}
                            <div className="flex items-center gap-2 mb-4 bg-gray-50/80 border border-gray-100 rounded-2xl px-4 py-2.5 transition-all focus-within:border-orange-200 focus-within:bg-white focus-within:shadow-sm">
                              <Search className="h-4 w-4 text-gray-400" />
                              <input 
                                type="text" 
                                placeholder="Tìm hoặc thêm thẻ mới..." 
                                className="bg-transparent border-none focus:ring-0 text-[13px] font-medium w-full p-0 placeholder:text-gray-400"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                              />
                            </div>

                            {/* Tag List */}
                            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                              {(tagSearch.trim() && !availableTags.some(t => t.toLowerCase() === tagSearch.toLowerCase())) && (
                                <button 
                                  onClick={() => { toggleTag(tagSearch); setTagSearch(""); }}
                                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-black text-orange-600 bg-orange-50/50 hover:bg-orange-50 transition-all border border-dashed border-orange-200 mb-2"
                                >
                                  + Tạo thẻ "#{tagSearch}"
                                </button>
                              )}
                              
                              <div className="grid grid-cols-1 gap-1">
                                {availableTags
                                  .filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()))
                                  .map(tag => {
                                    const isSelected = selectedTags.includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-between group ${
                                          isSelected 
                                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`${isSelected ? 'text-white/70' : 'text-orange-400'}`}>#</span>
                                          <span>{tag}</span>
                                        </div>
                                        {isSelected && <X className="h-4 w-4" />}
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>

                            {availableTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && !tagSearch.trim() && (
                              <div className="py-8 text-center">
                                <Tag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 font-bold italic">Chưa có thẻ nào</p>
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
                  {isSubmitting ? "Đang đăng..." : "Đăng bài"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feed */}
          <div className="space-y-6">
            {loadingPosts ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-400">Đang cập nhật bản tin...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="py-20 text-center bg-gray-50/50 rounded-3xl border border-dashed">
                <p className="text-gray-400 font-medium">Chưa có bài viết nào mới</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
                  onUpdate={(updated) => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
                />
              ))
            )}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Hot Posts Widget */}
          <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] bg-white rounded-3xl overflow-hidden">
            <CardHeader className="space-y-4 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  Bài viết nổi bật
                </CardTitle>
              </div>
              
              <div className="flex bg-gray-100/80 p-1 rounded-xl">
                <button 
                  onClick={() => setHotTab("day")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${hotTab === "day" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                  Ngày
                </button>
                <button 
                  onClick={() => setHotTab("week")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${hotTab === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                  Tuần
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-6">
              {(hotTab === "day" ? [
                { id: 1, title: "Kinh nghiệm bón phân cho Sầu Riêng mùa hạn mặn...", author: "Minh Trần", likes: 128, comments: 45 },
                { id: 2, title: "Giá cà phê hôm nay lập đỉnh mới tại Đắk Lắk", author: "Hòa Bình", likes: 95, comments: 22 },
                { id: 3, title: "Cảnh báo sâu đục thân trên diện rộng tại Tiền Giang", author: "Phòng Nông Nghiệp", likes: 88, comments: 18 }
              ] : [
                { id: 4, title: "Tổng kết mùa vụ lúa ST25: Năng suất vượt mong đợi", author: "Thanh Nam", likes: 450, comments: 112 },
                { id: 5, title: "Cẩm nang xuất khẩu nông sản sang thị trường Trung Quốc", author: "AgroAI Expert", likes: 320, comments: 89 },
                { id: 6, title: "Top 10 đại lý uy tín nhất khu vực Miền Tây", author: "Cộng Đồng", likes: 280, comments: 64 }
              ]).map((item, idx) => (
                <div key={item.id} className="group cursor-pointer">
                  <div className="flex gap-3 mb-1">
                    <span className="text-xs font-black text-gray-300 group-hover:text-primary transition-colors">0{idx + 1}</span>
                    <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pl-7">
                    <span className="text-[10px] font-bold text-gray-400">@{item.author}</span>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {item.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {item.comments}</span>
                    </div>
                  </div>
                  {idx < 2 && <div className="mt-3 border-b border-gray-50"></div>}
                </div>
              ))}
              <Button variant="ghost" className="w-full mt-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                Xem tất cả xu hướng
              </Button>
            </CardContent>
          </Card>

          {/* Top Dealers Widget */}
          <Card className="border-none shadow-[0_2px_12px_rgba(0,0,0,0.03)] bg-white rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Top Dealers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              {dealers.slice(0, 3).map((dealer) => (
                <div key={dealer.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform shadow-sm">
                      {dealer.avatar_url ? (
                        <img src={dealer.avatar_url} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-gray-400">{dealer.name?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 group-hover:text-primary transition-colors">{dealer.name}</p>
                      <div className="flex items-center gap-1">
                        <div className="flex text-[9px]">
                           {[1,2,3,4,5].map(i => <Star key={i} className="h-2 w-2 fill-orange-400 text-orange-400" />)}
                        </div>
                        <span className="text-[9px] font-bold text-gray-400">4.9 (2.1k)</span>
                      </div>
                    </div>
                  </div>
                  <button className="h-7 w-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all active:scale-90">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2 rounded-2xl text-[10px] font-black uppercase tracking-widest h-10 border-gray-100 hover:bg-gray-50 transition-all">
                Xem tất cả đại lý
              </Button>
            </CardContent>
          </Card>

          {/* Promotion Widget */}
          <Card className="bg-green-900 border-none shadow-lg overflow-hidden relative rounded-3xl">
            <CardContent className="p-8">
              <div className="absolute -right-6 -bottom-6 opacity-10">
                 <TrendingUp className="h-40 w-40 text-white" />
              </div>
              <div className="relative z-10 space-y-5">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <TrendingUp className="h-5 w-5 text-orange-400" />
                   </div>
                   <h4 className="text-white font-black text-base italic">Mùa vụ mới?</h4>
                </div>
                <p className="text-white/70 text-[13px] leading-relaxed font-medium">
                  Phân tích đất ngay hôm nay để tối ưu hóa sản lượng và giảm thiểu chi phí phân bón.
                </p>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-11 text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20">
                   Khám phá ngay
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
