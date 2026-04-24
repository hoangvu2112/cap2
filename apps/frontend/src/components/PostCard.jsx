import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThumbsUp, MessageCircle, Share2, Sparkles, LineChart, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import api, { BACKEND_URL } from "@/lib/api";
import { useAuth } from "../context/AuthContext"
import CommentModal from "@/components/CommentModal";
import { MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion";
import EditPostModal from "@/components/EditPostModal";


export default function PostCard({ post, onDelete, onUpdate }) {
    const { user } = useAuth();
    const [showComments, setShowComments] = useState(false);
    const [likes, setLikes] = useState(post.likes || 0);
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
    const [liked, setLiked] = useState(post.liked || false);
    const [showEdit, setShowEdit] = useState(false);
    const [viewerImage, setViewerImage] = useState(null) // List of URLs
    const [viewerIndex, setViewerIndex] = useState(0)

    // ⭐ Fix: Define postImages (it was used but not defined)
    const postImages = (() => {
        try {
            if (!post.image_url) return [];
            if (Array.isArray(post.image_url)) return post.image_url;
            return JSON.parse(post.image_url);
        } catch (e) {
            console.error("Lỗi parse image_url:", e);
            return [];
        }
    })();

    const openViewer = (index, urls) => {
        setViewerIndex(index)
        setViewerImage(urls)
    }

    const nextImage = (e) => {
        e.stopPropagation()
        if (viewerImage && viewerIndex < viewerImage.length - 1) {
            setViewerIndex(prev => prev + 1)
        }
    }

    const prevImage = (e) => {
        e.stopPropagation()
        if (viewerImage && viewerIndex > 0) {
            setViewerIndex(prev => prev - 1)
        }
    }

    const getFullUrl = (url) => url?.startsWith('http') ? url : `${BACKEND_URL}${url?.startsWith('/') ? '' : '/'}${url}`

    // ⭐ ESC Key Fix
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && viewerImage) {
                e.preventDefault();
                e.stopPropagation();
                setViewerImage(null);
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [viewerImage]);

    // ⭐ Prop Sync Fix
    useEffect(() => {
        setLikes(post.likes || 0);
        setCommentsCount(post.comments_count || 0);
        setLiked(post.liked || false);
    }, [post.likes, post.comments_count, post.liked]);


    // ⭐ LIKE
    const toggleLike = async () => {
        try {
            const res = await api.post(`/community/posts/${post.id}/like`);
            setLiked(res.data.liked);
            setLikes((prev) => prev + (res.data.liked ? 1 : -1));
        } catch (err) {
            console.error("Lỗi like:", err);
        }
    };

    // ⭐ SỬA BÀI VIẾT
    const handleEdit = async (updated) => {
        try {
            const formData = new FormData();
            formData.append("content", updated.content);
            formData.append("tags", JSON.stringify(updated.tags));
            formData.append("image_url", updated.image_url);
            
            if (updated.newImages && updated.newImages.length > 0) {
                updated.newImages.forEach(file => {
                    formData.append("images", file);
                });
            }

            const res = await api.put(`/community/posts/${post.id}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            onUpdate?.(res.data.data);
            setShowEdit(false);
        } catch (err) {
            console.error("Lỗi cập nhật:", err);
            alert("Không thể cập nhật bài viết");
        }
    };


    // ⭐ XOÁ BÀI VIẾT
    const handleDelete = async () => {
        if (!confirm("Bạn chắc chắn muốn xoá bài viết?")) return;

        try {
            await api.delete(`/community/posts/${post.id}`);
            onDelete?.(post.id); // remove khỏi UI
        } catch (err) {
            console.error("Lỗi xoá:", err);
            alert("Không thể xoá bài viết");
        }
    };

    return (
        <>
            <Card key={post.id} className="overflow-hidden border-none shadow-sm bg-white py-0 gap-0">
                <CardHeader className="pb-1 px-4 pt-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden border">
                                {post.avatar_url ? (
                                    <img
                                        src={post.avatar_url}
                                        alt={post.author_name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    post.author_name?.[0]
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <div className="text-sm font-bold text-gray-900">{post.author_name}</div>
                                <div className="text-[10px] text-gray-400 uppercase font-medium">
                                    {formatDistanceToNow(new Date(post.created_at), {
                                        addSuffix: true,
                                        locale: vi,
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ⭐ ICON 3 CHẤM */}
                        {(post.user_id === user?.id || user?.role === "admin") && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                        <MoreVertical className="h-4 w-4 text-gray-400" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                    <DropdownMenuItem onClick={() => setShowEdit(true)}>
                                        Chỉnh sửa
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-red-600 font-medium"
                                        onClick={handleDelete}
                                    >
                                        Xóa bài viết
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 pb-4 px-4">
                    {/* Main Content Text */}
                    <div className="px-1">
                        <p className="text-[17px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {post.content}
                        </p>
                    </div>

                    {/* Post Images Grid - Only rendered if images exist */}
                    {postImages.length > 0 && (
                        <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group">
                            <div className={`grid gap-1 ${
                                postImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                            }`}>
                                {postImages.slice(0, 4).map((img, index) => {
                                    const isLast = index === 3 && postImages.length > 4;
                                    const spanClass = (postImages.length === 3 && index === 0) ? 'row-span-2 h-full' : '';
                                    
                                    return (
                                        <div 
                                            key={index} 
                                            className={`relative cursor-pointer overflow-hidden bg-gray-200 group/img ${
                                                postImages.length === 1 ? 'min-h-[300px] max-h-[600px]' : 'aspect-square'
                                            } ${spanClass}`}
                                            onClick={() => {
                                                setViewerImage(postImages);
                                                setViewerIndex(index);
                                            }}
                                        >
                                            <img
                                                src={getFullUrl(img)}
                                                alt=""
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                                                loading="lazy"
                                            />
                                            {isLast && (
                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[4px] transition-all group-hover/img:bg-black/40">
                                                    <span className="text-3xl font-black">+{postImages.length - 3}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Xem thêm</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* Tags */}
                    <div className="flex gap-2 flex-wrap">
                        {(post.tags || []).map(tag => (
                            <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="bg-gray-50 text-gray-500 font-bold border-none px-2.5 py-1 text-[10px] max-w-[200px]"
                            >
                                <span className="truncate">#{tag}</span>
                            </Badge>
                        ))}
                    </div>

                    {/* Interactions Row - Elderly Friendly Redesign */}
                    <div className="pt-2">
                        <div className="flex items-center border-t border-gray-100 pt-1">
                            <button
                                onClick={toggleLike}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95 ${liked ? 'text-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <ThumbsUp className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-sm font-bold">Thích</span>
                                    <span className="text-[10px] opacity-70">{likes || '0'}</span>
                                </div>
                            </button>

                            <button
                                onClick={() => setShowComments(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                            >
                                <MessageCircle className="h-6 w-6" />
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-sm font-bold">Bình luận</span>
                                    <span className="text-[10px] opacity-70">{commentsCount || '0'}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                </CardContent>
            </Card>

            {showComments && (
                <CommentModal
                    post={{ ...post, comments_count: commentsCount }}
                    onClose={() => setShowComments(false)}
                    onCommentCountChange={setCommentsCount}
                />
            )}
            {showEdit && createPortal(
                <EditPostModal
                    post={post}
                    onClose={() => setShowEdit(false)}
                    onSave={handleEdit}
                />,
                document.body
            )}

            {/* Image Viewer / Lightbox Modal - Facebook Style Split View */}
            {viewerImage && viewerImage.length > 0 && createPortal(
                <div 
                    className="fixed inset-0 h-screen w-screen z-[9999] bg-black flex items-center justify-center animate-in fade-in duration-300 select-none overflow-hidden"
                    onClick={() => setViewerImage(null)}
                >
                    {/* Close Button */}
                    <button 
                        className="absolute top-5 left-5 z-[10000] bg-black/40 hover:bg-black/60 text-white p-2.5 rounded-full transition-all backdrop-blur-md border border-white/10 shadow-xl"
                        onClick={() => setViewerImage(null)}
                    >
                        <X className="h-6 w-6" />
                    </button>

                    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-black" onClick={e => e.stopPropagation()}>
                        {/* LEFT SIDE: Image Display (Larger Preview) */}
                        <div className="flex-1 relative bg-black flex items-center justify-center p-0 lg:p-4 min-h-0">
                            {viewerImage.length > 1 && (
                                <>
                                    <button 
                                        className="absolute left-4 top-1/2 -translate-y-1/2 z-[110] text-white/70 hover:text-white p-3 sm:p-5 rounded-full bg-black/30 hover:bg-black/50 transition-all disabled:opacity-5 border border-white/5"
                                        onClick={prevImage}
                                        disabled={viewerIndex === 0}
                                    >
                                        <span className="text-3xl sm:text-5xl leading-none">‹</span>
                                    </button>
                                    <button 
                                        className="absolute right-4 top-1/2 -translate-y-1/2 z-[110] text-white/70 hover:text-white p-3 sm:p-5 rounded-full bg-black/30 hover:bg-black/50 transition-all disabled:opacity-5 border border-white/5"
                                        onClick={nextImage}
                                        disabled={viewerIndex === viewerImage.length - 1}
                                    >
                                        <span className="text-3xl sm:text-5xl leading-none">›</span>
                                    </button>
                                </>
                            )}

                            <motion.img 
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={viewerIndex}
                                src={getFullUrl(viewerImage[viewerIndex])} 
                                alt="Full view" 
                                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl"
                            />
                            
                            {viewerImage.length > 1 && (
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 bg-black/50 backdrop-blur-md rounded-full text-white/90 text-sm font-black border border-white/10 shadow-lg">
                                    {viewerIndex + 1} / {viewerImage.length}
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE: Post Content & Comments (Dark Theme) */}
                        <div className="w-full lg:w-[450px] bg-[#1a1a1a] h-full flex flex-col shadow-2xl border-l border-white/5 overflow-hidden">
                            {/* Header: Author Info */}
                            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a] shrink-0">
                                <div className="flex items-center gap-3.5">
                                    <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/10">
                                        {post.avatar_url ? (
                                            <img src={post.avatar_url} alt={post.author_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-orange-400 font-black text-lg">{post.author_name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-base font-black text-white leading-tight">{post.author_name}</p>
                                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: vi })}</p>
                                    </div>
                                </div>
                                <button className="p-2 rounded-full hover:bg-white/5 lg:hidden" onClick={() => setViewerImage(null)}>
                                    <MoreVertical className="h-6 w-6 rotate-45 text-gray-400" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a]">
                                <div className="p-5 pb-2">
                                    <p className="text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap font-medium">
                                        {post.content || <span className="text-gray-500 italic">Không có nội dung</span>}
                                    </p>
                                    
                                    {post.tags && post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2.5 mt-4">
                                            {post.tags.map(tag => (
                                                <span key={tag} className="text-orange-400 text-sm font-bold hover:underline cursor-pointer">#{tag}</span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between py-3 border-y border-white/5 mt-6 text-xs text-gray-400 font-black">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                                <ThumbsUp className="h-2.5 w-2.5 text-white fill-current" />
                                            </div>
                                            <span>{likes} lượt thích</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <span>{commentsCount} bình luận</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-1 py-1 border-b border-white/5">
                                        <Button variant="ghost" className={`flex-1 h-12 gap-2 rounded-xl transition-all ${liked ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:bg-white/5'}`} onClick={toggleLike}>
                                            <ThumbsUp className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
                                            <span className="text-sm font-black">Thích</span>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            className="flex-1 h-12 gap-2 text-gray-400 hover:bg-white/5 rounded-xl transition-all"
                                            onClick={() => {
                                                setViewerImage(null);
                                                setShowComments(true);
                                            }}
                                        >
                                            <MessageCircle className="h-6 w-6" />
                                            <span className="text-sm font-black">Bình luận</span>
                                        </Button>
                                        <Button variant="ghost" className="flex-1 h-12 gap-2 text-gray-400 hover:bg-white/5 rounded-xl transition-all">
                                            <Share2 className="h-6 w-6" />
                                            <span className="text-sm font-black">Chia sẻ</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-[2px] bg-white/5 flex-1"></div>
                                        <span className="text-[11px] font-black text-gray-600 uppercase tracking-[0.2em]">Bình luận</span>
                                        <div className="h-[2px] bg-white/5 flex-1"></div>
                                    </div>
                                    
                                    <div className="flex flex-col items-center justify-center py-12 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                                        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                            <MessageCircle className="h-8 w-8 text-gray-600" />
                                        </div>
                                        <p className="text-sm font-black text-gray-400 px-6 leading-relaxed">
                                            Vui lòng nhấn nút <span className="text-orange-400">Bình luận</span> ở trên <br/> 
                                            để tham gia thảo luận cùng cộng đồng.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 border-t border-white/5 bg-[#1a1a1a] shrink-0">
                                <Button 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-2xl h-14 text-base font-black shadow-xl shadow-orange-900/20 active:scale-95 transition-all gap-3"
                                    onClick={() => {
                                        setViewerImage(null);
                                        setShowComments(true);
                                    }}
                                >
                                    <MessageCircle className="h-6 w-6" />
                                    Xem tất cả bình luận
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
