import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
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
    const messageLower = String(message).toLowerCase();

    console.error("❌ API response error:", status, message);

    // Chỉ logout nếu xác định là lỗi xác thực/token, không phải lỗi phân quyền nghiệp vụ.
    const is401 = status === 401;
    const isAuth403 =
      status === 403 &&
      (messageLower.includes("token") ||
        messageLower.includes("jwt") ||
        messageLower.includes("unauthorized") ||
        messageLower.includes("authentication") ||
        messageLower.includes("không hợp lệ") ||
        messageLower.includes("chưa đăng nhập"));

    const isTokenError = is401 || isAuth403;

    if (isTokenError) {
      console.warn("⚠️ Token hết hạn hoặc không hợp lệ — tiến hành đăng xuất...");

      // Xóa toàn bộ dữ liệu đăng nhập hiện tại
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
