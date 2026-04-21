import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ThumbsUp, MessageCircle, MoreVertical } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
// import { socket } from "@/socket";

import { useAuth } from "../context/AuthContext";
// const socket = io(import.meta.env.VITE_API_URL);
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000");

// helper initials (giữ như bạn có)
function getInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function formatCommentAge(value) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y`;
}

export default function CommentModal({ post, onClose, onCommentCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes ?? 0);
  const [sortOrder, setSortOrder] = useState("newest");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  const LIMIT = 8;

  // lock body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // initially load comments (latest first)
  useEffect(() => {
    console.log("🔌 Connected?", socket.connected);
    socket.on("connect", () => console.log("✅ Socket connected:", socket.id));

    setComments([]);
    setOffset(0);
    setHasMore(true);
    setEditingCommentId(null);
    setEditingContent("");
    onCommentCountChange?.(post.comments_count ?? 0);

    fetchComments(0);

    const fetchLikeStatus = async () => {
      try {
        const res = await api.get(`/community/posts/${post.id}/like-status`);
        setIsLiked(res.data.liked);
        setLikesCount(res.data.likes); // FIX
      } catch { }
    };
    fetchLikeStatus();
    console.log("📡 Subscribing to comment_added for post:", post.id);
    // ===== COMMENT SOCKET =====
    const handleCommentAdded = ({ postId, comment }) => {
      console.log("🔥 nhận comment realtime:", postId, comment);

      if (Number(postId) === Number(post.id)) {
        setComments((prev) => {
          if (prev.some((item) => item.id === comment.id)) return prev;
          onCommentCountChange?.(prev.length + 1);
          return [...prev, comment];
        });
      }
    };
    socket.onAny((event, data) => {
      console.log("📥 nhận event bất kỳ:", event, data);
    });

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
        const next = prev.filter((item) => item.id !== commentId);
        if (next.length !== prev.length) {
          onCommentCountChange?.(next.length);
        }
        return next;
      });
    };

    socket.on("community:comment_added", handleCommentAdded);
    socket.on("community:comment_updated", handleCommentUpdated);
    socket.on("community:comment_deleted", handleCommentDeleted);

    return () => {
      socket.off("community:comment_added", handleCommentAdded);
      socket.off("community:comment_updated", handleCommentUpdated);
      socket.off("community:comment_deleted", handleCommentDeleted);
    };
  }, [post.id]);

  const fetchComments = async (o = offset) => {
    try {
      const res = await api.get(`/community/posts/${post.id}/comments`, {
        params: { limit: LIMIT, offset: o },
      });
      const data = res.data.data || [];
      if (data.length < LIMIT) setHasMore(false);
      // API returns ORDER BY id DESC so it's newest->oldest. We want oldest->newest in thread,
      // but for FB-like feed show newest at bottom; here we'll push in order returned.
      setComments((prev) => {
        // avoid duplicates
        const ids = new Set(prev.map((c) => c.id));
        const filtered = data.filter((c) => !ids.has(c.id));
        return [...prev, ...filtered];
      });
      setOffset(o + LIMIT);
    } catch (err) {
      console.error("fetch comments", err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const content = newComment.trim();
      const res = await api.post(`/community/posts/${post.id}/comments`, {
        content,
      });

      const createdComment = res.data.data;
      setComments((prev) => {
        if (prev.some((item) => item.id === createdComment.id)) return prev;
        onCommentCountChange?.(prev.length + 1);
        return [...prev, createdComment];
      });
      setNewComment("");
    } catch (err) {
      console.error("add comment", err);
    }
  };

  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      const res = await api.put(
        `/community/posts/${post.id}/comments/${commentId}`,
        {
          content: editingContent.trim(),
        },
      );

      const updatedComment = res.data.data;
      setComments((prev) =>
        prev.map((item) =>
          item.id === commentId ? { ...item, ...updatedComment } : item,
        ),
      );
      setEditingCommentId(null);
      setEditingContent("");
    } catch (err) {
      console.error("edit comment", err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm("Bạn chắc chắn muốn xoá bình luận này?")) return;

    try {
      await api.delete(`/community/posts/${post.id}/comments/${commentId}`);
      setComments((prev) => {
        const next = prev.filter((item) => item.id !== commentId);
        onCommentCountChange?.(next.length);
        return next;
      });

      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingContent("");
      }
    } catch (err) {
      console.error("delete comment", err);
    }
  };

  const handleToggleLike = async () => {
    try {
      const res = await api.post(`/community/posts/${post.id}/like`);
      const liked = res.data.liked;

      setIsLiked(liked);
      setLikesCount((prev) => prev + (liked ? 1 : -1));
    } catch (err) {
      console.error("toggle like", err);
    }
  };

  const COLORS = [
    "bg-purple-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];

  const [randomColor] = useState(() => {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  });

  // Render portal to body so overlay not constrained by parent stacking context
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div
        className="relative w-full max-w-4xl h-[90vh] mt-8 bg-[#242526] text-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center text-sm font-semibold overflow-hidden">
              {post.avatar_url ? (
                <img
                  src={post.avatar_url}
                  alt={post.author_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(post.author_name)
              )}
            </div>
            <div>
              <div className="font-semibold">{post.author_name}</div>
              <div className="text-xs text-gray-300">
                {new Date(post.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* main content area: left content + right comments (FB desktop has left big content + right comments sometimes).
            For simplicity: top area shows content, below shows comments in a scrollable region.
        */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* post content */}
          <div className="px-6 py-4 border-b border-gray-700">
            <div
              className={`${randomColor} rounded-lg p-6 text-center text-xl md:text-2xl font-bold text-white`}
            >
              {post.content}
            </div>

            {/* reactions row */}
            <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{post.likes ?? 0}</span>
                </div>
                <div>
                  {comments.length || post.comments_count || 0} bình luận
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleLike}
                  className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-white/5 ${isLiked ? "text-blue-400" : ""
                    }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                  {isLiked ? "Đã thích" : "Thích"}
                </button>

                <button className="flex items-center gap-2 px-3 py-1 rounded hover:bg-white/5">
                  <MessageCircle className="h-4 w-4" /> Bình luận
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end mb-2">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-[#3a3b3c] text-sm px-2 py-1 rounded border border-gray-600"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>

          {/* comments list area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* show comments */}
            {comments.length === 0 ? (
              <div className="text-gray-300 text-center mt-8">
                Chưa có bình luận nào
              </div>
            ) : (
              <div className="flex flex-col-reverse space-y-4 space-y-reverse">
                {/* reverse so newest appear at bottom if you prefer; adjust as needed */}
                {[...comments]
                  .sort((a, b) => {
                    if (sortOrder === "newest")
                      return new Date(b.created_at) - new Date(a.created_at);
                    return new Date(a.created_at) - new Date(b.created_at);
                  })
                  .map((c) => (
                    <div key={c.id} className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden text-sm font-semibold shrink-0">
                        {c.avatar_url ? (
                          <img
                            src={c.avatar_url}
                            alt={c.author_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitials(c.author_name)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="max-w-[85%] rounded-[20px] bg-[#3a3b3c] px-4 py-2.5">
                            <div className="font-semibold text-[13px] leading-tight text-white">
                              {c.author_name}
                            </div>
                            {editingCommentId === c.id ? (
                              <div className="mt-2 space-y-2">
                                <input
                                  type="text"
                                  value={editingContent}
                                  onChange={(e) =>
                                    setEditingContent(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEdit(c.id);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingCommentId(null);
                                      setEditingContent("");
                                    }
                                  }}
                                  className="w-full rounded-md border border-gray-600 bg-[#242526] px-3 py-2 text-sm text-white outline-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingContent("");
                                    }}
                                  >
                                    Huỷ
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(c.id)}
                                  >
                                    Lưu
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 text-[15px] leading-snug text-gray-100">
                                {c.content}
                              </div>
                            )}
                          </div>

                          {(c.user_id === user?.id ||
                            user?.role === "admin") && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="mt-1 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem
                                    onClick={() => handleStartEdit(c)}
                                  >
                                    Chỉnh sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDeleteComment(c.id)}
                                  >
                                    Xoá
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                        </div>

                        <div className="mt-1 flex items-center gap-4 px-3 text-xs font-semibold text-gray-400">
                          <span>{formatCommentAge(c.created_at)}</span>
                          <button
                            type="button"
                            className="transition hover:text-white"
                          >
                            Thích
                          </button>
                          <button
                            type="button"
                            className="transition hover:text-white"
                          >
                            Trả lời
                          </button>
                          {editingCommentId !== c.id && (
                            <span className="text-[11px] font-normal text-gray-500">
                              {new Date(c.created_at).toLocaleString("vi-VN")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={() => fetchComments()}
                  className="px-4 py-2 border border-gray-600 rounded hover:bg-white/5"
                >
                  Xem thêm bình luận
                </button>
              </div>
            )}
          </div>

          {/* input area fixed bottom of panel */}
          <div className="px-4 py-3 border-t border-gray-700 bg-[#181819]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden text-sm font-semibold">
                {/* current user avatar: nếu có context user, bạn có thể thay */}
                {/* fallback: post author avatar for now */}
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="me"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(user.name)
                )}
              </div>

              <input
                type="text"
                placeholder="Viết bình luận..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                className="flex-1 rounded-full px-4 py-2 bg-[#242526] border border-gray-700 outline-none focus:ring-0 text-sm"
              />

              <Button onClick={handleAddComment}>Gửi</Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
