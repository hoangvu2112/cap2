import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ThumbsUp, MessageCircle, MoreVertical, Send, Sparkles, Share2, Loader2 } from "lucide-react";
import api, { BACKEND_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

function getInitials(name = "") {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export default function CommentModal({ post, onClose, onCommentCountChange }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const processedCommentIds = useRef(new Set());
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [liked, setLiked] = useState(post.liked || false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [viewerImage, setViewerImage] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ⭐ ESC Key Fix
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (viewerImage) {
          e.preventDefault();
          e.stopPropagation();
          setViewerImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, viewerImage]);

  useEffect(() => {
    setComments([]);
    setOffset(0);
    setHasMore(true);
    fetchComments(0);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    const handleCommentAdded = ({ postId, comment }) => {
      if (Number(postId) === Number(post.id)) {
        setComments((prev) => {
          if (prev.some((item) => item.id === comment.id)) return prev;
          
          // ⭐ Chống đếm trùng tuyệt đối bằng Set
          if (!processedCommentIds.current.has(comment.id)) {
            processedCommentIds.current.add(comment.id);
            onCommentCountChange?.(prevCount => prevCount + 1);
            setCommentsCount(prevCount => prevCount + 1);
          }
          
          return [comment, ...prev];
        });
      }
    };

    const handleCommentUpdated = ({ postId, comment }) => {
      if (Number(postId) !== Number(post.id)) return;
      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id ? { ...item, ...comment } : item,
        ),
      );
    };

    const handleCommentDeleted = ({ postId, commentId }) => {
      if (Number(postId) !== Number(post.id)) return;
      setComments((prev) => {
        const isExisted = prev.some((item) => item.id === commentId);
        if (isExisted) {
          onCommentCountChange?.(prevCount => Math.max(0, prevCount - 1));
          setCommentsCount(prevCount => Math.max(0, prevCount - 1));
        }
        return prev.filter((item) => item.id !== commentId);
      });
    };

    socket.on("community:comment_added", handleCommentAdded);
    socket.on("community:comment_updated", handleCommentUpdated);
    socket.on("community:comment_deleted", handleCommentDeleted);

    // ⭐ Socket Likes Fix
    socket.on("community:like", ({ postId, userId: likerId }) => {
      if (Number(postId) === Number(post.id) && Number(likerId) !== Number(user?.id)) {
        setLikesCount(prev => prev + 1);
      }
    });

    socket.on("community:unlike", ({ postId, userId: unlikerId }) => {
      if (Number(postId) === Number(post.id) && Number(unlikerId) !== Number(user?.id)) {
        setLikesCount(prev => Math.max(0, prev - 1));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [post.id, token]);

  const fetchComments = async (o = offset) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/community/posts/${post.id}/comments`, {
        params: { limit: 10, offset: o },
      });
      const newBatch = res.data.data || [];
      if (o === 0) {
        setComments(newBatch);
      } else {
        setComments((prev) => [...prev, ...newBatch]);
      }
      setHasMore(newBatch.length === 10);
      setOffset(o + newBatch.length);
    } catch (err) {
      console.error("fetch comments", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (isGeneratingAI) return;
    setIsGeneratingAI(true);
    try {
      const res = await api.post("/community/ai-generate-comment", {
        postContent: post.content
      });
      if (res.data && res.data.data) {
        setNewComment(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi AI Generate:", err);
      alert("AI hiện đang bận, vui lòng thử lại sau");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const content = newComment.trim();
      const res = await api.post(`/community/posts/${post.id}/comments`, {
        content,
      });
      
      const commentData = res.data.data || res.data.comment || {
        ...res.data,
        author_name: user.name,
        avatar_url: user.avatar_url,
        created_at: new Date().toISOString(),
        user_id: user.id
      };

      if (commentData && commentData.id) {
        setComments((prev) => {
          if (prev.some(c => c.id === commentData.id)) return prev;
          
          // ⭐ Đánh dấu đã đếm ID này
          if (!processedCommentIds.current.has(commentData.id)) {
            processedCommentIds.current.add(commentData.id);
            onCommentCountChange?.(prevCount => prevCount + 1);
            setCommentsCount(prevCount => prevCount + 1);
          }
          
          return [commentData, ...prev];
        });
      }
      
      setNewComment("");
    } catch (err) {
      console.error("Lỗi gửi bình luận:", err);
      alert("Không thể gửi bình luận");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      await api.put(`/community/posts/${post.id}/comments/${commentId}`, {
        content: editingContent.trim(),
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, content: editingContent.trim() } : c,
        ),
      );
      setEditingCommentId(null);
    } catch (err) {
      console.error("edit comment", err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm("Xoá bình luận này?")) return;
    try {
      await api.delete(`/community/posts/${post.id}/comments/${commentId}`);
      setComments((prev) => {
        const isExisted = prev.some(c => c.id === commentId);
        if (isExisted) {
          onCommentCountChange?.(prevCount => Math.max(0, prevCount - 1));
          setCommentsCount(prevCount => Math.max(0, prevCount - 1));
        }
        return prev.filter((c) => c.id !== commentId);
      });
    } catch (err) {
      console.error("delete comment", err);
    }
  };

  const toggleLike = async () => {
    try {
      const res = await api.post(`/community/posts/${post.id}/like`);
      setLiked(res.data.liked);
      setLikesCount((prev) => prev + (res.data.liked ? 1 : -1));
    } catch (err) {
      console.error("like error", err);
    }
  };

  const openViewer = (idx, images) => {
    setViewerIndex(idx);
    setViewerImage(images);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    if (viewerIndex < viewerImage.length - 1) setViewerIndex(v => v + 1);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (viewerIndex > 0) setViewerIndex(v => v - 1);
  };

  const getFullUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !isLoading) {
      fetchComments(offset);
    }
  };

  const postImages = (() => {
    try {
      if (!post.image_url) return [];
      const parsed = JSON.parse(post.image_url);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return post.image_url ? [post.image_url] : [];
    }
  })();

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12 overflow-hidden">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-white/10 backdrop-blur-[1px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative w-full max-w-[550px] h-[90vh] sm:h-fit max-h-[85vh] bg-white text-gray-900 rounded-[20px] shadow-[0_12px_28px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-6 py-3 border-b border-gray-200 bg-white z-20">
          <h2 className="font-bold text-[17px] text-gray-900 tracking-tight">Bài viết của {post.author_name}</h2>
          <button 
            onClick={onClose} 
            className="absolute right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all text-gray-600 shadow-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white" onScroll={handleScroll}>
          <div className="p-5 border-b border-gray-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
                {post.avatar_url ? <img src={post.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-orange-600 font-bold">{post.author_name?.charAt(0)}</span>}
              </div>
              <div>
                <p className="font-black text-sm">{post.author_name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>
            
            {/* ⭐ Render Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {post.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="bg-gray-50 text-gray-500 font-bold border-none px-2.5 py-1 text-[10px] max-w-[200px]"
                  >
                    <span className="truncate">#{tag}</span>
                  </Badge>
                ))}
              </div>
            )}
            
            {postImages.length > 0 && (
              <div className="mt-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                {postImages.length === 1 ? (
                  <div className="h-64 sm:h-80 w-full cursor-zoom-in hover:opacity-95 transition-opacity" onClick={() => openViewer(0, postImages)}>
                    <img src={getFullUrl(postImages[0])} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {postImages.slice(0, 4).map((img, i) => {
                      const isLastAndMore = i === 3 && postImages.length > 4;
                      return (
                        <div key={i} className="relative overflow-hidden cursor-zoom-in hover:opacity-90 transition-all h-40 sm:h-48" onClick={() => openViewer(i, postImages)}>
                          <img src={getFullUrl(img)} alt="" className="w-full h-full object-cover" />
                          {isLastAndMore && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                              <span className="text-2xl font-black">+{postImages.length - 4}</span>
                              <span className="text-[10px] font-black uppercase tracking-wider">Xem thêm</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{commentsCount} bình luận</span>
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-transparent text-[11px] font-black uppercase text-gray-400 outline-none"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </div>

            <div className="space-y-5">
              {[...comments]
                .sort((a, b) => {
                  const dateA = new Date(a.created_at || Date.now());
                  const dateB = new Date(b.created_at || Date.now());
                  return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
                })
                .map((c) => (
                  <div key={c.id} className="flex gap-3 group">
                    <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-gray-400 font-bold text-xs">{c.author_name?.charAt(0)}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <div className="bg-gray-100/70 rounded-2xl px-4 py-2.5 inline-block max-w-[90%]">
                          <p className="font-black text-xs text-gray-900 mb-0.5">{c.author_name}</p>
                          {editingCommentId === c.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingCommentId(null)} className="text-[10px] font-black uppercase">Huỷ</button>
                                <button onClick={() => handleSaveEdit(c.id)} className="text-[10px] font-black uppercase text-orange-600">Lưu</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[14px] text-gray-700 leading-snug">{c.content}</p>
                          )}
                        </div>

                        {(c.user_id === user?.id || user?.role === "admin") && (
                          <div className="relative">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="mt-1 p-1.5 text-gray-400 hover:text-gray-900 transition-all rounded-full hover:bg-gray-100 opacity-60 hover:opacity-100 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[1000] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                <DropdownMenuItem onClick={() => { setEditingCommentId(c.id); setEditingContent(c.content); }} className="font-bold text-xs">Chỉnh sửa</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteComment(c.id)} className="font-bold text-xs text-red-600">Xoá bình luận</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 px-2">
                        <span className="text-[10px] font-bold text-gray-400">{c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: vi }) : "Vừa xong"}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {hasMore && (
              <button 
                onClick={() => fetchComments(offset)} 
                disabled={isLoading}
                className="w-full py-2 text-[11px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Xem thêm bình luận"}
              </button>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-end gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-gray-400 font-bold text-xs">{user?.name?.charAt(0)}</span>}
            </div>
            <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-2 focus-within:bg-white focus-within:border-orange-200 transition-all shadow-sm">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết bình luận..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-700 resize-none max-h-32 py-1 custom-scrollbar"
                rows={1}
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-4 text-gray-400">
                  <button 
                    className={`hover:text-orange-600 transition-colors flex items-center gap-1.5 ${isGeneratingAI ? 'animate-pulse text-orange-500' : ''}`} 
                    title="Gợi ý AI"
                    onClick={handleAIGenerate}
                    disabled={isGeneratingAI}
                  >
                    {isGeneratingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">AI Gợi ý</span>
                  </button>
                </div>
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isSubmitting}
                  className="text-orange-600 font-black text-sm hover:text-orange-700 disabled:text-gray-300 transition-colors"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gửi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {viewerImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black flex items-center justify-center select-none overflow-hidden"
            onClick={() => setViewerImage(null)}
          >
            <button className="absolute top-5 left-5 z-[10000] bg-black/40 text-white p-2.5 rounded-full border border-white/10" onClick={() => setViewerImage(null)}>
              <X className="h-6 w-6" />
            </button>
            <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
              <img src={getFullUrl(viewerImage[viewerIndex])} alt="" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
              {viewerImage.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 p-3 rounded-full bg-black/20 text-white hover:bg-black/40"><X className="rotate-90" /></button>
                  <button onClick={nextImage} className="absolute right-4 p-3 rounded-full bg-black/20 text-white hover:bg-black/40"><X className="-rotate-90" /></button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  , document.body);
}
