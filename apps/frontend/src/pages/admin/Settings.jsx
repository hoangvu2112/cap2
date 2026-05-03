import { useEffect, useState } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RefreshCw, Server, ShieldCheck, LogOut } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { useNavigate } from "react-router-dom"

export default function AdminSettings() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const [scraperRunning, setScraperRunning] = useState(false)

  // Hàm chạy Scraper thủ công (gọi API thật)
  const handleRunScraper = async () => {
    setScraperRunning(true)
    try {
      const res = await api.post("/admin/scrape-trigger")
      toast({ title: "Thành công", description: res.data.message || "Hệ thống đang cào dữ liệu mới..." })
    } catch (error) {
      const msg = error.response?.data?.error || "Không thể kích hoạt Scraper"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    } finally {
      setScraperRunning(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-[#fcfaf8]">
      <AdminNavbar />
      <main className="max-w-3xl mx-auto px-6 py-8">
        
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cài đặt Hệ thống</h1>

        <div className="space-y-6">
          
          {/* 1. THÔNG TIN ADMIN */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" /> 
                Tài khoản Quản trị
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    A
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user?.name || "Admin"}</div>
                    <div className="text-xs text-gray-500">{user?.email}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. ĐIỀU KHIỂN SCRAPER */}
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="w-5 h-5 text-blue-600" /> 
                Hệ thống Cào dữ liệu (Scraper)
              </CardTitle>
              <CardDescription>
                Điều khiển các tác vụ tự động của hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Kích hoạt Tự động (Cron Job)</Label>
                  <p className="text-sm text-gray-500">Tự động cào giá mỗi 30 phút.</p>
                </div>
                <Switch checked={true} disabled /> {/* Mặc định luôn bật */}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base">Chạy thủ công</Label>
                  <p className="text-sm text-gray-500 text-right">Dùng khi cần cập nhật giá gấp.</p>
                </div>
                <Button 
                  onClick={handleRunScraper} 
                  disabled={scraperRunning}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {scraperRunning ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
                  ) : (
                    "🚀 Kích hoạt Scraper Ngay"
                  )}
                </Button>
              </div>

            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}