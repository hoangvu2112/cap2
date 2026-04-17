import { useState, useEffect } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownRight, TrendingUp, MapPin, PieChart as PieIcon } from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const chartConfig = {
  price: { label: "Giá", color: "hsl(var(--primary))" },
  count: { label: "Số lượng", color: "hsl(var(--chart-2))" },
}

export default function AdminStatistics() {
  const [timeRange, setTimeRange] = useState("7d")
  const [loading, setLoading] = useState(true)
  
  const [data, setData] = useState({
    priceVolatilityData: [],
    regionData: [],
    categoryDistribution: [],
    topGainers: [],
    topLosers: []
  })

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/stats/advanced?range=${timeRange}`)
        setData({
          priceVolatilityData: res.data.priceVolatilityData || [],
          regionData: res.data.regionData || [],
          categoryDistribution: res.data.categoryData || [],
          topGainers: res.data.topGainers || [],
          topLosers: res.data.topLosers || []
        })
      } catch (error) {
        console.error("Lỗi tải thống kê:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [timeRange])

  const productKeys = data.priceVolatilityData.length > 0 
    ? Object.keys(data.priceVolatilityData[0]).filter(k => k !== 'date' && k !== 'dateStr') 
    : []

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminNavbar />
      
      {/* Thêm overflow-x-hidden để đảm bảo trang không bị trôi ngang */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 overflow-x-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Phân tích chuyên sâu</h1>
            <p className="text-gray-500 mt-1">Số liệu chi tiết về thị trường và hệ thống.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
            <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px] border-none shadow-none focus:ring-0">
                    <SelectValue placeholder="Chọn khoảng thời gian" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="7d">7 ngày qua</SelectItem>
                    <SelectItem value="30d">30 ngày qua</SelectItem>
                    <SelectItem value="90d">Quý này</SelectItem>
                    <SelectItem value="1y">Năm nay</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="market" className="space-y-6 w-full">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2">
            <TabsTrigger value="market">Thị trường & Giá cả</TabsTrigger>
            <TabsTrigger value="system">Hệ thống & Người dùng</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-6 w-full">
            
            {/* --- FIX LỖI TRÀN --- */}
            <Card className="border-none shadow-sm overflow-hidden w-full">
                <CardHeader>
                    <CardTitle>Biến động giá tiêu biểu</CardTitle>
                    <CardDescription>Xu hướng giá các mặt hàng chủ lực ({timeRange})</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {/* Bọc trong div min-w-0 để ép biểu đồ co lại */}
                    <div className="h-[350px] w-full min-w-0">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-gray-400">Đang tải dữ liệu...</div>
                        ) : data.priceVolatilityData.length > 0 ? (
                            /* Thêm aspect-auto để ghi đè class mặc định, giúp chart ăn theo chiều cao 350px */
                            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                                <AreaChart data={data.priceVolatilityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        {productKeys.map((key, index) => (
                                            <linearGradient key={key} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0}/>
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} width={40} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    {productKeys.map((key, index) => (
                                        <Area 
                                            key={key}
                                            type="monotone" 
                                            dataKey={key} 
                                            stroke={COLORS[index % COLORS.length]} 
                                            fillOpacity={1} 
                                            fill={`url(#color-${index})`} 
                                            name={key}
                                        />
                                    ))}
                                    <Legend />
                                </AreaChart>
                            </ChartContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">Chưa có dữ liệu biến động giá</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Chart Phân bổ vùng: Cũng áp dụng fix tương tự */}
                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-orange-500" />
                            Phân bổ theo khu vực
                        </CardTitle>
                        <CardDescription>Tin đăng theo tỉnh thành</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full min-w-0">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">Đang tải...</div>
                            ) : (
                                <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                                    <BarChart data={data.regionData} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="region" type="category" width={100} axisLine={false} tickLine={false} fontSize={12} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" name="Số lượng" fill="#f97316" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6 min-w-0">
                    <Card className="border-none shadow-sm bg-green-50/50 border-green-100 overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-green-700 text-lg flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" /> Tăng trưởng mạnh
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {loading ? <p className="text-sm text-gray-500">Đang tải...</p> : 
                                 data.topGainers.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{item.region}</p>
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                            <p className="font-bold text-green-600">+{item.percent}%</p>
                                            <p className="text-xs text-gray-400">{Number(item.currentPrice).toLocaleString()} đ</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-red-50/50 border-red-100 overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-red-700 text-lg flex items-center gap-2">
                                <ArrowDownRight className="w-5 h-5" /> Giảm sâu
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-4">
                                {loading ? <p className="text-sm text-gray-500">Đang tải...</p> : 
                                 data.topLosers.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{item.region}</p>
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                            <p className="font-bold text-red-600">{item.percent}%</p>
                                            <p className="text-xs text-gray-400">{Number(item.currentPrice).toLocaleString()} đ</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-blue-500" />
                            Cơ cấu Danh mục
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <div className="h-[300px] w-full max-w-[400px]">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">Đang tải...</div>
                            ) : (
                                <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                                    <PieChart>
                                        <Pie 
                                            data={data.categoryDistribution} 
                                            cx="50%" cy="50%" 
                                            innerRadius={60} outerRadius={100} 
                                            paddingAngle={5} 
                                            dataKey="value"
                                        >
                                            {data.categoryDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ChartContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}