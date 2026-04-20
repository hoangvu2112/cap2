import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom" // 1. Import hook điều hướng
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Package, TrendingUp, TrendingDown, Calendar, PlusCircle, ArrowRight } from "lucide-react"
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
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
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
  const [stats, setStats] = useState({
    users: 0,
    products: 0,
    priceUp: 0,
    priceDown: 0
  })
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, productsRes] = await Promise.all([
          api.get("/users"),
          api.get("/products/all")
        ])

        const usersData = usersRes.data || []
        const productsData = productsRes.data || []

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
    <div className="min-h-screen bg-background">
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

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Tổng Người dùng" value={stats.users} sub="Thành viên" icon={Users} trend="+12% tháng này" trendColor="text-green-600" bg="bg-blue-50 text-blue-600" />
          <StatCard title="Tổng Sản phẩm" value={stats.products} sub="Mặt hàng" icon={Package} trend="Đang theo dõi" trendColor="text-gray-600" bg="bg-indigo-50 text-indigo-600" />
          <StatCard title="Xu hướng Tăng" value={stats.priceUp} sub="Sản phẩm" icon={TrendingUp} trend="Tích cực" trendColor="text-green-600" bg="bg-green-50 text-green-600" />
          <StatCard title="Xu hướng Giảm" value={stats.priceDown} sub="Sản phẩm" icon={TrendingDown} trend="Cần lưu ý" trendColor="text-red-600" bg="bg-red-50 text-red-600" />
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
              {/* 3. Nút Xem tất cả -> Chuyển sang trang Products */}
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
                        onClick={() => navigate('/admin/products')} // Bấm vào dòng cũng chuyển trang
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
              {/* 4. Nút Quản lý -> Chuyển sang trang Users */}
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