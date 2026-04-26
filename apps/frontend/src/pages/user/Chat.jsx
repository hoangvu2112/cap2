"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Search, Send, UserRound } from "lucide-react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
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

export default function Chat() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

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
    fetchUsers(userSearch);
  }, [userSearch]);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto-open chat khi navigate từ trang khác với ?userId=X
  useEffect(() => {
    const targetUserId = searchParams.get("userId");
    const targetName = searchParams.get("name");
    const targetAvatar = searchParams.get("avatar");
    
    if (targetUserId && conversations.length >= 0) {
      const uid = Number(targetUserId);
      // Kiểm tra xem đã có conversation chưa
      const existing = conversations.find(c => c.other_user_id === uid);
      if (existing) {
        handleSelectConversation(existing);
      } else {
        handlePickUser({
          id: uid,
          name: targetName || "User",
          avatar_url: targetAvatar || null,
          conversation_id: null,
        });
      }
      // Xóa params sau khi xử lý
      setSearchParams({});
    }
  }, [searchParams, conversations.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
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
    <div className="flex h-[calc(100vh-120px)] gap-6 p-4">
      {/* Sidebar Chat */}
      <Card className="flex w-80 flex-col overflow-hidden">
        <CardHeader className="space-y-4 border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Trò chuyện
            </CardTitle>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)} tin mới
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full rounded-xl border bg-muted/30 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex h-full flex-col">
            {/* Users list (if searching) */}
            {userSearch && (
              <div className="border-b bg-muted/10 p-2">
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Người dùng tìm thấy
                </p>
                <div className="space-y-1">
                  {users.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handlePickUser(entry)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-accent"
                    >
                      <UserAvatar name={entry.name} avatarUrl={entry.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gần đây
              </p>
              {conversations.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Chưa có cuộc trò chuyện nào
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                        activeConversation?.id === conv.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <UserAvatar name={conv.other_user_name} avatarUrl={conv.other_user_avatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold">
                            {conv.other_user_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(conv.last_message_created_at || conv.updated_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs text-muted-foreground">
                            {conv.last_message_content || "Bắt đầu trò chuyện"}
                          </p>
                          {Number(conv.unread_count) > 0 && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Content */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-4 border-b px-6 py-4">
              <UserAvatar
                name={activeConversation.other_user_name}
                avatarUrl={activeConversation.other_user_avatar}
                size="md"
              />
              <div className="flex-1">
                <h3 className="text-base font-bold">{activeConversation.other_user_name}</h3>
                <p className="text-xs text-green-500">Đang hoạt động</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-muted/5 px-6 py-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Đang tải tin nhắn...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Bắt đầu cuộc trò chuyện với {activeConversation.other_user_name}</p>
                    <p className="text-xs text-muted-foreground">Hãy gửi lời chào đầu tiên!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[70%] items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                           {!isMine && <UserAvatar name={activeConversation.other_user_name} avatarUrl={activeConversation.other_user_avatar} size="xs" />}
                           <div className={`space-y-1 ${isMine ? "items-end" : "items-start"}`}>
                              <div
                                className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                  isMine
                                    ? "bg-primary text-white rounded-br-none"
                                    : "bg-white text-foreground rounded-bl-none border border-border/50"
                                }`}
                              >
                                {msg.content}
                              </div>
                              <p className={`px-1 text-[10px] text-muted-foreground ${isMine ? "text-right" : "text-left"}`}>
                                {formatTime(msg.created_at)}
                              </p>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t p-4">
              <div className="flex items-end gap-3 rounded-2xl border bg-muted/10 p-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2.5 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl"
                  onClick={handleSendMessage}
                  disabled={!messageDraft.trim()}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
             <div className="rounded-full bg-primary/10 p-6">
                <MessageSquare className="h-12 w-12 text-primary" />
             </div>
             <div>
                <h3 className="text-lg font-bold">Hộp thư của bạn</h3>
                <p className="max-w-[280px] text-sm text-muted-foreground">
                  Chọn một người dùng từ danh sách bên trái để bắt đầu cuộc trò chuyện.
                </p>
             </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function UserAvatar({ name, avatarUrl, size = "md" }) {
  const sizeClasses = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary shrink-0 ${sizeClasses[size]}`}>
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
