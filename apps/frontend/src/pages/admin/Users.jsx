import { useEffect, useState } from "react"
import AdminNavbar from "@/components/AdminNavbar"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Search, Mail, Shield, User } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ name: "", email: "", role: "", status: "" })
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Lọc người dùng client-side
    const lowerTerm = searchTerm.toLowerCase()
    const results = users.filter(u =>
      (u.name && u.name.toLowerCase().includes(lowerTerm)) ||
      (u.email && u.email.toLowerCase().includes(lowerTerm))
    )
    setFilteredUsers(results)
  }, [searchTerm, users])

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users")
      setUsers(res.data)
      setFilteredUsers(res.data)
    } catch (error) {
      console.error("Lỗi tải user:", error)
      toast({ title: "Lỗi kết nối", description: "Không thể lấy danh sách người dùng", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (id) => {
    if (!confirm("Hành động này không thể hoàn tác. Bạn có chắc muốn xóa người dùng này?")) return
    try {
      await api.delete(`/users/${id}`)
      setUsers(prev => prev.filter(u => u.id !== id))
      toast({ title: "Đã xóa", description: "Người dùng đã bị xóa khỏi hệ thống" })
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xóa người dùng", variant: "destructive" })
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    })
  }

  const handleSave = async () => {
    try {
      await api.put(`/users/${editingUser.id}`, formData)
      toast({ title: "Cập nhật thành công" })
      fetchUsers()
      setEditingUser(null)
    } catch (error) {
      toast({ title: "Lỗi", description: "Không cập nhật được", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNavbar />
      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Thành viên</h1>
            <p className="text-muted-foreground mt-1">Quản lý tài khoản người dùng và phân quyền hệ thống.</p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc email..."
              className="pl-9 bg-card"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-6">Người dùng</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Ngày tham gia</TableHead>
                  <TableHead className="text-right pr-6">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">Đang tải danh sách...</TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Không tìm thấy thành viên nào phù hợp
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="group hover:bg-muted/50">
                      <TableCell className="font-medium pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border bg-card">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback className="bg-blue-50 text-blue-600 font-medium">
                              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-foreground font-medium">{user.name || "Chưa đặt tên"}</div>
                            <div className="text-xs text-muted-foreground font-normal md:hidden">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          {/* <Mail className="w-3 h-3 text-gray-400" /> */}
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === 'admin' ? (
                          <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 gap-1 pl-2 pr-3 py-1 font-normal">
                            <Shield className="w-3 h-3" /> Quản trị viên
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-border bg-muted/50 gap-1 pl-2 pr-3 py-1 font-normal">
                            <User className="w-3 h-3 text-muted-foreground" /> Thành viên
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString('vi-VN')
                          : <span className="text-muted-foreground/50 italic">Không rõ</span>}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {user.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 mr-2 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {user.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {editingUser && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Chỉnh sửa người dùng</h2>

              <div className="space-y-3">
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />

                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="user">Thành viên</option>
                  <option value="admin">Quản trị</option>
                </select>

                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="active">Hoạt động</option>
                  <option value="banned">Khóa</option>
                </select>
              </div>

              <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={() => setEditingUser(null)}>Hủy</Button>
                <Button onClick={handleSave}>Lưu</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}