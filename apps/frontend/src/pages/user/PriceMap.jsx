import { useState, useEffect } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, MapPin } from "lucide-react"
import api from "@/lib/api"
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet"

const PROVINCE_COORDS = {
  // --- Tây Nguyên ---
  "lam dong": [11.575278, 107.809583],
  "dak lak": [12.666667, 108.050000],
  "dak nong": [12.000000, 107.666667],
  "gia lai": [13.983333, 108.250000],
  "kon tum": [14.350000, 108.000000],

  // --- Đông Nam Bộ ---
  "dong nai": [11.000000, 107.166667],
  "binh phuoc": [11.750000, 106.916667],
  "ba ria - vung tau": [10.550000, 107.283333],
  "tay ninh": [11.366667, 106.116667],
  "binh duong": [11.133333, 106.683333],

  // --- Đồng Bằng Sông Cửu Long ---
  "long an": [10.695833, 106.241667],
  "tien giang": [10.416667, 106.166667],
  "ben tre": [10.233333, 106.383333],
  "tra vinh": [9.933333, 106.333333],
  "vinh long": [10.250000, 105.966667],
  "dong thap": [10.533333, 105.683333],
  "an giang": [10.500000, 105.116667],
  "kien giang": [10.016667, 105.083333],
  "can tho": [10.033333, 105.783333],
  "hau giang": [9.783333, 105.466667],
  "soc trang": [9.600000, 105.966667],
  "bac lieu": [9.283333, 105.716667],
  "ca mau": [9.183333, 105.150000],

  // --- Khu vực khác ---
  "khanh hoa": [12.250000, 109.183333],
  "binh thuan": [11.100000, 108.183333],
  "ninh thuan": [11.566667, 108.983333],
  "nghe an": [19.250000, 104.883333],
  "thanh hoa": [19.800000, 105.766667],
};

const PROVINCE_SPECIALTIES = {
  // --- Tây Nguyên ---
  "lam dong": ["Cà phê Arabica", "Chè (Trà)", "Rau củ", "Hoa", "Sầu riêng"],
  "dak lak": ["Cà phê Robusta", "Hồ tiêu", "Bơ sáp", "Sầu riêng", "Ca cao"],
  "dak nong": ["Hồ tiêu", "Cà phê", "Bơ", "Sầu riêng", "Khoai lang"],
  "gia lai": ["Cà phê", "Hồ tiêu", "Cao su", "Chuối", "Chanh dây"],
  "kon tum": ["Sâm Ngọc Linh", "Cà phê xứ lạnh", "Cao su", "Mì (Sắn)"],

  // --- Đông Nam Bộ ---
  "dong nai": ["Bưởi Tân Triều", "Chôm chôm", "Sầu riêng", "Tiêu", "Điều"],
  "binh phuoc": ["Hạt điều", "Hồ tiêu", "Cao su", "Sầu riêng"],
  "ba ria - vung tau": ["Hồ tiêu", "Nhãn xuồng", "Mãng cầu"],
  "tay ninh": ["Mãng cầu Bà Đen", "Mía đường", "Cao su", "Mì (Sắn)"],
  "binh duong": ["Măng cụt Lái Thiêu", "Bưởi", "Cao su"],

  // --- Đồng Bằng Sông Cửu Long ---
  "long an": ["Lúa gạo", "Thanh long", "Chanh không hạt", "Dưa hấu"],
  "tien giang": ["Vú sữa Lò Rèn", "Xoài Cát Hòa Lộc", "Sầu riêng", "Mít"],
  "ben tre": ["Dừa", "Bưởi da xanh", "Chôm chôm", "Sầu riêng"],
  "tra vinh": ["Dừa sáp", "Lúa gạo", "Trái cây"],
  "vinh long": ["Bưởi Năm Roi", "Cam sành", "Khoai lang tím"],
  "dong thap": ["Xoài Cao Lãnh", "Sen", "Quýt hồng Lai Vung", "Lúa gạo"],
  "an giang": ["Lúa gạo", "Xoài", "Thốt nốt"],
  "kien giang": ["Hồ tiêu (Phú Quốc)", "Lúa gạo", "Khóm (Dứa)"],
  "can tho": ["Lúa gạo", "Dâu Hạ Châu", "Vú sữa"],
  "hau giang": ["Khóm Cầu Đúc", "Bưởi Năm Roi", "Lúa gạo", "Mía"],
  "soc trang": ["Hành tím Vĩnh Châu", "Lúa ST25", "Vú sữa"],
  "bac lieu": ["Lúa gạo", "Muối", "Nhãn"],
  "ca mau": ["Lúa gạo", "Mật ong rừng", "Cua (Thủy sản)"],

  // --- Khu vực khác ---
  "khanh hoa": ["Xoài Cam Lâm", "Sầu riêng Khánh Sơn", "Yến sào"],
  "binh thuan": ["Thanh long", "Nho", "Mủ trôm"],
  "ninh thuan": ["Nho", "Táo xanh", "Tỏi", "Hành tím"],
  "nghe an": ["Cam Vinh", "Lạc (Đậu phộng)", "Chè"],
  "thanh hoa": ["Mía đường", "Lúa gạo", "Bưởi Luận Văn"],
};

// Hàm chuẩn hóa tên vùng
const normalizeRegionKey = (regionName) => {
  if (!regionName) return null;
  return regionName.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
    .replace(/đ/g, "d")
    .replace(/tỉnh /g, "").replace(/thành phố /g, "").replace(/tp. /g, "")
    .replace(/-/g, " ")
    .trim();
};

