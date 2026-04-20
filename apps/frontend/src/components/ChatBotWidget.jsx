"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import {
  Send,
  MessageSquare,
  PlusCircle,
  Bot,
  History,
  Trash2,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatWidget({ userId, userRole = "user" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false); // Hiển thị 3 chấm
  const [typingMessage, setTypingMessage] = useState(null); // Tin nhắn AI đang gõ
  const [showHistory, setShowHistory] = useState(false);
  const botMode = userRole === "dealer" ? "dealer" : "user";

  const welcomeMessage =
    botMode === "dealer"
      ? "Xin chào! Tôi là trợ lý cho đại lý. Bạn có thể hỏi về nguồn hàng, giá đề xuất, số lượng, trạng thái yêu cầu mua và thương lượng."
      : "Xin chào! Tôi là trợ lý cho người dùng. Bạn có thể hỏi về giá, xu hướng, lịch sử giá, cảnh báo và thông tin thị trường."

  const messagesEndRef = useRef(null);
  const currentSession = sessions.find((item) => item.id === activeSession) || null;

  const sortedSessions = [...sessions].sort((left, right) => {
    if (Boolean(left.is_pinned) !== Boolean(right.is_pinned)) {
      return Number(right.is_pinned) - Number(left.is_pinned);
    }

    if (Boolean(left.is_archived) !== Boolean(right.is_archived)) {
      return Number(left.is_archived) - Number(right.is_archived);
    }

    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });

  const activeSessions = sortedSessions.filter((session) => !session.is_archived);
  const archivedSessions = sortedSessions.filter((session) => session.is_archived);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(scrollToBottom, [messages, typingMessage, typingIndicator]);

  // Load sessions
  const loadSessions = async () => {
    try {
      const res = await api.get(`/chat/sessions/me`);
      if (res.data.success) {
        setSessions(res.data.sessions);
        const currentIds = new Set(res.data.sessions.map((session) => session.id));
        const shouldRestoreActive = !activeSession || !currentIds.has(activeSession);
        if (shouldRestoreActive && res.data.sessions.length > 0) {
          const nextSession = res.data.sessions.find((session) => !session.is_archived) || res.data.sessions[0];
          if (nextSession) {
            setActiveSession(nextSession.id);
            setSessionId(nextSession.id);
            loadMessages(nextSession.id);
          }
        }
        return res.data.sessions;
      }
      return [];
    } catch (e) {
      console.error("Load sessions error:", e);
      return [];
    }
  };

  // Load messages
  const loadMessages = async (sid) => {
    try {
      const res = await api.get(`/chat/${sid}/messages`);
      if (res.data.success) setMessages(res.data.messages);
    } catch (e) {
      console.error("Load messages error:", e);
    }
  };

  // Tạo session mới
  const createNewSession = async () => {
    try {
      const res = await api.post("/chat/session", { title: botMode === "dealer" ? "Chat đại lý" : "Chat người dùng" });
      if (res.data.success) {
        const newSessionId = res.data.session_id;
        setSessionId(newSessionId);
        setActiveSession(newSessionId);
        setMessages([]);
        setTypingIndicator(true);
        setTypingMessage(welcomeMessage);
        setShowHistory(false);
        loadSessions();
      }
    } catch (e) {
      console.error("Create session error:", e);
    }
  };

  // Gửi message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userText = input;
    setMessages((prev) => [...prev, { role: "user", message: userText }]);
    setInput("");
    setIsLoading(true);
    setTypingIndicator(true); // hiển thị 3 chấm ngay lập tức

    try {
      const res = await api.post("/chat/message", {
        session_id: sessionId,
        message: userText,
      });

      if (res.data.success) {
        const aiReply = res.data.reply;
        setTypingMessage(aiReply); // chạy chữ
      }
    } catch (error) {
      console.error("Send message error:", error);
    }

    setIsLoading(false);
  };

  // Toggle widget
  const toggleWidget = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      loadSessions().then((loadedSessions) => {
        if (!loadedSessions || loadedSessions.length === 0) createNewSession();
      });
    }
  };

  // Chọn session
  const openSession = (sid) => {
    setSessionId(sid);
    setActiveSession(sid);
    setMessages([]);
    setTypingIndicator(false);
    setTypingMessage(null);
    setShowHistory(false);
    loadMessages(sid);
  };

  const refreshSessions = async () => {
    const latest = await loadSessions();
    if (latest.length === 0) {
      setSessionId(null);
      setActiveSession(null);
      setMessages([]);
    }
    return latest;
  };

  const handlePinSession = async (session) => {
    try {
      await api.patch(`/chat/session/${session.id}/pin`, { pinned: !session.is_pinned });
      await refreshSessions();
    } catch (error) {
      console.error("Pin session error:", error);
    }
  };

  const handleArchiveSession = async (session) => {
    try {
      await api.patch(`/chat/session/${session.id}/archive`, { archived: !session.is_archived });
      await refreshSessions();
      if (session.id === activeSession && !session.is_archived) {
        setShowHistory(true);
      }
    } catch (error) {
      console.error("Archive session error:", error);
    }
  };

  const handleDeleteSession = async (session) => {
    try {
      await api.delete(`/chat/session/${session.id}`);
      const latest = await refreshSessions();
      if (session.id === activeSession) {
        const fallback = latest.find((item) => !item.is_archived) || latest[0] || null;
        if (fallback) {
          setSessionId(fallback.id);
          setActiveSession(fallback.id);
          loadMessages(fallback.id);
        }
      }
    } catch (error) {
      console.error("Delete session error:", error);
    }
  };

  // Format thời gian
  const formatTime = (ts) =>
    new Date(ts).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });

  // Typing effect component (chữ chạy)
  const TypingEffect = ({ message, onComplete }) => {
    const [displayed, setDisplayed] = useState("");

    useEffect(() => {
      let i = 0;
      setDisplayed("");
      const interval = setInterval(() => {
        setDisplayed((prev) => prev + message[i]);
        i++;
        if (i >= message.length) {
          clearInterval(interval);
          onComplete?.();
        }
      }, 20);
      return () => clearInterval(interval);
    }, [message, onComplete]);

    return <span>{displayed}</span>;
  };

  // Component 3 chấm nhấp nháy
  const TypingIndicator = () => (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
    </div>
  );

  const SessionRow = ({ session, active, onOpen, onPin, onArchive, onDelete }) => (
    <div
      className={`rounded-2xl border bg-white p-3 shadow-sm transition ${
        active ? "border-emerald-400 ring-1 ring-emerald-100" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-slate-900">{session.title || "Cuộc trò chuyện"}</p>
              {session.is_pinned && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Pinned</span>}
              {session.is_archived && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Ẩn</span>}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{formatTime(session.updated_at || session.created_at)}</p>
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onPin} className="h-8 rounded-lg px-2.5">
          {session.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {session.is_pinned ? "Bỏ ghim" : "Ghim"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onArchive} className="h-8 rounded-lg px-2.5">
          {session.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          {session.is_archived ? "Hiện" : "Ẩn"}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete} className="h-8 rounded-lg px-2.5">
          <Trash2 className="h-3.5 w-3.5" />
          Xóa
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {!isOpen && (
        <Button
          onClick={toggleWidget}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 p-0 text-white shadow-lg transition hover:bg-emerald-700"
        >
          <MessageSquare size={24} />
        </Button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(640px,calc(100vh-3rem))] w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-600" />
                  <p className="font-semibold text-slate-900">Trợ lý AgriTrend</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">History để ẩn lịch sử, pin để giữ cuộc trò chuyện quan trọng.</p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant={showHistory ? "default" : "outline"}
                onClick={() => setShowHistory((prev) => !prev)}
                className="h-10 rounded-xl px-3"
              >
                <History className="h-4 w-4" />
                History
              </Button>

              <Button
                type="button"
                onClick={createNewSession}
                className="h-10 shrink-0 rounded-xl bg-emerald-600 px-3 text-white transition hover:bg-emerald-700"
              >
                <PlusCircle className="h-4 w-4" />
                Mới
              </Button>
            </div>

            {currentSession && !showHistory && (
              <p className="mt-2 truncate text-xs text-slate-500">
                Đang mở: {currentSession.title || "Cuộc trò chuyện"} • {formatTime(currentSession.created_at)}
              </p>
            )}
          </div>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 min-h-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Lịch sử trò chuyện</p>
                  <p className="text-xs text-slate-500">Pin để giữ lại, Archive để ẩn khỏi danh sách chính.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Quay lại chat
                </button>
              </div>

              {sortedSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                  Chưa có cuộc trò chuyện nào. Bấm Mới để tạo.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Đang hiển thị</p>
                    {activeSessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        active={activeSession === session.id}
                        onOpen={() => openSession(session.id)}
                        onPin={() => handlePinSession(session)}
                        onArchive={() => handleArchiveSession(session)}
                        onDelete={() => handleDeleteSession(session)}
                      />
                    ))}
                  </div>

                  {archivedSessions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Đã ẩn</p>
                      {archivedSessions.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          active={activeSession === session.id}
                          onOpen={() => openSession(session.id)}
                          onPin={() => handlePinSession(session)}
                          onArchive={() => handleArchiveSession(session)}
                          onDelete={() => handleDeleteSession(session)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4 min-h-0">
                {messages.length === 0 && !typingMessage && !typingIndicator ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    Bắt đầu hỏi ngay, ví dụ: giá cà phê hôm nay, xu hướng tiêu, lịch sử giá lúa.
                  </div>
                ) : null}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                ))}

                {typingIndicator && !typingMessage && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <TypingIndicator />
                    </div>
                  </div>
                )}

                {typingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                      <TypingEffect
                        message={typingMessage}
                        onComplete={() => {
                          setMessages((prev) => [...prev, { role: "assistant", message: typingMessage }]);
                          setTypingMessage(null);
                          setTypingIndicator(false);
                        }}
                      />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef}></div>
              </div>

              <form onSubmit={handleSend} className="border-t bg-white p-3">
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm focus-within:border-emerald-500 focus-within:bg-white">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập câu hỏi..."
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 p-0 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
