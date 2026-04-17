import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThumbsUp, MessageCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import api from "@/lib/api";
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
    const [liked, setLiked] = useState(post.liked || false);
    const [showEdit, setShowEdit] = useState(false);


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
            const res = await api.put(`/community/posts/${post.id}`, updated);
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
            <Card key={post.id}>
                <CardHeader>
                    <div className="flex items-start gap-3">

                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold overflow-hidden">
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
                        <div className="flex-1">
                            <div className="font-semibold">{post.author_name}</div>
                            <div className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(post.created_at), {
                                    addSuffix: true,
                                    locale: vi,
                                })}
                            </div>
                        </div>

                        {/* ⭐ ICON 3 CHẤM - chỉ hiện nếu là bài của user */}
                        {(post.user_id === user.id || user.role === "admin") && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-2 rounded-full hover:bg-accent">
                                        <MoreVertical className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => setShowEdit(true)}>
                                        Chỉnh sửa
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={handleDelete}
                                    >
                                        Xóa bài viết
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    <p className="text-sm">{post.content}</p>

                    {/* Tags */}
                    <div className="flex gap-2 flex-wrap">
                        {(post.tags || []).map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                    </div>

                    {/* Like + Comment */}
                    <div className="flex items-center gap-4 pt-2 border-t border-border">
                        <Button variant="ghost" size="sm" onClick={toggleLike}>
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            {likes}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowComments(v => !v)}
                        >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            {post.comments_count}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {showComments && (
                <CommentModal post={post} onClose={() => setShowComments(false)} />
            )}
            {showEdit && (
                <EditPostModal
                    post={post}
                    onClose={() => setShowEdit(false)}
                    onSave={handleEdit}
                />
            )}

        </>
    );
}
