import { Link } from "react-router-dom"
import { Sprout, Mail, Phone, MapPin, Facebook, Globe } from "lucide-react"
import { useLayout } from "../context/LayoutContext"

export default function Footer() {
    // Ẩn Footer khi đang trong MainLayout2
    const { hasLayout } = useLayout()
    if (hasLayout) return null

    return (
        <footer className="mt-20 border-t border-border/40 bg-background/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

                    {/* Logo + giới thiệu */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl flex items-center justify-center">
                                <Sprout className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-green-700 to-emerald-500">
                                AgroInsight
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            AgroInsight là nền tảng theo dõi giá nông sản, phân tích xu hướng thị trường
                            và kết nối cộng đồng nông nghiệp thông minh.
                        </p>
                    </div>

                    {/* Liên kết nhanh */}
                    <div>
                        <h3 className="font-semibold mb-4">Liên kết nhanh</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link to="/" className="hover:text-primary">Trang chủ</Link></li>
                            <li><Link to="/compare" className="hover:text-primary">So sánh giá</Link></li>
                            <li><Link to="/map" className="hover:text-primary">Bản đồ giá</Link></li>
                            <li><Link to="/community" className="hover:text-primary">Cộng đồng</Link></li>
                        </ul>
                    </div>

                    {/* Hỗ trợ */}
                    <div>
                        <h3 className="font-semibold mb-4">Hỗ trợ</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link to="/profile" className="hover:text-primary">Tài khoản</Link></li>
                            <li><a href="#" className="hover:text-primary">Chính sách bảo mật</a></li>
                            <li><a href="#" className="hover:text-primary">Điều khoản sử dụng</a></li>
                        </ul>
                    </div>

                    {/* Thông tin liên hệ */}
                    <div>
                        <h3 className="font-semibold mb-4">Liên hệ</h3>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-primary" />
                                <span>support@agritrend.vn</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-primary" />
                                <span>0123 456 789</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-primary" />
                                <span>Việt Nam</span>
                            </li>
                            <li className="flex items-center gap-3 pt-2">
                                <Facebook className="w-5 h-5 hover:text-primary cursor-pointer" />
                                <Globe className="w-5 h-5 hover:text-primary cursor-pointer" />
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-10 border-t border-border/40 pt-6 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} AgroInsight. All rights reserved.
                </div>
            </div>
        </footer>
    )
}
