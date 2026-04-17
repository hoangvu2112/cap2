import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function EditPostModal({ post, onClose, onSave }) {
    const [content, setContent] = useState(post.content);
    const [tags, setTags] = useState(post.tags?.join(", ") || "");

    const handleSubmit = () => {
        const tagList = tags
            .split(",")
            .map(t => t.trim())
            .filter(t => t.length);

        onSave({
            content,
            tags: tagList
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg">
                <CardContent className="space-y-4 pt-6">

                    <h2 className="text-lg font-semibold">Chỉnh sửa bài viết</h2>

                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={5}
                    />

                    <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Thẻ bài viết, cách nhau bởi dấu phẩy"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                    />

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Hủy
                        </Button>

                        <Button onClick={handleSubmit}>
                            Lưu thay đổi
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
