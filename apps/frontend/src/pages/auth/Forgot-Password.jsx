"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
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
            // Chuyển sang ResetPassword
            setTimeout(() => {
                navigate(`/reset-password?email=${encodeURIComponent(email)}`);
            }, 800);
        } catch (err) {
            setError(err?.response?.data?.error || "Lỗi gửi OTP");
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-semibold mb-4">Quên mật khẩu</h2>

                <Input
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-4"
                />

                {error && <p className="text-red-500 mb-2">{error}</p>}
                {message && <p className="text-green-500 mb-2">{message}</p>}

                <Button
                    onClick={handleSendOTP}
                    className="w-full"
                    disabled={loading}
                >
                    {loading ? "Đang gửi..." : "Gửi OTP"}
                </Button>
            </div>
        </div>
    );
}
