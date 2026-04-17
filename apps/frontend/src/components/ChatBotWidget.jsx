"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
// import { MessageSquare, Send, Bot, User, Loader2, X } from "lucide-react";
import { Send, MessageSquare, PlusCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatWidget({ userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false); // Hiển thị 3 chấm
  const [typingMessage, setTypingMessage] = useState(null); // Tin nhắn AI đang gõ

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(scrollToBottom, [messages, typingMessage, typingIndicator]);

  // Load sessions
  const loadSessions = async () => {
    try {
      const res = await api.get(`/chat/sessions/${userId}`);
      if (res.data.success) setSessions(res.data.sessions);
    } catch (e) {
      console.error("Load sessions error:", e);
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
      const res = await api.post("/chat/session", { user_id: userId });
      if (res.data.success) {
        const newSessionId = res.data.session_id;
        setSessionId(newSessionId);
        setActiveSession(newSessionId);
        setMessages([]);
        setTypingIndicator(true);
        setTypingMessage(
          "Xin chào! Tôi là trợ lý ảo, tôi sẽ giúp bạn theo dõi giá nông sản, dự đoán xu hướng và cung cấp thông tin thị trường."
        );
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
        user_id: userId,
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
      loadSessions().then(() => {
        if (sessions.length === 0) createNewSession();
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
    loadMessages(sid);
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
    <div className="flex gap-1">
      <span className="animate-bounce">.</span>
      <span className="animate-bounce animation-delay-200">.</span>
      <span className="animate-bounce animation-delay-400">.</span>
      <style jsx>{`
        .animate-bounce {
          display: inline-block;
          animation: bounce 0.6s infinite;
        }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return (
    <>
      {/* BUTTON MỞ CHAT */}
      {!isOpen && (
        <Button
          onClick={toggleWidget}
          className="fixed w-14 h-14 bottom-6 right-6 text-white p-4 rounded-full shadow-lg transition"
        >
          <MessageSquare size={24} />
        </Button>
      )}

      {/* WIDGET */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-[780px] h-[540px] bg-white rounded-xl shadow-xl flex border overflow-hidden">

          {/* SIDEBAR HISTORY */}
          <div className="w-[240px] border-r bg-gray-50 flex flex-col">
            <div className="p-3 border-b flex justify-between items-center">
              <span className="font-semibold">Chat History</span>
              <button
                onClick={createNewSession}
                className="text-green-600 hover:text-green-700"
              >
                <PlusCircle size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 && (
                <p className="text-center text-gray-400 mt-4">No conversations</p>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  className={`p-3 cursor-pointer border-b hover:bg-gray-200 ${activeSession === s.id ? "bg-gray-300 font-medium" : ""}`}
                >
                  <div className="text-sm truncate">{s.title || "New Chat"}</div>
                  <div className="text-[11px] text-gray-500">{formatTime(s.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MAIN CHAT AREA */}
          <div className="flex-1 flex flex-col">
            {/* HEADER */}
            <div className="p-3 border-b flex justify-between items-center bg-gray-100">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">Trợ lý AgriTrend</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-red-600 hover:text-red-700 font-bold"
              >
                X
              </button>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`p-3 rounded-lg max-w-[70%] ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
                    {msg.message}
                  </div>
                </div>
              ))}

              {/* HIỂN THỊ AI ĐANG GÕ */}
              {typingIndicator && !typingMessage && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-lg max-w-[70%] bg-gray-200">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* CHỮ CHẠY */}
              {typingMessage && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-lg max-w-[70%] bg-gray-200">
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

            {/* INPUT */}
            <form onSubmit={handleSend} className="p-3 border-t flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <Button
                type="submit"
                disabled={isLoading}
                className=" text-white px-4 py-2 rounded-lg  disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={18} />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
