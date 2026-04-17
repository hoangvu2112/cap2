import { useState, useEffect } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Pencil, Trash2, X, Newspaper } from "lucide-react";

export default function AdminNews() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("AgriTrend");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("draft");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await api.get("/news/admin");
      setNewsList(res.data);
    } catch (err) {
      console.error("Lỗi lấy tin tức:", err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSource("AgriTrend");
    setUrl("");
    setStatus("draft");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert("Tiêu đề không được để trống");

    try {
      if (editingId) {
        await api.put(`/news/${editingId}`, { title, content, source, url, status });
      } else {
        await api.post("/news", { title, content, source, url, status });
      }
      resetForm();
      fetchNews();
    } catch (err) {
      console.error("Lỗi lưu tin tức:", err);
      alert("Lỗi khi lưu tin tức");
    }
  };

  const handleEdit = (news) => {
    setTitle(news.title);
    setContent(news.content || "");
    setSource(news.source || "AgriTrend");
    setUrl(news.url || "");
    setStatus(news.status);
    setEditingId(news.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xoá tin tức này?")) return;
    try {
      await api.delete(`/news/${id}`);
      fetchNews();
    } catch (err) {
      console.error("Lỗi xoá tin tức:", err);
      alert("Lỗi khi xoá tin tức");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" />
              Quản lý Tin tức
            </h1>
            <p className="text-muted-foreground mt-1">Tạo và quản lý tin tức hiển thị cho người dùng</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <PlusCircle className="w-4 h-4 mr-2" /> Thêm tin tức
          </Button>
        </div>

        {/* Form thêm/sửa tin tức */}
        {showForm && (
          <Card className="mb-6 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                {editingId ? "Chỉnh sửa tin tức" : "Thêm tin tức mới"}
              </CardTitle>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tiêu đề *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề tin tức..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nội dung</label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập nội dung chi tiết..."
                    rows={5}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nguồn</label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="VD: AgriTrend"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL liên kết</label>
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Trạng thái</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="draft">Bản nháp</option>
                      <option value="published">Đã xuất bản</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>Huỷ</Button>
                  <Button type="submit">
                    {editingId ? "Cập nhật" : "Tạo tin tức"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Danh sách tin tức */}
        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Đang tải...</p>
        ) : newsList.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">Chưa có tin tức nào.</p>
        ) : (
          <div className="space-y-3">
            {newsList.map((news) => (
              <Card key={news.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{news.title}</h3>
                        <Badge
                          variant={news.status === "published" ? "default" : "secondary"}
                          className={news.status === "published"
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : ""}
                        >
                          {news.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                        </Badge>
                      </div>
                      {news.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{news.content}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Nguồn: {news.source || "N/A"}</span>
                        <span>
                          {news.published_at
                            ? `Xuất bản: ${new Date(news.published_at).toLocaleDateString("vi-VN")}`
                            : `Tạo: ${new Date(news.created_at).toLocaleDateString("vi-VN")}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(news)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(news.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
