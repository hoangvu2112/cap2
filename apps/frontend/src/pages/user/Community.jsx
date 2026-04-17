"use client";

import { useState, useEffect } from "react";
import { Send, Search, Filter, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import PostCard from "@/components/PostCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { io } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
// import { socket } from "@/socket"
const socket = io(import.meta.env.VITE_API_URL);

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterMyPosts, setFilterMyPosts] = useState(false);

  const userId = user?.id;
  const token = localStorage.getItem("token");
  console.log("🔎 userId:", userId);
  console.log("🔑 token:", token);
  useEffect(() => {
    fetchPosts();
  }, [search, filterMyPosts]);

  // ===== LẤY DANH SÁCH BÀI VIẾT =====
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/community/posts", {
        params: {
          search,
          limit: 20,
        },
      });

      let list = res.data.data;

      if (filterMyPosts && userId) {
        list = list.filter((p) => p.user_id == userId);
      }

      setPosts(list);
    } catch (err) {
      console.error("Lỗi lấy posts:", err);
    }
    setLoading(false);
  };

  // ===== ĐĂNG BÀI =====
  const handlePost = async () => {
    if (!newPost.trim()) return;

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length);

      const res = await api.post(
        "/community/posts",
        { content: newPost, tags: tagList },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPosts([res.data.data, ...posts]);
      setNewPost("");
      setTags("");
    } catch (err) {
      console.error("Lỗi đăng bài:", err);
    }
  };

  // ===== SOCKET REALTIME =====
  useEffect(() => {
    socket.on("community:new_post", (post) => {
      setPosts((old) => [post, ...old]);
    });

    socket.on("community:post_deleted", (data) => {
      setPosts((old) => old.filter((p) => p.id !== data.id));
    });

    socket.on("community:post_updated", (post) => {
      setPosts((old) => old.map((p) => (p.id === post.id ? post : p)));
    });

    socket.on("community:like", ({ postId }) => {
      setPosts((old) =>
        old.map((p) =>
          p.id === postId ? { ...p, likes: p.likes + 1 } : p
        )
      );
    });

    socket.on("community:unlike", ({ postId }) => {
      setPosts((old) =>
        old.map((p) =>
          p.id === postId ? { ...p, likes: p.likes - 1 } : p
        )
      );
    });

    return () => {
      socket.off("community:new_post");
      socket.off("community:post_deleted");
      socket.off("community:post_updated");
      socket.off("community:like");
      socket.off("community:unlike");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* THANH TÌM KIẾM */}
        <div className="flex gap-3">
          <div className="flex w-full border rounded-lg overflow-hidden">
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 outline-none"
            />
            <button className="px-3 text-gray-600">
              <Search className="h-5 w-5" />
            </button>
          </div>

          <Button
            variant={filterMyPosts ? "default" : "outline"}
            onClick={() => setFilterMyPosts(!filterMyPosts)}
          >
            <Filter className="h-4 w-4 mr-2" /> Bài của tôi
          </Button>
        </div>

        {/* Ô ĐĂNG BÀI */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Textarea
                placeholder="Bạn muốn chia sẻ điều gì?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
              />

              <input
                type="text"
                placeholder="Thẻ bài viết (VD: nông sản, tư vấn...)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />

              <div className="flex justify-end">
                <Button onClick={handlePost}>
                  <PlusCircle className="h-4 w-4 mr-2" /> Đăng bài
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DANH SÁCH BÀI */}
        {loading ? (
          <p className="text-center py-6">Đang tải...</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
