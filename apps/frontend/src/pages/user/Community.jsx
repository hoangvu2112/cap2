"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, MessageSquare, PlusCircle, Search, Send, UserRound } from "lucide-react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import PostCard from "@/components/PostCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

const formatTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

export default function Community() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [tags, setTags] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [search, setSearch] = useState("");
  const [filterMyPosts, setFilterMyPosts] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    fetchPosts();
  }, [search, filterMyPosts, user?.id]);

  useEffect(() => {
    fetchUsers(userSearch);
  }, [userSearch]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    socket.on("community:like", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post))
      );
    });

    socket.on("community:unlike", ({ postId }) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likes: Math.max((post.likes || 1) - 1, 0) } : post
        )
      );
    });

    socket.on("community:dm:new", ({ conversation, message }) => {
      setConversations((prev) => upsertConversation(prev, conversation, message, activeConversationRef.current));

      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === conversation.other_user_id
            ? { ...entry, conversation_id: conversation.id }
            : entry
        )
      );

      if (activeConversationRef.current?.id === conversation.id) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return [...prev, message];
        });

        setActiveConversation((prev) =>
          prev ? { ...prev, ...conversation, unread_count: 0 } : prev
        );

        if (message.sender_id !== user?.id) {
          markConversationRead(conversation.id);
        }
      }
    });

    socket.on("community:dm:read", ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversationId ? { ...item, unread_count: 0 } : item
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user?.id]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.get("/community/posts", {
        params: {
          search,
          limit: 20,
        },
      });

      let list = res.data.data || [];
      if (filterMyPosts && user?.id) {
        list = list.filter((post) => post.user_id === user.id);
      }
      setPosts(list);
    } catch (error) {
      console.error("Lỗi lấy posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchUsers = async (keyword = "") => {
    try {
      const res = await api.get("/community/users", {
        params: {
          search: keyword,
          limit: 20,
        },
      });
      setUsers(res.data.data || []);
    } catch (error) {
      console.error("Lỗi lấy danh sách người dùng:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get("/community/messages/conversations");
      const list = res.data.data || [];
      setConversations(list);
      if (!activeConversationRef.current && list.length > 0) {
        handleSelectConversation(list[0]);
      }
    } catch (error) {
      console.error("Lỗi lấy hội thoại:", error);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setActiveConversation(conversation);
    setLoadingMessages(true);

    if (!conversation.id) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    try {
      const res = await api.get(`/community/messages/conversations/${conversation.id}/messages`);
      setMessages(res.data.data || []);
      setActiveConversation((prev) => ({
        ...(prev || conversation),
        ...(res.data.conversation || {}),
        unread_count: 0,
      }));
      await markConversationRead(conversation.id);
    } catch (error) {
      console.error("Lỗi lấy tin nhắn:", error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markConversationRead = async (conversationId) => {
    if (!conversationId) return;

    try {
      await api.patch(`/community/messages/conversations/${conversationId}/read`);
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversationId ? { ...item, unread_count: 0 } : item
        )
      );
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;

    try {
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const res = await api.post("/community/posts", {
        content: newPost,
        tags: tagList,
      });

      setPosts((prev) => {
        if (prev.some((item) => item.id === res.data.data.id)) return prev;
        return [res.data.data, ...prev];
      });
      setNewPost("");
      setTags("");
    } catch (error) {
      console.error("Lỗi đăng bài:", error);
    }
  };

  const handleMessageUser = (post) => {
    if (!post?.user_id || post.user_id === user?.id) return;

    const existing = conversations.find((item) => item.other_user_id === post.user_id);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    setActiveConversation({
      id: null,
      other_user_id: post.user_id,
      other_user_name: post.author_name,
      other_user_avatar: post.avatar_url,
      unread_count: 0,
    });
    setMessages([]);
  };

  const handlePickUser = (pickedUser) => {
    const existing = conversations.find((item) => item.other_user_id === pickedUser.id);
    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    setActiveConversation({
      id: pickedUser.conversation_id || null,
      other_user_id: pickedUser.id,
      other_user_name: pickedUser.name,
      other_user_avatar: pickedUser.avatar_url,
      unread_count: 0,
    });
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!messageDraft.trim() || !activeConversation?.other_user_id) return;

    try {
      const res = await api.post("/community/messages", {
        recipientId: activeConversation.other_user_id,
        content: messageDraft,
      });

      const sentMessage = res.data.data;
      const conversation = res.data.conversation;

      setMessageDraft("");
      setActiveConversation(conversation);
      setMessages((prev) => {
        if (prev.some((item) => item.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });
      setConversations((prev) => upsertConversation(prev, conversation, sentMessage));
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === conversation.other_user_id
            ? { ...entry, conversation_id: conversation.id }
            : entry
        )
      );
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar />

      <main className="container mx-auto space-y-6 px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <section className="space-y-6">
            <div className="flex gap-3">
              <div className="flex w-full overflow-hidden rounded-lg border">
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
                onClick={() => setFilterMyPosts((prev) => !prev)}
              >
                <Filter className="mr-2 h-4 w-4" /> Bài của tôi
              </Button>
            </div>

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
                    className="w-full rounded-md border px-3 py-2"
                  />

                  <div className="flex justify-end">
                    <Button onClick={handlePost}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Đăng bài
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingPosts ? (
              <p className="py-6 text-center">Đang tải...</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={(postId) =>
                      setPosts((prev) => prev.filter((item) => item.id !== postId))
                    }
                    onUpdate={(updatedPost) =>
                      setPosts((prev) =>
                        prev.map((item) => (item.id === updatedPost.id ? updatedPost : item))
                      )
                    }
                    onMessageUser={handleMessageUser}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-5 w-5" />
                    Tin nhắn cộng đồng
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)} chưa đọc
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Tìm người để nhắn..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Người dùng
                  </p>

                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {users.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handlePickUser(entry)}
                        className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-accent"
                      >
                        <UserAvatar name={entry.name} avatarUrl={entry.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{entry.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{entry.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hội thoại
                  </p>

                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {conversations.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                        Chưa có cuộc trò chuyện nào.
                      </div>
                    ) : (
                      conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => handleSelectConversation(conversation)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                            activeConversation?.id === conversation.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                          }`}
                        >
                          <UserAvatar
                            name={conversation.other_user_name}
                            avatarUrl={conversation.other_user_avatar}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {conversation.other_user_name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatTime(conversation.last_message_created_at || conversation.updated_at)}
                              </span>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {conversation.last_message_content || "Bắt đầu cuộc trò chuyện"}
                            </div>
                          </div>
                          {Number(conversation.unread_count) > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                              {conversation.unread_count}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30">
                  <div className="flex items-center gap-3 border-b px-4 py-3">
                    {activeConversation ? (
                      <>
                        <UserAvatar
                          name={activeConversation.other_user_name}
                          avatarUrl={activeConversation.other_user_avatar}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {activeConversation.other_user_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Nhắn tin trực tiếp trong cộng đồng
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <UserRound className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Chọn một người dùng để bắt đầu trò chuyện.
                        </div>
                      </>
                    )}
                  </div>

                  <div className="h-80 overflow-y-auto px-4 py-3">
                    {!activeConversation ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Chưa chọn cuộc trò chuyện.
                      </div>
                    ) : loadingMessages ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Đang tải tin nhắn...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Chưa có tin nhắn nào. Hãy gửi lời chào trước nhé.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => {
                          const mine = message.sender_id === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${mine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                  mine ? "bg-primary text-primary-foreground" : "bg-white shadow-sm"
                                }`}
                              >
                                <div>{message.content}</div>
                                <div
                                  className={`mt-1 text-[11px] ${
                                    mine ? "text-primary-foreground/80" : "text-muted-foreground"
                                  }`}
                                >
                                  {formatTime(message.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t px-4 py-3">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        placeholder={
                          activeConversation
                            ? `Nhắn cho ${activeConversation.other_user_name}...`
                            : "Chọn người nhận để bắt đầu"
                        }
                        className="min-h-[72px]"
                        disabled={!activeConversation}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!activeConversation || !messageDraft.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function UserAvatar({ name, avatarUrl }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

function upsertConversation(prev, conversation, message, activeConversation = null) {
  const list = [...prev];
  const index = list.findIndex((item) => item.id === conversation.id);

  const nextConversation = {
    ...conversation,
    last_message_content: message?.content ?? conversation.last_message_content,
    last_message_created_at: message?.created_at ?? conversation.last_message_created_at,
    last_message_sender_id: message?.sender_id ?? conversation.last_message_sender_id,
  };

  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...nextConversation,
      unread_count:
        activeConversation?.id === conversation.id ? 0 : Number(nextConversation.unread_count || list[index].unread_count || 0),
    };
  } else {
    list.unshift(nextConversation);
  }

  return list.sort((a, b) => {
    const aTime = new Date(a.last_message_created_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.last_message_created_at || b.updated_at || 0).getTime();
    return bTime - aTime;
  });
}
