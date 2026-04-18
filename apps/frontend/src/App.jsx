import { useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { socket } from "./socket"
import { AuthProvider, useAuth } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import AdminRoute from "./components/AdminRoute"
import MainLayout2 from "./components/MainLayout2"

// Auth pages
import Login from "./pages/auth/Login2"
import Register from "./pages/auth/Register2"
import ForgotPassword from "./pages/auth/Forgot-Password2"
import ResetPassword from "./pages/auth/Reset-Password2"

// User pages
import Dashboard from "./pages/user/Dashboard"
import ProductDetail from "./pages/user/ProductDetail"
import Favorites from "./pages/user/Favorites"
import Alerts from "./pages/user/Alerts"
import Compare from "./pages/user/Compare"
import Community from "./pages/user/Community"
import Profile from "./pages/user/Profile"
import PriceMap from "./pages/user/PriceMap"
import News from "./pages/user/News"

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard"
import AdminProducts from "./pages/admin/Products"
import AdminUsers from "./pages/admin/Users"
import AdminNews from "./pages/admin/News"
import AdminStatistics from "./pages/admin/Statistics"
import AdminSettings from "./pages/admin/Settings"

import ChatBotWidget from "./components/ChatBotWidget"

function AppContent() {
  const { user } = useAuth()
  console.log("Current user in AppContent:", user);

  useEffect(() => {
    // Lắng nghe sự kiện socket kết nối thành công ở phạm vi toàn cục
    socket.on("connect", () => {
      console.log("🟢 Global Socket Connected! ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Global Socket Disconnected!");
    });

    // Cleanup khi unmount
    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return (
    <>
      <Routes>
        {/* Public routes — không dùng MainLayout2 (dùng AuthLayout riêng) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes — bọc trong MainLayout2 */}
        <Route path="/" element={<ProtectedRoute><MainLayout2><Dashboard /></MainLayout2></ProtectedRoute>} />
        <Route path="/product/:id" element={<ProtectedRoute><MainLayout2><ProductDetail /></MainLayout2></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><MainLayout2><Favorites /></MainLayout2></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><MainLayout2><Alerts /></MainLayout2></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute><MainLayout2><Compare /></MainLayout2></ProtectedRoute>} />
        <Route path="/news" element={<ProtectedRoute><MainLayout2><News /></MainLayout2></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><MainLayout2><Community /></MainLayout2></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><MainLayout2><Profile /></MainLayout2></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MainLayout2><PriceMap /></MainLayout2></ProtectedRoute>} />

        {/* Admin routes — cũng dùng MainLayout2 */}
        <Route path="/admin" element={<AdminRoute><MainLayout2><AdminDashboard /></MainLayout2></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><MainLayout2><AdminProducts /></MainLayout2></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><MainLayout2><AdminUsers /></MainLayout2></AdminRoute>} />
        <Route path="/admin/news" element={<AdminRoute><MainLayout2><AdminNews /></MainLayout2></AdminRoute>} />
        <Route path="/admin/statistics" element={<AdminRoute><MainLayout2><AdminStatistics /></MainLayout2></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><MainLayout2><AdminSettings /></MainLayout2></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ChatBotWidget chỉ render khi user đã đăng nhập */}
      {user && <ChatBotWidget userId={user.id} />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
