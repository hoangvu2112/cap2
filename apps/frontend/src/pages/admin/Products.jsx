"use client"

import { useState, useEffect } from "react"
import { 
  Plus, Edit, Trash2, Search, ArrowUp, ArrowDown, Minus, Filter 
} from "lucide-react"
import { io } from "socket.io-client"
import AdminNavbar from "../../components/AdminNavbar"
import api from "../../lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  
  // --- MỚI: State bộ lọc xu hướng ---
  const [trendFilter, setTrendFilter] = useState("all") // 'all', 'up', 'down', 'stable'

  // State Modal
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    currentPrice: "",
    unit: "kg",
    region: "",
    quantity_available: "",
    harvest_start: "",
    harvest_end: "",
    farmer_user_id: "",
  })
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryName, setCategoryName] = useState("")

  const { toast } = useToast()

  // Fetch dữ liệu
  const fetchProducts = async () => {
    try {
      const res = await api.get("/products/all")
      const data = res.data.map((p) => {
        // Tính toán xu hướng dựa trên dữ liệu tải về
        const current = Number(p.currentPrice)
        const prev = Number(p.previousPrice || p.currentPrice)
        let trend = "stable"
        if (current > prev) trend = "up"
        if (current < prev) trend = "down"

        return {
          ...p,
          currentPrice: current,
          previousPrice: prev,
          trend: trend, 
        }
      })
      setProducts(data)
    } catch (e) {
      console.error("❌ Lỗi lấy sản phẩm:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get("/products/categorie")
      setCategories(res.data)
    } catch (e) {
      console.error("❌ Lỗi lấy loại:", e)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()

    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000")
    socket.on("priceUpdate", (data) => {
      setProducts((prev) =>
        prev.map((p) => {
            if (p.id === data.id) {
                const newPrice = Number(data.newPrice)
                const oldPrice = p.currentPrice
                return {
                    ...p,
                    previousPrice: oldPrice,
                    currentPrice: newPrice,
                    trend: newPrice > oldPrice ? "up" : newPrice < oldPrice ? "down" : "stable",
                }
            }
            return p
        })
      )
    })
    return () => socket.disconnect()
  }, [])

  // Xử lý lưu sản phẩm
  const handleSaveProduct = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...productForm,
        currentPrice: Number(productForm.currentPrice),
        previousPrice: Number(editingProduct?.currentPrice || productForm.currentPrice),
        quantity_available: Number(productForm.quantity_available || 0),
        harvest_start: productForm.harvest_start || null,
        harvest_end: productForm.harvest_end || null,
        farmer_user_id: productForm.farmer_user_id ? Number(productForm.farmer_user_id) : null,
      }
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload)
        toast({ title: "Thành công", description: "Đã cập nhật sản phẩm" })
      } else {
        await api.post("/products", payload)
        toast({ title: "Thành công", description: "Đã thêm sản phẩm mới" })
      }
      fetchProducts()
      setShowProductModal(false)
      resetProductForm()
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể lưu sản phẩm", variant: "destructive" })
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!confirm("Xoá sản phẩm này?")) return
    try {
      await api.delete(`/products/${id}`)
      setProducts(products.filter(p => p.id !== id))
      toast({ title: "Đã xóa", description: "Sản phẩm đã bị xóa" })
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xóa sản phẩm", variant: "destructive" })
    }
  }

  const openProductModal = (p = null) => {
    if (p) {
      setEditingProduct(p)
      setProductForm({
        name: p.name,
        category: p.category,
        currentPrice: p.currentPrice,
        unit: p.unit,
        region: p.region,
        quantity_available: p.quantity_available ?? "",
        harvest_start: p.harvest_start ? String(p.harvest_start).slice(0, 10) : "",
        harvest_end: p.harvest_end ? String(p.harvest_end).slice(0, 10) : "",
        farmer_user_id: p.farmer_user_id ?? "",
      })
    } else {
      resetProductForm()
    }
    setShowProductModal(true)
  }

  const resetProductForm = () => {
    setEditingProduct(null)
    setProductForm({
      name: "",
      category: "",
      currentPrice: "",
      unit: "kg",
      region: "",
      quantity_available: "",
      harvest_start: "",
      harvest_end: "",
      farmer_user_id: "",
    })
  }

  // Xử lý danh mục (giữ nguyên logic cũ)
  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!categoryName.trim()) return
    try {
      if (editingCategory) {
        await api.put(`/products/categories/${editingCategory.id}`, { name: categoryName.trim() })
        toast({ title: "Thành công", description: "Đã cập nhật danh mục" })
      } else {
        await api.post("/products/categories", { name: categoryName.trim() })
        toast({ title: "Thành công", description: "Đã tạo danh mục mới" })
      }
      fetchCategories()
      setShowCategoryModal(false)
      setCategoryName("")
      setEditingCategory(null)
    } catch (error) {
      toast({ title: "Lỗi", description: "Lỗi lưu danh mục", variant: "destructive" })
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!confirm("Xoá danh mục này?")) return
    try {
      await api.delete(`/products/categories/${id}`)
      fetchCategories()
      toast({ title: "Đã xóa", description: "Danh mục đã bị xóa" })
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xoá danh mục", variant: "destructive" })
    }
  }

  // --- LOGIC LỌC SẢN PHẨM ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.region.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Logic lọc theo xu hướng
    let matchesTrend = true
    if (trendFilter === "up") matchesTrend = p.trend === "up"
    else if (trendFilter === "down") matchesTrend = p.trend === "down"
    else if (trendFilter === "stable") matchesTrend = p.trend === "stable"

    return matchesSearch && matchesTrend
  })

  return (
    <div className="min-h-screen bg-background">
      <AdminNavbar />
      <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quản lý Kho hàng</h1>
            <p className="text-muted-foreground mt-1">Quản lý danh sách nông sản, giá cả và danh mục hệ thống.</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
              <TabsTrigger value="products">Sản phẩm</TabsTrigger>
              <TabsTrigger value="categories">Danh mục</TabsTrigger>
            </TabsList>
            
            {/* THANH CÔNG CỤ TÌM KIẾM & LỌC */}
            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-2">
              
              {/* 1. Select Lọc Xu hướng */}
              <Select value={trendFilter} onValueChange={setTrendFilter}>
                <SelectTrigger className="w-full sm:w-[160px] bg-card">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder="Lọc xu hướng" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tất cả giá</SelectItem>
                    <SelectItem value="up" className="text-green-600 font-medium">Đang tăng ↗</SelectItem>
                    <SelectItem value="down" className="text-red-600 font-medium">Đang giảm ↘</SelectItem>
                    <SelectItem value="stable">Ổn định</SelectItem>
                </SelectContent>
              </Select>

              {/* 2. Input Tìm kiếm */}
              <div className="relative flex-1 sm:w-64 w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên hoặc khu vực..."
                  className="pl-9 bg-card"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* 3. Nút Thêm mới */}
              <Button onClick={() => openProductModal()} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Thêm mới
              </Button>
            </div>
          </div>

          <TabsContent value="products">
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto"> 
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Tên sản phẩm</TableHead>
                        <TableHead>Danh mục</TableHead>
                        <TableHead>Giá hiện tại</TableHead>
                        <TableHead>Biến động</TableHead> {/* Cột mới */}
                        <TableHead>Khu vực</TableHead>
                        <TableHead className="text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                         <TableRow><TableCell colSpan={6} className="h-24 text-center">Đang tải...</TableCell></TableRow>
                      ) : filteredProducts.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Không tìm thấy sản phẩm</TableCell></TableRow>
                      ) : (
                        filteredProducts.map((p) => {
                            // Tính chênh lệch giá
                            const diff = p.currentPrice - (p.previousPrice || p.currentPrice);
                            
                            return (
                                <TableRow key={p.id} className="group hover:bg-muted/50">
                                    <TableCell className="font-medium text-foreground whitespace-nowrap">{p.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal whitespace-nowrap">{p.category}</Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        <span className="font-bold text-foreground">
                                            {p.currentPrice.toLocaleString("vi-VN")} đ
                                        </span>
                                        <span className="text-muted-foreground text-sm ml-1">/ {p.unit}</span>
                                    </TableCell>
                                    
                                    {/* CỘT HIỂN THỊ XU HƯỚNG RÕ RÀNG */}
                                    <TableCell className="whitespace-nowrap">
                                        {p.trend === 'up' && (
                                            <div className="flex items-center text-green-600 bg-green-50 w-fit px-2 py-1 rounded-md">
                                                <ArrowUp className="w-4 h-4 mr-1" />
                                                <span className="font-medium text-xs">
                                                    +{diff.toLocaleString()} đ
                                                </span>
                                            </div>
                                        )}
                                        {p.trend === 'down' && (
                                            <div className="flex items-center text-red-600 bg-red-50 w-fit px-2 py-1 rounded-md">
                                                <ArrowDown className="w-4 h-4 mr-1" />
                                                <span className="font-medium text-xs">
                                                    {diff.toLocaleString()} đ
                                                </span>
                                            </div>
                                        )}
                                        {p.trend === 'stable' && (
                                            <div className="flex items-center text-muted-foreground">
                                                <Minus className="w-4 h-4 mr-1" />
                                                <span className="text-xs">Ổn định</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    
                                    <TableCell className="text-muted-foreground whitespace-nowrap">{p.region}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" onClick={() => openProductModal(p)}>
                                                <Edit className="w-4 h-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            {/* (Giữ nguyên phần code categories cũ của bạn ở đây...) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>Danh sách loại nông sản</CardTitle>
                        <CardDescription>Quản lý các nhóm sản phẩm trong hệ thống</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tên loại</TableHead>
                                    <TableHead className="text-right">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                setEditingCategory(c)
                                                setCategoryName(c.name)
                                                setShowCategoryModal(true)
                                            }}>Sửa</Button>
                                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteCategory(c.id)}>Xóa</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                <Card className="border-none shadow-sm h-fit">
                    <CardHeader>
                        <CardTitle>Thêm nhanh</CardTitle>
                        <CardDescription>Tạo loại sản phẩm mới ngay tại đây</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50 border-dashed">
                             <Button variant="outline" className="w-full h-12 border-dashed" onClick={() => {
                                 setEditingCategory(null)
                                 setCategoryName("")
                                 setShowCategoryModal(true)
                             }}>
                                <Plus className="w-4 h-4 mr-2" /> Thêm loại sản phẩm mới
                             </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* DIALOG SẢN PHẨM */}
        <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveProduct} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tên sản phẩm</Label>
                <Input 
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    placeholder="Ví dụ: Cà phê Robusta"
                    required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Danh mục</Label>
                    <Select 
                        value={productForm.category} 
                        onValueChange={(val) => setProductForm({...productForm, category: val})}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn loại" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((c) => (
                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Đơn vị tính</Label>
                    <Input 
                        value={productForm.unit}
                        onChange={(e) => setProductForm({...productForm, unit: e.target.value})}
                        placeholder="kg, tấn, tạ..."
                        required 
                    />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Giá hiện tại (VNĐ)</Label>
                    <Input 
                        type="number"
                        value={productForm.currentPrice}
                        onChange={(e) => setProductForm({...productForm, currentPrice: e.target.value})}
                        required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Khu vực</Label>
                    <Input 
                        value={productForm.region}
                        onChange={(e) => setProductForm({...productForm, region: e.target.value})}
                        placeholder="Tỉnh/Thành phố"
                        required 
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số lượng sẵn có</Label>
                  <Input
                    type="number"
                    min="0"
                    value={productForm.quantity_available}
                    onChange={(e) => setProductForm({ ...productForm, quantity_available: e.target.value })}
                    placeholder="Ví dụ: 1200"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID nông dân sở hữu</Label>
                  <Input
                    type="number"
                    min="1"
                    value={productForm.farmer_user_id}
                    onChange={(e) => setProductForm({ ...productForm, farmer_user_id: e.target.value })}
                    placeholder="Để trống nếu chưa gán"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Thu hoạch từ ngày</Label>
                  <Input
                    type="date"
                    value={productForm.harvest_start}
                    onChange={(e) => setProductForm({ ...productForm, harvest_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thu hoạch đến ngày</Label>
                  <Input
                    type="date"
                    value={productForm.harvest_end}
                    onChange={(e) => setProductForm({ ...productForm, harvest_end: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowProductModal(false)}>Hủy</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Lưu thông tin</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DIALOG DANH MỤC */}
        <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{editingCategory ? "Đổi tên danh mục" : "Tạo danh mục mới"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveCategory} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tên danh mục</Label>
                        <Input 
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="Ví dụ: Trái cây, Lúa gạo..."
                            required
                        />
                    </div>
                    <DialogFooter>
                         <Button type="button" variant="outline" onClick={() => setShowCategoryModal(false)}>Hủy</Button>
                         <Button type="submit">Lưu</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}