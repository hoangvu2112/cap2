import { useState, useEffect, useMemo } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import api from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, X, BarChartHorizontal, TrendingUp, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

// Bảng màu Vivid (Rực rỡ) để nổi bật trên nền Earth
const COLORS = [
  { stroke: "#10b981", fill: "#10b981" }, // Emerald (Xanh ngọc)
  { stroke: "#f59e0b", fill: "#f59e0b" }, // Amber (Hổ phách)
  { stroke: "#3b82f6", fill: "#3b82f6" }, // Blue (Xanh biển)
  { stroke: "#ef4444", fill: "#ef4444" }, // Red (Đỏ)
  { stroke: "#8b5cf6", fill: "#8b5cf6" }, // Violet (Tím)
];

export default function Compare() {
  const [allProducts, setAllProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const categories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.category));
    return Array.from(cats).filter(Boolean);
  }, [allProducts]);

  const availableProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return allProducts.filter(p => p.category === selectedCategory);
  }, [allProducts, selectedCategory]);

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    setSelectedProducts([]); // Reset khi đổi danh mục
  };

  // Dữ liệu biểu đồ
  const [growthData, setGrowthData] = useState([]); // Dữ liệu %
  const [priceData, setPriceData] = useState([]);   // Dữ liệu VNĐ

  const [viewMode, setViewMode] = useState("growth"); // 'growth' | 'price'
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);

  // 1. Tải danh sách sản phẩm
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await api.get("/products/all");
        setAllProducts(res.data);
      } catch (error) {
        console.error("Lỗi tải danh sách:", error);
      } finally {
        setLoadingList(false);
      }
    };
    fetchAll();
  }, []);

  // 2. Xử lý dữ liệu khi danh sách chọn thay đổi
  useEffect(() => {
    if (selectedProducts.length === 0) {
      setGrowthData([]);
      setPriceData([]);
      return;
    }

    const fetchData = async () => {
      setLoadingChart(true);
      try {
        // A. Lấy dữ liệu Tăng trưởng (Dùng API compare cũ)
        const productIds = selectedProducts.map(p => p.id);
        const growthRes = await api.post("/products/compare", { productIds });
        setGrowthData(growthRes.data);

        // B. Lấy dữ liệu Giá thực (Gọi song song API chi tiết từng sp)
        // Đây là kỹ thuật "Client-side Merging" để không cần sửa Backend ngay
        const pricePromises = selectedProducts.map(p => api.get(`/products/${p.id}?range=30d`));
        const priceResponses = await Promise.all(pricePromises);

        // Trộn dữ liệu giá: { date: "...", "Cà phê": 120000, "Tiêu": 95000 }
        const mergedPriceData = {};

        priceResponses.forEach((res, index) => {
          const product = selectedProducts[index];
          const history = res.data.history || []; // Giả sử API trả về { history: [...] }

          history.forEach(point => {
            // Chuẩn hóa ngày (bỏ giờ phút để group theo ngày)
            const dateKey = point.date ? new Date(point.date).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' }) : "N/A";

            if (!mergedPriceData[dateKey]) mergedPriceData[dateKey] = { date: dateKey };
            mergedPriceData[dateKey][product.name] = point.price;
          });
        });

        // Chuyển object thành array và sort theo ngày
        const finalPriceArray = Object.values(mergedPriceData).sort((a, b) => {
          const [d1, m1] = a.date.split("/");
          const [d2, m2] = b.date.split("/");
          const currentYear = new Date().getFullYear();
          return new Date(currentYear, m1 - 1, d1) - new Date(currentYear, m2 - 1, d2);
        });

        setPriceData(finalPriceArray);

      } catch (error) {
        console.error("Lỗi tải dữ liệu so sánh:", error);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchData();
  }, [selectedProducts]);

  const handleSelectProduct = (productId) => {
    if (!productId || selectedProducts.length >= 5) return;
    if (selectedProducts.find(p => String(p.id) === String(productId))) return;
    const productToAdd = allProducts.find(p => String(p.id) === String(productId));
    if (productToAdd) setSelectedProducts([...selectedProducts, productToAdd]);
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // Tính toán bảng chỉ số "Đối đầu" (Head-to-Head)
  const stats = useMemo(() => {
    if (priceData.length === 0) return {};

    const result = {};
    selectedProducts.forEach(p => {
      // Lấy mảng giá của sản phẩm này từ priceData
      const prices = priceData
        .map(row => row[p.name])
        .filter(val => val !== undefined && val !== null);

      if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const current = prices[prices.length - 1];
        const first = prices[0];
        const growth = first > 0 ? ((current - first) / first) * 100 : 0;

        // Tính độ biến động (Standard Deviation đơn giản)
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance);

        result[p.id] = { min, max, growth, volatility, current };
      }
    });
    return result;
  }, [priceData, selectedProducts]);

  return (
    <div className="min-h-screen bg-background"> {/* Nền Agri-Earth */}
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChartHorizontal className="w-8 h-8 text-primary" />
              So sánh Thị trường
            </h1>
            <p className="text-muted-foreground mt-1">Phân tích chuyên sâu về giá và tốc độ tăng trưởng.</p>
          </div>

          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2 bg-accent/50 p-1 border border-border">
              <TabsTrigger value="growth" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Tăng trưởng (%)
              </TabsTrigger>
              <TabsTrigger value="price" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-2" />
                Giá thực (VNĐ)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Selection Area */}
        <Card className="mb-8 border-none shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    1. Chọn loại sản phẩm
                  </label>
                  <Select
                    value={selectedCategory}
                    onValueChange={handleCategoryChange}
                    disabled={loadingList}
                  >
                    <SelectTrigger className="bg-card border-border h-11 focus:ring-primary">
                      <SelectValue placeholder={loadingList ? "Đang tải..." : "Chọn danh mục..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    2. Thêm mặt hàng so sánh (Tối đa 5)
                  </label>
                  <Select
                    value=""
                    onValueChange={handleSelectProduct}
                    disabled={!selectedCategory || loadingList || selectedProducts.length >= 5}
                  >
                    <SelectTrigger className="bg-card border-border h-11 focus:ring-primary">
                      <SelectValue placeholder={!selectedCategory ? "Vui lòng chọn loại trước" : "Chọn nông sản..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <div className="flex items-center justify-between w-full min-w-[200px]">
                            <span>{p.name}</span>
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs font-normal text-muted-foreground"
                            >
                              {p.region}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-[2]">
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Đang chọn ({selectedCategory || "Chưa chọn loại"}):
                </label>
                <div className="flex flex-wrap gap-3 min-h-[44px] items-center p-2 bg-muted/50 rounded-lg border border-dashed border-border">
                  {selectedProducts.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4" /> Chọn sản phẩm bên trái để bắt đầu
                    </span>
                  ) : (
                    selectedProducts.map((p, index) => (
                      <Badge
                        key={p.id}
                        className="text-sm py-1.5 pl-3 pr-1 gap-2 bg-card border border-border text-foreground shadow-sm hover:bg-muted transition-all"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length].fill }}></span>
                        {p.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 rounded-full hover:bg-red-100 hover:text-red-600 ml-1"
                          onClick={() => handleRemoveProduct(p.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Chart */}
        <Card className="mb-8 border-none shadow-md bg-card overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/30 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              {viewMode === 'growth' ? (
                <>Biểu đồ Tăng trưởng <span className="text-sm font-normal text-muted-foreground ml-auto">(Gốc = 100%)</span></>
              ) : (
                <>Biểu đồ Giá cả <span className="text-sm font-normal text-muted-foreground ml-auto">(Đơn vị: VNĐ)</span></>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[500px] w-full pt-6">
            {loadingChart ? (
              <div className="flex flex-col justify-center items-center h-full gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Đang phân tích dữ liệu...</span>
              </div>
            ) : selectedProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewMode === 'growth' ? growthData : priceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tickFormatter={(value) => viewMode === 'growth' ? `${value.toFixed(0)}%` : `${(value / 1000).toFixed(0)}k`}
                    domain={['auto', 'auto']}
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value) => viewMode === 'growth' ? `${value.toFixed(2)}%` : `${value.toLocaleString()} ₫`}
                    labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '0.5rem' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {selectedProducts.map((p, index) => (
                    <Area
                      key={p.id}
                      type="monotone"
                      dataKey={p.name}
                      stroke={COLORS[index % COLORS.length].stroke}
                      fillOpacity={1}
                      fill={`url(#color${index})`}
                      strokeWidth={1}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 opacity-50" />
                </div>
                <p>Vui lòng chọn sản phẩm để hiển thị biểu đồ</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Head-to-Head Stats Table */}
        {selectedProducts.length > 0 && !loadingChart && (
          <div className="grid grid-cols-1 overflow-x-auto">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Bảng chỉ số "Đối đầu"
            </h2>
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-6 py-4 w-1/4">Chỉ số so sánh</th>
                    {selectedProducts.map((p, i) => (
                      <th key={p.id} className="px-6 py-4" style={{ color: COLORS[i % COLORS.length].stroke }}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {/* Giá hiện tại */}
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">Giá hiện tại</td>
                    {selectedProducts.map(p => (
                      <td key={p.id} className="px-6 py-4 text-lg font-bold">
                        {stats[p.id]?.current?.toLocaleString() || "---"} ₫
                      </td>
                    ))}
                  </tr>

                  {/* Tăng trưởng */}
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">Tăng trưởng (30 ngày)</td>
                    {selectedProducts.map(p => {
                      const g = stats[p.id]?.growth || 0;
                      return (
                        <td key={p.id} className="px-6 py-4">
                          <Badge variant={g >= 0 ? "default" : "destructive"} className={g >= 0 ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"}>
                            {g >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                            {Math.abs(g).toFixed(2)}%
                          </Badge>
                        </td>
                      )
                    })}
                  </tr>

                  {/* Cao nhất / Thấp nhất */}
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">Đỉnh / Đáy (30 ngày)</td>
                    {selectedProducts.map(p => (
                      <td key={p.id} className="px-6 py-4 text-muted-foreground">
                        <span className="text-green-600 font-medium">↑ {stats[p.id]?.max?.toLocaleString()}</span>
                        <span className="mx-2 text-border">|</span>
                        <span className="text-red-500 font-medium">↓ {stats[p.id]?.min?.toLocaleString()}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Độ ổn định */}
                  <tr className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">Độ biến động giá</td>
                    {selectedProducts.map(p => {
                      const vol = stats[p.id]?.volatility || 0;
                      // Giả định: biến động > 2000đ là cao (tùy mặt hàng, đây là logic demo)
                      const isStable = vol < 2000;
                      return (
                        <td key={p.id} className="px-6 py-4">
                          {isStable ? (
                            <span className="inline-flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                              🛡️ Ổn định
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-medium border border-orange-100">
                              ⚡ Biến động mạnh
                            </span>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">Lệch chuẩn: ±{vol.toFixed(0)}đ</div>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}