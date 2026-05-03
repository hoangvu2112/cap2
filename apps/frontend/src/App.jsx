import { useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { socket } from "./socket"
import { AuthProvider, useAuth } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import AdminRoute from "./components/AdminRoute"
import RoleRoute from "./components/RoleRoute"
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
import Chat from "./pages/user/Chat"
import MySupplyPage from "./pages/user/MySupply" // <-- THÊM IMPORT
import DealerDashboard from "./pages/dealer/DealerDashboard"
import DealerSupplyHub from "./pages/dealer/DealerSupplyHub"
import DealerProductDetail from "./pages/dealer/DealerProductDetail"
import DealerPurchaseRequests from "./pages/dealer/DealerPurchaseRequests"
import DealerCommunity from "./pages/dealer/DealerCommunity"
import Negotiation from "./pages/shared/Negotiation"

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard"
import AdminProducts from "./pages/admin/Products"
import AdminUsers from "./pages/admin/Users"
import AdminNews from "./pages/admin/News"
import AdminStatistics from "./pages/admin/Statistics"
import AdminSettings from "./pages/admin/Settings"
import AdminDealers from "./pages/admin/Dealers"


import ChatBotWidget from "./components/ChatBotWidget"

function AppContent() {
  const { user } = useAuth()
  const isDealer = user?.role === "dealer"
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
        <Route path="/" element={<ProtectedRoute><MainLayout2>{isDealer ? <DealerDashboard /> : <Dashboard />}</MainLayout2></ProtectedRoute>} />
        <Route path="/product/:id" element={<ProtectedRoute><MainLayout2>{isDealer ? <DealerProductDetail /> : <ProductDetail />}</MainLayout2></ProtectedRoute>} />
        <Route path="/favorites" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><Favorites /></MainLayout2></RoleRoute>} />
        <Route path="/alerts" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><Alerts /></MainLayout2></RoleRoute>} />
        <Route path="/compare" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><Compare /></MainLayout2></RoleRoute>} />
        <Route path="/news" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><News /></MainLayout2></RoleRoute>} />
        <Route path="/purchase-requests" element={<RoleRoute allowedRoles={["dealer"]}><MainLayout2><DealerPurchaseRequests /></MainLayout2></RoleRoute>} />
        <Route path="/negotiation" element={<RoleRoute allowedRoles={["user", "dealer", "admin"]}><MainLayout2><Negotiation /></MainLayout2></RoleRoute>} />
        <Route path="/community" element={<ProtectedRoute><MainLayout2>{isDealer ? <DealerCommunity /> : <Community />}</MainLayout2></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><MainLayout2><Chat /></MainLayout2></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><MainLayout2><Profile /></MainLayout2></ProtectedRoute>} />
        <Route path="/map" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><PriceMap /></MainLayout2></RoleRoute>} />
        <Route path="/my-supply" element={<RoleRoute allowedRoles={["user"]}><MainLayout2><MySupplyPage /></MainLayout2></RoleRoute>} />
        <Route path="/dealer/supplies" element={<RoleRoute allowedRoles={["dealer"]}><MainLayout2><DealerSupplyHub /></MainLayout2></RoleRoute>} />

        {/* Admin routes — cũng dùng MainLayout2 */}
        <Route path="/admin" element={<AdminRoute><MainLayout2><AdminDashboard /></MainLayout2></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><MainLayout2><AdminProducts /></MainLayout2></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><MainLayout2><AdminUsers /></MainLayout2></AdminRoute>} />
        <Route path="/admin/news" element={<AdminRoute><MainLayout2><AdminNews /></MainLayout2></AdminRoute>} />
        <Route path="/admin/statistics" element={<AdminRoute><MainLayout2><AdminStatistics /></MainLayout2></AdminRoute>} />
        <Route path="/admin/dealers" element={<AdminRoute><MainLayout2><AdminDealers /></MainLayout2></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><MainLayout2><AdminSettings /></MainLayout2></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ChatBotWidget chỉ render khi user đã đăng nhập */}
      {user && user.role !== "admin" && <ChatBotWidget userId={user.id} userRole={user.role} />}
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
