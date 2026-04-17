"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
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

    // --- Lấy thời gian OTP từ server ---
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

    // --- Countdown mỗi giây ---
    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    // --- Xử lý nhập OTP ---
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

    // --- Gửi lại OTP ---
    const handleResendOTP = async () => {
        setError("");
        setMessage("");
        try {
            await api.post("/auth/forgot-password", { email });
            setMessage("OTP mới đã được gửi đến email của bạn");
            setOTP(["", "", "", "", "", ""]);
            // Lấy lại expiresAt từ server
            await fetchOTPStatus();
        } catch (err) {
            setError(err?.response?.data?.error || "Không thể gửi lại OTP");
        }
    };

    // --- Submit đổi mật khẩu ---
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <form
                className="flex flex-col items-center gap-6 p-6 w-full max-w-[30rem] rounded-2xl bg-white border border-[#DEE5EF] shadow"
                onSubmit={(e) => {
                    e.preventDefault();
                    handleReset();
                }}
            >
                <h2 className="text-green-600 font-bold text-center text-2xl">
                    Nhập mã xác thực OTP
                </h2>

                <p className="text-center text-sm text-[#505F79]">
                    Chúng tôi đã gửi mã OTP đến email <span className="font-semibold">{email}</span>
                </p>

                <p className="text-center text-sm text-[#505F79] font-medium">
                    {timeLeft > 0 ? `OTP còn hiệu lực: ${formatTime(timeLeft)}` : "OTP đã hết hạn"}
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
                                className="w-full max-w-[3rem] h-12 text-center text-xl border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        ))}
                    </div>

                    {/* Resend OTP */}
                    {timeLeft <= 0 && (
                        <p
                            className="absolute right-0 top-full mt-1 text-sm text-green-500 cursor-pointer"
                            onClick={handleResendOTP}
                        >
                            Gửi lại OTP
                        </p>
                    )}
                </div>

                {/* Mật khẩu mới */}
                <div className="relative w-full">
                    <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mật khẩu mới"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pr-10"
                    />
                    <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
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
                        className="w-full pr-10"
                    />
                    <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                </div>

                {error && <p className="text-red-500">{error}</p>}
                {message && <p className="text-green-500">{message}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Đang đổi mật khẩu..." : "Xác nhận OTP"}
                </Button>
            </form>
        </div>
    );
}
