import { useState, useRef } from "react";
import { X, ChevronDown, Lock, Smile, Image as ImageIcon, UserPlus, MapPin, Gift, Video, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { BACKEND_URL } from "@/lib/api";

export default function EditPostModal({ post, onClose, onSave }) {
    const { user } = useAuth();
    const [content, setContent] = useState(post.content);
    const [tags, setTags] = useState(post.tags?.join(", ") || "");
    const [newImages, setNewImages] = useState([]); // List of new files
    const fileInputRef = useRef(null);

    // Parse existing images
    const [existingImages, setExistingImages] = useState(() => {
        try {
            if (!post.image_url) return [];
            const parsed = JSON.parse(post.image_url);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return post.image_url ? [post.image_url] : [];
        }
    });

    const getFullUrl = (path) => {
        if (!path) return "";
        if (path.startsWith("http")) return path;
        return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const handleRemoveImage = (index) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveNewImage = (index) => {
        setNewImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setNewImages(prev => [...prev, ...files.map(file => ({
                file,
                preview: URL.createObjectURL(file)
            }))]);
        }
    };

    const handleSubmit = () => {
        const tagList = tags
            .split(",")
            .map(t => t.trim())
            .filter(t => t.length);

        onSave({
            content,
            tags: tagList,
            image_url: JSON.stringify(existingImages), // Existing image paths
            newImages: newImages.map(img => img.file) // New image files
        });
    };

    return (
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
                <div className="relative flex items-center justify-center px-4 py-4 border-b border-gray-200">
                    <h2 className="text-[20px] font-bold text-gray-900">Chỉnh sửa bài viết</h2>
                    <button 
                        onClick={onClose}
                        className="absolute right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body - Content Area */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[70vh]">
                    <div className="flex gap-3 mb-4">
                        {/* User Avatar */}
                        <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 mt-1">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-orange-100 text-orange-600 font-bold text-lg">
                                    {user?.name?.charAt(0)}
                                </div>
                            )}
                        </div>

                        <div className="flex-1">
                            <p className="font-bold text-[17px] text-gray-900 leading-tight mb-1">{user?.name}</p>
                            
                            {/* Text Area */}
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={`Bạn đang nghĩ gì, ${user?.name?.split(' ').pop()}?`}
                                className="w-full min-h-[120px] bg-transparent border-none outline-none text-[18px] text-gray-800 placeholder:text-gray-400 resize-none py-1"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Image Grid - Existing and New Images */}
                    {(existingImages.length > 0 || newImages.length > 0) && (
                        <div className="relative mt-2 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 group p-1">
                            <div className="grid grid-cols-2 gap-1">
                                {/* Existing Images */}
                                {existingImages.map((img, i) => (
                                    <div key={`existing-${i}`} className="relative h-40 bg-gray-200 rounded-lg overflow-hidden">
                                        <img 
                                            src={getFullUrl(img)} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                        />
                                        <button 
                                            onClick={() => handleRemoveImage(i)}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {/* New Images */}
                                {newImages.map((img, i) => (
                                    <div key={`new-${i}`} className="relative h-40 bg-gray-200 rounded-lg overflow-hidden">
                                        <img 
                                            src={img.preview} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                        />
                                        <button 
                                            onClick={() => handleRemoveNewImage(i)}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags Input - Integrated neatly */}
                    <div className="mt-4 pt-4 border-t border-gray-50">
                        <p className="text-[13px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Thẻ bài viết</p>
                        <input
                            type="text"
                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 focus:bg-white focus:border-orange-200 outline-none transition-all"
                            placeholder="Nông nghiệp, Giá lúa, Kinh nghiệm..."
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 space-y-4">
                    {/* Add to post bar */}
                    <div 
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <span className="text-[15px] font-bold text-gray-700 ml-1">Thêm Ảnh vào bài viết của bạn</span>
                        <div className="flex items-center gap-1">
                            <input 
                                type="file" 
                                hidden 
                                multiple 
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors text-green-500" title="Ảnh/Video">
                                <ImageIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Button 
                        onClick={handleSubmit}
                        disabled={!content.trim()}
                        className="w-full bg-[#1b74e4] hover:bg-[#1868cd] text-white font-bold py-6 rounded-lg text-[16px] shadow-sm transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                    >
                        Lưu thay đổi
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
