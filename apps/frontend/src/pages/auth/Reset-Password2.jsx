"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, Sprout } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword2() {
    const navigate = useNavigate();
    const params = new URLSearchParams(useLocation().search);
    const emailFromURL = params.get("email");

    const [email] = useState(emailFromURL || "");
    const [otp, setOTP] = useState(["", "", "", "", "", ""]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const inputsRef = useRef([]);

    const fetchOTPStatus = async () => {
        try {
            const { data } = await api.get(`/auth/otp-status?email=${email}`);
            if (data.otpValid && data.expiresAt) {
                const expiresAt = new Date(data.expiresAt).getTime();
                const now = Date.now();
                setTimeLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)));
            } else {
                setTimeLeft(0);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (email) fetchOTPStatus();
    }, [email]);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleOTPChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOTP = [...otp];
        newOTP[index] = value;
        setOTP(newOTP);
        if (value && index < 5) inputsRef.current[index + 1]?.focus();
    };

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60).toString().padStart(2, "0");
        const s = (sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const handleResendOTP = async () => {
        setError("");
        setMessage("");
        try {
            await api.post("/auth/forgot-password", { email });
            setMessage("OTP mới đã được gửi đến email của bạn");
            setOTP(["", "", "", "", "", ""]);
            await fetchOTPStatus();
        } catch (err) {
            setError(err?.response?.data?.error || "Không thể gửi lại OTP");
        }
    };

    const handleReset = async () => {
        const otpString = otp.join("");
        if (!email || otpString.length < 6 || !newPassword || !confirmPassword) {
            return setError("Vui lòng điền đầy đủ thông tin");
        }
        if (newPassword !== confirmPassword) {
            return setError("Mật khẩu mới không trùng khớp");
        }

        setLoading(true);
        setError("");
        setMessage("");

        try {
            await api.post("/auth/reset-password", {
                email,
                otp: otpString,
                newPassword,
            });
            setMessage("Đổi mật khẩu thành công!");
            setTimeout(() => navigate("/login"), 1000);
        } catch (err) {
            setError(err?.response?.data?.error || "Lỗi đổi mật khẩu");
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

            <form
                className="flex flex-col items-center gap-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleReset();
                }}
            >
                <div className="w-full mb-2">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Nhập mã xác thực OTP
                    </h1>
                    <p className="text-sm text-white/60">
                        Chúng tôi đã gửi mã OTP đến email <span className="font-semibold text-white">{email}</span>
                    </p>
                </div>

                <p className="text-sm font-medium w-full text-white/60">
                    {timeLeft > 0 ? (
                        <>OTP còn hiệu lực: <span className="text-[hsl(38,85%,65%)] font-bold">{formatTime(timeLeft)}</span></>
                    ) : (
                        <span className="text-red-300">OTP đã hết hạn</span>
                    )}
                </p>

                {/* OTP inputs */}
                <div className="relative w-full">
                    <div className="grid grid-cols-6 gap-2">
                        {otp.map((o, idx) => (
                            <input
                                key={idx}
                                type="text"
                                maxLength={1}
                                value={o}
                                ref={(el) => (inputsRef.current[idx] = el)}
                                onChange={(e) => handleOTPChange(idx, e.target.value)}
                                className="w-full max-w-[3rem] h-12 text-center text-xl border border-white/20 rounded-xl bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-[hsl(38,85%,55%)]/50 transition-all"
                            />
                        ))}
                    </div>

                    {timeLeft <= 0 && (
                        <p
                            className="absolute right-0 top-full mt-1.5 text-sm text-[hsl(38,85%,65%)] cursor-pointer hover:text-[hsl(38,85%,75%)] font-medium transition-colors"
                            onClick={handleResendOTP}
                        >
                            Gửi lại OTP
                        </p>
                    )}
                </div>

                {/* Mật khẩu mới */}
                <div className="relative w-full mt-2">
                    <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mật khẩu mới"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pr-10 py-2.5 rounded-xl border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/40"
                    />
                    <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 hover:text-white/70 transition-colors"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                </div>

                <div className="relative w-full">
                    <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Xác nhận mật khẩu mới"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pr-10 py-2.5 rounded-xl border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/40"
                    />
                    <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 hover:text-white/70 transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                </div>

                {error && <p className="text-red-300 text-sm w-full">{error}</p>}
                {message && <p className="text-[hsl(38,85%,65%)] text-sm font-medium w-full">{message}</p>}

                <Button
                    type="submit"
                    className="w-full bg-[hsl(148,48%,35%)] hover:bg-[hsl(148,48%,40%)] text-white rounded-xl py-2.5 transition-all shadow-lg hover:shadow-xl border border-white/10"
                    disabled={loading}
                >
                    {loading ? "Đang đổi mật khẩu..." : "Xác nhận OTP"}
                </Button>
            </form>
        </AuthLayout>
    );
}
