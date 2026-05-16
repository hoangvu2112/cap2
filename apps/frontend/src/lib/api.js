import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const BACKEND_URL = API_BASE_URL.replace(/\/api$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Tß╗▒ ─æß╗Öng gß║»n token v├áo mß╗ìi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tß╗▒ ─æß╗Öng logout khi token hß║┐t hß║ín hoß║╖c kh├┤ng hß╗úp lß╗ç
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || "";
    const code = error.response?.data?.code || "";
    const messageLower = String(message).toLowerCase();

    console.error("Γ¥î API response error:", status, message);

    // Chß╗ë logout nß║┐u x├íc ─æß╗ïnh l├á lß╗ùi x├íc thß╗▒c/token, kh├┤ng phß║úi lß╗ùi ph├ón quyß╗ün nghiß╗çp vß╗Ñ.
    const is401 = status === 401;
    const isAuth403 =
      status === 403 &&
      (messageLower.includes("token") ||
        messageLower.includes("jwt") ||
        messageLower.includes("unauthorized") ||
        messageLower.includes("authentication") ||
        messageLower.includes("kh├┤ng hß╗úp lß╗ç") ||
        messageLower.includes("ch╞░a ─æ─âng nhß║¡p") ||
        code === "ROLE_CHANGED" ||
        messageLower.includes("vui l├▓ng ─æ─âng nhß║¡p lß║íi") ||
        messageLower.includes("kh├┤ng c├▓n quyß╗ün"));

    const isTokenError = is401 || isAuth403;

    if (isTokenError) {
      console.warn("ΓÜá∩╕Å Token hß║┐t hß║ín hoß║╖c kh├┤ng hß╗úp lß╗ç ΓÇö tiß║┐n h├ánh ─æ─âng xuß║Ñt...");

      // X├│a to├án bß╗Ö dß╗» liß╗çu ─æ─âng nhß║¡p hiß╗çn tß║íi
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("loginType");

      // Chuyß╗ân h╞░ß╗¢ng vß╗ü trang ─æ─âng nhß║¡p (tr├ính reload v├┤ hß║ín)
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;

/**
 * H├ám tra cß╗⌐u gi├í d├ánh ri├¬ng cho Chatbot
 * @param {string} productName - T├¬n sß║ún phß║⌐m (v├¡ dß╗Ñ: "c├á ph├¬")
 * @param {string} regionName - T├¬n khu vß╗▒c (v├¡ dß╗Ñ: "─Éß║»k Lß║»k")
 * @returns {Promise<object>} - Dß╗» liß╗çu sß║ún phß║⌐m ─æß║ºu ti├¬n t├¼m thß║Ñy
 */
export const fetchPriceForChatbot = async (productName, regionName) => {
  try {
    const response = await api.get("/products", {
      params: {
        search: productName,
        region: regionName,
        limit: 1 // Ch├║ng ta chß╗ë cß║ºn kß║┐t quß║ú ch├¡nh x├íc nhß║Ñt
      },
    });

    if (response.data && response.data.data.length > 0) {
      return response.data.data[0]; // Trß║ú vß╗ü sß║ún phß║⌐m ─æß║ºu ti├¬n
    } else {
      // Thß╗¡ t├¼m kiß║┐m chung nß║┐u kh├┤ng c├│ khu vß╗▒c
      const generalResponse = await api.get("/products", {
        params: { search: productName, limit: 1 },
      });
      return generalResponse.data?.data?.[0] || null;
    }
  } catch (error) {
    console.error("Lß╗ùi khi tra gi├í cho chatbot:", error);
    return null; // Trß║ú vß╗ü null nß║┐u c├│ lß╗ùi
  }
};
