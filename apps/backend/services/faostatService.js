import axios from "axios";

/**
 * Gọi API FAOSTAT để lấy dữ liệu với Access Token.
 */
export async function fetchFaostatData(params) {
    try {
        const token = process.env.FAOSTAT_ACCESS_TOKEN;
        if (!token) return null;

        const response = await axios({
            method: 'get',
            url: 'https://fenixservices.fao.org/faostat/api/v1/en/data/PP', // PP: Producer Prices
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: params,
            timeout: 5000 
        });

        return response.data;
    } catch (error) {
        console.error("❌ Lỗi khi gọi FAOSTAT API:", error.message);
        return null;
    }
}

/**
 * Ánh xạ tên nông sản sang mã Item của FAOSTAT.
 */
function getFaoItemCode(productName) {
    const nameStr = productName.toLowerCase();
    if (nameStr.includes("lúa") || nameStr.includes("gạo")) return '27'; // Rice, paddy
    // Cà phê (Coffee, green) thường là 656 trong hệ FAO
    if (nameStr.includes("cà phê") || nameStr.includes("cafe")) return '656'; 
    
    // Các mặt hàng mới bổ sung
    if (nameStr.includes("hồ tiêu") || nameStr.includes("tiêu") || nameStr.includes("pepper")) return '687';
    if (nameStr.includes("hạt điều") || nameStr.includes("điều") || nameStr.includes("cashew")) return '217';
    if (nameStr.includes("cao su") || nameStr.includes("rubber")) return '836';
    if (nameStr.includes("sầu riêng") || nameStr.includes("durian")) return '571';
    if (nameStr.includes("sắn") || nameStr.includes("khoai mì") || nameStr.includes("cassava")) return '125';

    // Nếu chưa mapping kịp các mã khác, tạm thời bỏ qua
    return null;
}

/**
 * Xử lý dữ liệu FAOSTAT và tạo ra một chuỗi text ngắn gọn để bổ sung làm BỐI CẢNH (Context) cho AI
 * @param {object} product - Thông tin sản phẩm từ db
 */
export async function buildFaostatContextForProduct(product) {
    const itemCode = getFaoItemCode(product.name);
    if (!itemCode) return ""; // Không gọi API nếu không biết mã hàng

    const params = {
        area: '237', // Vietnam
        element: '5530', // Producer Price - LCV
        item: itemCode,
        year: '2022,2023,2024', // Lấy vài năm gần nhất để đánh giá nền tảng
        format: 'json'
    };

    const data = await fetchFaostatData(params);
    
    // Nếu data trả về rỗng hoặc lỗi
    if (!data || !data.data || data.data.length === 0) return ""; 

    try {
        // Lấy giá trị của năm mới nhất trả về
        const latestRecord = data.data.reduce((prev, current) => 
            (parseInt(prev.Year) > parseInt(current.Year)) ? prev : current
        );

        // Dữ liệu FAOSTAT (Element 5530) trả về đơn vị tính theo TẤN (Tonne).
        // Cần chia cho 1000 để bối cảnh đồng nhất với đơn vị KG của hệ thống hiện tại.
        let numStr = (Number(latestRecord.Value || 0) / 1000).toFixed(2);
        numStr = parseFloat(numStr).toString();
        const parts = numStr.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const formattedValue = parts.join(",");
        
        return `[Dữ liệu vĩ mô bổ trợ: Theo FAOSTAT, mức giá nền tảng xuất xưởng của ${product.name} (mã ${itemCode}) tại Việt Nam trong năm ${latestRecord.Year} là khoảng ${formattedValue} VND/kg. Hãy đối chiếu với dữ liệu giá/kg nội bộ hiện tại để đưa ra dự báo 1 tuần tới.]`;
    } catch (err) {
        return "";
    }
}
