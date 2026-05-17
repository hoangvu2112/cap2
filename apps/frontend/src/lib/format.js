/**
 * Hàm định dạng sản lượng thông minh (Tấn, Tạ, Kg)
 */
export const formatYield = (kg) => {
  const num = Number(kg || 0);
  if (num >= 1000 && num % 1000 === 0) return (num / 1000) + " Tấn";
  if (num >= 100 && num % 100 === 0) return (num / 100) + " Tạ";
  return num + " Kg";
};

/**
 * Hàm tính toán ngược lại đơn vị từ số Kg
 */
export const parseYield = (kg) => {
  const num = Number(kg || 0);
  if (num >= 1000 && num % 1000 === 0) return { value: num / 1000, unit: "tấn" };
  if (num >= 100 && num % 100 === 0) return { value: num / 100, unit: "tạ" };
  return { value: num, unit: "kg" };
};

/**
 * Hàm định dạng ngày giờ chuẩn Việt Nam (HH:mm:ss DD/MM/YYYY)
 * Ép mọi chuỗi về UTC chuẩn trước khi chuyển sang giờ địa phương
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return "";
  
  try {
    let dStr = String(dateStr).trim();
    
    // Nếu chuỗi chứa dấu cách (định dạng MySQL: YYYY-MM-DD HH:mm:ss), chuyển sang ISO T
    if (dStr.includes(' ')) {
      dStr = dStr.replace(' ', 'T');
    }

    // Nếu chuỗi chưa có múi giờ (Z hoặc +), ta mặc định nó là UTC (vì Aiven dùng UTC)
    if (!dStr.includes('Z') && !dStr.includes('+')) {
      dStr += 'Z';
    }

    const date = new Date(dStr);

    // Kiểm tra tính hợp lệ của ngày
    if (isNaN(date.getTime())) return dateStr;

    // Lấy giá trị theo múi giờ địa phương (Trình duyệt sẽ tự +7 nếu ở VN)
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    return `${h}:${m}:${s} ${d}/${mo}/${y}`;
  } catch (error) {
    console.error("Lỗi format ngày tháng:", error);
    return String(dateStr);
  }
};