const getCoords = (regionName) => {
  const key = normalizeRegionKey(regionName);
  if (!key) return null;
  // Mapping thêm vài trường hợp đặc biệt
  if (key.includes("vung tau")) return PROVINCE_COORDS["ba ria - vung tau"];
  if (key.includes("hcm") || key.includes("ho chi minh")) return PROVINCE_COORDS["tp ho chi minh"];
  return PROVINCE_COORDS[key];
};

const getSpecialties = (regionName) => {
  const key = normalizeRegionKey(regionName);
  if (!key) return [];
  if (key.includes("vung tau")) return PROVINCE_SPECIALTIES["ba ria - vung tau"] || [];
  return PROVINCE_SPECIALTIES[key] || [];
};

function MapFocus({ selectedCategory, allProducts }) {
  const map = useMap();

  useEffect(() => {
    // 1. Tìm các sản phẩm thuộc category đang chọn
    const relevantProducts = allProducts.filter(p => p.category_name === selectedCategory);
    if (relevantProducts.length > 0) {

      const firstRegion = relevantProducts[0].region;
      const coords = getCoords(firstRegion);

      if (coords) {
        // 3. Bay đến đó (FlyTo)
        map.flyTo(coords, 8, {
          animate: true,
          duration: 1.5
        });
      }
    } else {
      // Nếu không có dữ liệu, reset về view Việt Nam
      map.flyTo([14.0583, 108.2772], 6);
    }
  }, [selectedCategory, allProducts, map]);

  return null;
}

export default function PriceMap() {
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Cà phê");
  const [loading, setLoading] = useState(true);

  // Lấy danh sách các tỉnh có trồng loại cây này (để hiển thị gợi ý text)
  const suggestedRegions = allProducts
    .filter(p => p.category_name === selectedCategory)
    .map(p => p.region)
    .slice(0, 5); // Lấy top 5 tỉnh

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const productRes = await api.get("/products/map-data");
        const productData = productRes.data;

        setAllProducts(productData);

        const uniqueCategories = [...new Set(productData.map(p => p.category_name))];
        setCategories(uniqueCategories);

        if (uniqueCategories.length > 0) {
          const defaultCat = uniqueCategories.includes("Cà phê") ? "Cà phê" : uniqueCategories[0];
          setSelectedCategory(defaultCat);
        }

      } catch (error) {
        console.error("Lỗi tải dữ liệu bản đồ:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="ml-4">Đang tải dữ liệu bản đồ...</p>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header & Filter */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bản đồ giá nông sản</h1>
            {/* --- GỢI Ý TEXT --- */}
            {suggestedRegions.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center">
                <MapPin className="w-4 h-4 mr-1 text-green-600" />
                Trọng điểm {selectedCategory}: <span className="font-medium ml-1 text-foreground">{suggestedRegions.join(", ")}...</span>
              </p>
            )}
          </div>

          <div className="w-64">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại nông sản" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bản đồ */}
        <Card>
          <CardContent className="pt-6 h-[70vh]">
            <MapContainer
              center={[14.0583, 108.2772]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://maps.vietmap.vn/tm/{z}/{x}/{y}.png?apikey=fee869017ff637d8ea4ee91826e32e3d427a5d9256b87049"
                attribution='&copy; <a href="https://vietmap.vn">Vietmap</a> - Bản đồ số Việt Nam'
              />
              {/* Component xử lý tự động Zoom */}
              <MapFocus selectedCategory={selectedCategory} allProducts={allProducts} />

              {/* Render Markers */}
              {allProducts
                .filter(p => p.category_name === selectedCategory)
                .map((product) => {
                  const coords = getCoords(product.region);
                  const specialties = getSpecialties(product.region); // Lấy đặc sản

                  if (!coords) return null;

                  return (
                    <CircleMarker
                      key={product.id}
                      center={coords}
                      pathOptions={{
                        color: 'white',
                        fillColor: '#16a34a',
                        fillOpacity: 0.8,
                        weight: 2
                      }}
                      radius={18}
                    >
                      <Popup>
                        <div className="text-center min-w-[180px]">
                          <h3 className="font-bold text-lg uppercase text-gray-800 border-b pb-1 mb-2">
                            {product.region}
                          </h3>

                          {/* --- HIỂN THỊ ĐẶC SẢN (Dữ liệu mới) --- */}
                          {specialties.length > 0 && (
                            <div className="mb-3 bg-green-50 p-2 rounded text-left">
                              <p className="text-[10px] text-green-700 font-bold uppercase mb-1">Đặc sản vùng:</p>
                              <p className="text-xs text-gray-600 italic leading-snug">
                                {specialties.slice(0, 4).join(", ")}
                              </p>
                            </div>
                          )}

                          <p className="text-sm font-medium text-gray-500">{product.name}</p>
                          <div className="text-2xl font-bold text-green-600 my-1">
                            {product.currentPrice.toLocaleString("vi-VN")} ₫
                          </div>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${product.trend === 'up' ? 'bg-green-100 text-green-700' :
                              product.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                            {product.trend === 'up' ? '▲ Đang tăng' :
                              product.trend === 'down' ? '▼ Đang giảm' : '― Ổn định'}
                          </span>
                        </div>
                      </Popup>

                      <Tooltip direction="center" permanent className="bg-transparent border-0 shadow-none font-bold text-white text-xs">
                        {(product.currentPrice / 1000).toFixed(0)}k
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
            </MapContainer>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}