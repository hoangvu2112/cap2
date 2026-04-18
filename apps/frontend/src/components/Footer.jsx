import { Link } from "react-router-dom"
import { Sprout, Mail, Phone, MapPin, Facebook, Globe } from "lucide-react"
import { useLayout } from "../context/LayoutContext"

export default function Footer({ variant = "full" }) {
    // Nếu dùng dạng compact (thay thế cho Footer2)
    if (variant === "compact") {
        return (
            <footer className="shrink-0">
                <div
                    className="px-6 py-5"
                    style={{
                        background: "linear-gradient(135deg, hsl(148, 48%, 18%) 0%, hsl(148, 40%, 25%) 50%, hsl(38, 50%, 35%) 100%)",
                    }}
                >
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Left: Brand */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/15">
                                    <Sprout className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="font-bold text-white text-sm">AgroInsight</span>
                                    <p className="text-[10px] text-white/50">Nền tảng giá nông sản thông minh</p>
                                </div>
                            </div>

                            {/* Center: Quick info */}
                            <div className="flex items-center gap-6 text-white/60 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>support@agroinsight.vn</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>0123 456 789</span>
                                </div>
                            </div>

                            {/* Right: Links + Copyright */}
                            <div className="flex items-center gap-4 text-xs text-white/50">
                                <a href="#" className="hover:text-white/80 transition-colors">Chính sách</a>
                                <a href="#" className="hover:text-white/80 transition-colors">Điều khoản</a>
                                <span className="border-l border-white/15 pl-4">
                                    © {new Date().getFullYear()} AgroInsight
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        )
    }

}
