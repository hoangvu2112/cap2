"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { Sprout, ArrowLeft } from "lucide-react";

export default function ForgotPassword2() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSendOTP = async () => {
        if (!email) return setError("Email bắt buộc");
        setLoading(true);
        setError("");
        setMessage("");

        try {
            await api.post("/auth/forgot-password", { email });
            setMessage("OTP đã được gửi đến email của bạn!");
            setTimeout(() => {
                navigate(`/reset-password?email=${encodeURIComponent(email)}`);
            }, 800);
        } catch (err) {
            setError(err?.response?.data?.error || "Lỗi gửi OTP");
        }

        setLoading(false);
    };

    return (
        <AuthLayout>
            {/* Logo mobile */}
            <div className="flex items-center gap-2 mb-8 md:hidden">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                    <Sprout className="text-white w-5 h-5" />
                </div>
                <span className="font-bold text-2xl text-white">AgroInsight</span>
            </div>

            {/* Back link */}
            <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-[hsl(38,85%,65%)] transition-colors mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Quay lại đăng nhập
            </Link>

            {/* Heading */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">
                    Quên mật khẩu
                </h1>
                <p className="text-white/60">
                    Nhập email để nhận mã OTP đặt lại mật khẩu
                </p>
            </div>

            <Input
                type="email"
                placeholder="Nhập email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mb-4 py-2.5 rounded-xl border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/40 focus:ring-2 focus:ring-[hsl(38,85%,55%)]/50"
            />

            {error && <p className="text-red-300 mb-3 text-sm">{error}</p>}
            {message && <p className="text-[hsl(38,85%,65%)] mb-3 text-sm font-medium">{message}</p>}

            <Button
                onClick={handleSendOTP}
                className="w-full bg-[hsl(148,48%,35%)] hover:bg-[hsl(148,48%,40%)] text-white rounded-xl py-2.5 transition-all shadow-lg hover:shadow-xl border border-white/10"
                disabled={loading}
            >
                {loading ? "Đang gửi..." : "Gửi OTP"}
            </Button>
        </AuthLayout>
    );
}
