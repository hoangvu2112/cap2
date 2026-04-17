import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Tự động gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tự động logout khi token hết hạn hoặc không hợp lệ
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || "";

    console.error("❌ API response error:", status, message);

    // Kiểm tra token hết hạn / không hợp lệ
    const isTokenError =
      status === 401 ||
      status === 403 ||
      message.toLowerCase().includes("token") ||
      message.toLowerCase().includes("jwt");

    if (isTokenError) {
      console.warn("⚠️ Token hết hạn hoặc không hợp lệ — tiến hành đăng xuất...");

      // Xóa toàn bộ dữ liệu đăng nhập (dù là Clerk hay local)
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("loginType");

      // Chuyển hướng về trang đăng nhập (tránh reload vô hạn)
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;

/**
 * Hàm tra cứu giá dành riêng cho Chatbot
 * @param {string} productName - Tên sản phẩm (ví dụ: "cà phê")
 * @param {string} regionName - Tên khu vực (ví dụ: "Đắk Lắk")
 * @returns {Promise<object>} - Dữ liệu sản phẩm đầu tiên tìm thấy
 */
export const fetchPriceForChatbot = async (productName, regionName) => {
  try {
    const response = await api.get("/products", {
      params: {
        search: productName,
        region: regionName,
        limit: 1 // Chúng ta chỉ cần kết quả chính xác nhất
      },
    });

    if (response.data && response.data.data.length > 0) {
      return response.data.data[0]; // Trả về sản phẩm đầu tiên
    } else {
      // Thử tìm kiếm chung nếu không có khu vực
      const generalResponse = await api.get("/products", {
        params: { search: productName, limit: 1 },
      });
      return generalResponse.data?.data?.[0] || null;
    }
  } catch (error) {
    console.error("Lỗi khi tra giá cho chatbot:", error);
    return null; // Trả về null nếu có lỗi
  }
};
