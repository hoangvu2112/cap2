import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom" // 1. Import hook điều hướng
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Users, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  PlusCircle, 
  ArrowRight,
  DollarSign,
  CreditCard,
  ShieldCheck,
  Zap,
  Layers,
  RefreshCw
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const chartConfig = {
  users: {
    label: "Người dùng",
    color: "hsl(var(--chart-1))",
  },
  products: {
    label: "Sản phẩm",
    color: "hsl(var(--chart-2))",
  },
}

export default function AdminDashboard() {
  const navigate = useNavigate() // 2. Khởi tạo navigate
  const [activeTab, setActiveTab] = useState("overview") // "overview" | "finance"
  const [days, setDays] = useState("all")
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    priceUp: 0,
    priceDown: 0
  })
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [financials, setFinancials] = useState({
    summary: {
      totalDeposit: 0,
      revenueBreakdown: {
        commission: 0,
        pinPost: 0,
        upgradeRole: 0
      },
      totalRevenue: 0
    },
    roleStats: [],
    chartData: []
  })
  const [financialsLoading, setFinancialsLoading] = useState(true)

  // Fetch financials
  useEffect(() => {
    const fetchFinancials = async () => {
      setFinancialsLoading(true)
      try {
        const res = await api.get("/admin/statistics", { params: { days } })
        if (res.data?.success) {
          setFinancials(res.data.data)
        }
      } catch (error) {
        console.error("Lỗi tải thống kê dòng tiền:", error)
      } finally {
        setFinancialsLoading(false)
      }
    }
    
    if (activeTab === "finance") {
      fetchFinancials()
    }
  }, [days, activeTab])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, productsRes] = await Promise.all([
          api.get("/users"),
          api.get("/products", { params: { limit: 50 } })
        ])

        const usersData = usersRes.data || []
        const productsData = productsRes.data?.data || productsRes.data || []

        const upCount = productsData.filter(p => p.trend === 'up').length
        const downCount = productsData.filter(p => p.trend === 'down').length

        setStats({
          users: usersData.length,
          products: productsData.length,
          priceUp: upCount,
          priceDown: downCount
        })

        setProducts(productsData)
        setUsers(usersData)
      } catch (error) {
        console.error("Lỗi tải dashboard:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const userGrowthData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    return last7Days.map(date => {
      const count = users.filter(u => u.created_at && u.created_at.startsWith(date)).length
      const dateObj = new Date(date);
      const shortDate = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      return { date: shortDate, count, fullDate: date } 
    })
  }, [users])

  const categoryData = useMemo(() => {
    const categories = {}
    products.forEach(p => {
      const cat = p.category || "Khác"
      categories[cat] = (categories[cat] || 0) + 1
    })
    return Object.keys(categories).map(key => ({
      name: key,
      value: categories[key]
    })).sort((a, b) => b.value - a.value).slice(0, 5)
  }, [products])

  const recentProducts = useMemo(() => {
    return [...products].sort((a, b) => 
        new Date(b.lastUpdate) - new Date(a.lastUpdate)
    ).slice(0, 5)
  }, [products])

  const recentUsers = useMemo(() => {
    return [...users].sort((a, b) => 
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
    ).slice(0, 5)
  }, [users])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminNavbar />
      
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* HEADER VÀ NÚT TÁC VỤ NHANH */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard Quản trị</h1>
            <p className="text-muted-foreground mt-1">Tổng quan hiệu suất hệ thống và biến động thị trường hôm nay.</p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-3 py-2 rounded-md shadow-sm border border-border">
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </div>
             {/* Nút thêm nhanh sản phẩm */}
             <Button onClick={() => navigate('/admin/products')} className="bg-green-600 hover:bg-green-700">
                <PlusCircle className="w-4 h-4 mr-2" /> Thêm sản phẩm
             </Button>
             <Button onClick={() => navigate('/admin/settings')} variant="outline">
               Duyệt đại lý
             </Button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-border gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Tổng quan hệ thống
          </button>
          <button
            onClick={() => setActiveTab("finance")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "finance"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Báo cáo Tài chính & Doanh thu
          </button>
        </div>

        {activeTab === "overview" ? (
          <>
            {/* STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Tổng Người dùng" value={stats.users} sub="Thành viên" icon={Users} trend="+12% tháng này" trendColor="text-green-600" bg="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
              <StatCard title="Tổng Sản phẩm" value={stats.products} sub="Mặt hàng" icon={Package} trend="Đang theo dõi" trendColor="text-gray-600" bg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400" />
              <StatCard title="Xu hướng Tăng" value={stats.priceUp} sub="Sản phẩm" icon={TrendingUp} trend="Tích cực" trendColor="text-green-600" bg="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" />
              <StatCard title="Xu hướng Giảm" value={stats.priceDown} sub="Sản phẩm" icon={TrendingDown} trend="Cần lưu ý" trendColor="text-red-600" bg="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" />
            </div>

            {/* CHARTS AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <Card className="lg:col-span-4 border-none shadow-sm">
                <CardHeader>
                  <CardTitle>Tăng trưởng thành viên mới</CardTitle>
                  <CardDescription>Số lượng đăng ký trong 7 ngày qua</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart data={userGrowthData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                          dataKey="date" 
                          tickLine={false} 
                          axisLine={false} 
                          tickMargin={10}
                          fontSize={12}
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                      <Bar 
                          dataKey="count" 
                          name="Thành viên" 
                          fill="#3b82f6" 
                          radius={[4, 4, 0, 0]} 
                          barSize={40}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 border-none shadow-sm flex flex-col">
                <CardHeader>
                  <CardTitle>Cơ cấu Sản phẩm</CardTitle>
                  <CardDescription>Phân bổ theo danh mục nông sản</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-[300px]">
                  <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* TABLES & BUTTONS XỬ LÝ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Bảng giá */}
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Biến động thị trường</CardTitle>
                    <CardDescription>Cập nhật giá mới nhất</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1"
                    onClick={() => navigate('/admin/products')}
                  >
                    Xem chi tiết <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nông sản</TableHead>
                        <TableHead>Giá hiện tại</TableHead>
                        <TableHead className="text-right">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentProducts.map((p) => (
                        <TableRow 
                            key={p.id} 
                            className="cursor-pointer hover:bg-muted/60"
                            onClick={() => navigate('/admin/products')}
                        >
                          <TableCell>
                            <div className="font-medium text-foreground">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.region}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{Number(p.currentPrice).toLocaleString()} ₫</div>
                            <div className="text-xs text-muted-foreground">
                                 {new Date(p.lastUpdate).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.trend === 'up' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none shadow-none"><TrendingUp className="w-3 h-3 mr-1" /> Tăng</Badge>}
                            {p.trend === 'down' && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none shadow-none"><TrendingDown className="w-3 h-3 mr-1" /> Giảm</Badge>}
                            {p.trend === 'stable' && <Badge variant="secondary" className="text-muted-foreground bg-muted shadow-none">Ổn định</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Bảng Users */}
              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Thành viên mới</CardTitle>
                    <CardDescription>Người dùng vừa gia nhập</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1"
                    onClick={() => navigate('/admin/users')}
                  >
                    Quản lý User <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                    {recentUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold shadow-sm">
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                                <p className="font-medium text-foreground group-hover:text-primary transition-colors">{u.name || "Chưa đặt tên"}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                        </div>
                      </div>
                    ))}
                    {recentUsers.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">Chưa có dữ liệu</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          /* BÁO CÁO TÀI CHÍNH & DOANH THU */
          <div className="space-y-6">
            {/* TIÊU ĐỀ PHÂN HỆ VÀ BỘ LỌC THỜI GIAN */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" /> Báo cáo Doanh thu & Dòng tiền
                </h2>
                <p className="text-xs text-muted-foreground">Theo dõi toàn bộ biến động tài chính của nền tảng</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Thời gian:</span>
                {["all", 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      days === d
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-background text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {d === "all" ? "Tất cả" : `${d} ngày qua`}
                  </button>
                ))}
                <button 
                  onClick={() => setDays(days)} 
                  className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-all ml-1"
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {financialsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground animate-pulse font-semibold">Đang tổng hợp dữ liệu tài chính...</p>
              </div>
            ) : (
              <>
                {/* FINANCIAL SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard 
                    title="Tổng Tiền Nạp" 
                    value={`${Number(financials.summary.totalDeposit).toLocaleString()} ₫`} 
                    sub="Ví người dùng" 
                    icon={CreditCard} 
                    bg="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" 
                  />
                  <StatCard 
                    title="Doanh thu Hoa Hồng" 
                    value={`${Number(financials.summary.revenueBreakdown?.commission || 0).toLocaleString()} ₫`} 
                    sub="Khớp đơn hàng" 
                    icon={Layers} 
                    bg="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" 
                  />
                  <StatCard 
                    title="Doanh thu Ghim Bài" 
                    value={`${Number(financials.summary.revenueBreakdown?.pinPost || 0).toLocaleString()} ₫`} 
                    sub="Tin ghim nổi bật" 
                    icon={Zap} 
                    bg="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" 
                  />
                  <StatCard 
                    title="Doanh thu Nâng Cấp" 
                    value={`${Number(financials.summary.revenueBreakdown?.upgradeRole || 0).toLocaleString()} ₫`} 
                    sub="Đăng ký Đại lý" 
                    icon={ShieldCheck} 
                    bg="bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400" 
                  />
                  
                  {/* DOANH THU THỰC - HIGHLIGHTED */}
                  <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 hover:shadow-md transition-all duration-200 border-l-4 border-green-600">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-green-600 text-white">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 dark:bg-green-900/50 dark:text-green-400 px-2 py-1 rounded-full">
                          Doanh thu thực
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Tổng Doanh Thu</p>
                        <div className="flex items-baseline gap-1">
                          <h3 className="text-2xl font-black text-green-700 dark:text-green-400">
                            {Number(financials.summary.totalRevenue).toLocaleString()} ₫
                          </h3>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* FINANCIAL CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                  {/* BIỂU ĐỒ ĐƯỜNG: DOANH THU VÀ TIỀN NẠP HÀNG NGÀY */}
                  <Card className="lg:col-span-4 border-none shadow-sm">
                    <CardHeader>
                      <CardTitle>Biến động tài chính hàng ngày</CardTitle>
                      <CardDescription>Xu hướng dòng tiền nạp và doanh thu theo thời gian</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {financials.chartData.length > 0 ? (
                        <div className="h-[320px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={financials.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorDeposit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis 
                                dataKey="date" 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={10}
                                fontSize={11}
                              />
                              <YAxis 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                                fontSize={11}
                              />
                              <Tooltip 
                                formatter={(value) => [`${Number(value).toLocaleString()} ₫`]}
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px' }}
                              />
                              <Legend verticalAlign="top" height={36}/>
                              <Area 
                                type="monotone" 
                                dataKey="deposit" 
                                name="Tiền nạp vào" 
                                stroke="#3b82f6" 
                                fillOpacity={1} 
                                fill="url(#colorDeposit)" 
                                strokeWidth={2}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                name="Doanh thu sàn" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorRevenue)" 
                                strokeWidth={2.5}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu biểu đồ cho khoảng thời gian này
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* BIỂU ĐỒ TRÒN: CƠ CẤU TIỀN NẠP THEO ROLE */}
                  <Card className="lg:col-span-3 border-none shadow-sm flex flex-col">
                    <CardHeader>
                      <CardTitle>Cơ cấu nạp tiền</CardTitle>
                      <CardDescription>Phân bổ dòng tiền nạp vào hệ thống theo vai trò</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between min-h-[320px]">
                      {financials.roleStats.length > 0 ? (
                        <>
                          <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={financials.roleStats}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={4}
                                  dataKey="totalDeposited"
                                  nameKey="role"
                                >
                                  {financials.roleStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value) => [`${Number(value).toLocaleString()} ₫`]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          
                          {/* CUSTOM LEGEND VỚI SỐ TIỀN THỰC TẾ */}
                          <div className="space-y-2 mt-4">
                            {financials.roleStats.map((item, index) => (
                              <div key={item.role} className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                  <span className="font-semibold text-muted-foreground">{item.role}</span>
                                </div>
                                <span className="font-bold text-foreground">{Number(item.totalDeposited).toLocaleString()} ₫</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Chưa ghi nhận giao dịch nạp tiền nào
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ title, value, sub, icon: Icon, trend, trendColor, bg }) {
  return (
    <Card className="border-none shadow-sm bg-card hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${bg}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <span className={`text-xs font-medium ${trendColor} bg-card px-2 py-1 rounded-full border border-border shadow-sm`}>
              {trend}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-foreground">{value}</h3>
            <span className="text-xs text-muted-foreground">{sub}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}