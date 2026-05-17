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
  // --- 6 Thành phố trực thuộc Trung ương ---
  "ha noi": [21.028511, 105.804817],
  "ho chi minh": [10.823099, 106.629664],
  "hai phong": [20.844912, 106.688084],
  "da nang": [16.047079, 108.206230],
  "can tho": [10.045162, 105.746857],
  "hue": [16.463713, 107.590866],

  // --- Miền Bắc (12 tỉnh) ---
  "quang ninh": [21.006382, 107.292514],
  "cao bang": [22.665600, 106.257900],
  "lang son": [21.853708, 106.761519],
  "lai chau": [22.386389, 103.470833],
  "dien bien": [21.383333, 103.016667],
  "son la": [21.316667, 103.900000],
  "tuyen quang": [21.823611, 105.218056],
  "lao cai": [22.338333, 103.975000],
  "thai nguyen": [21.594444, 105.848333],
  "phu tho": [21.400000, 105.166667],
  "bac ninh": [21.186111, 106.076111],
  "hung yen": [20.646667, 106.051667],

  // --- Miền Trung & Tây Nguyên (8 tỉnh) ---
  "thanh hoa": [19.800000, 105.766667],
  "nghe an": [19.250000, 104.883333],
  "ha tinh": [18.342222, 105.905833],
  "ninh binh": [20.250000, 105.975000],
  "quang tri": [16.750000, 107.000000],
  "quang ngai": [15.120000, 108.800000],
  "gia lai": [13.983333, 108.250000],
  "khanh hoa": [12.250000, 109.183333],

  // --- Nam Trung Bộ & Nam Bộ (8 tỉnh) ---
  "lam dong": [11.575278, 107.809583],
  "dak lak": [12.666667, 108.050000],
  "dong nai": [11.000000, 107.166667],
  "tay ninh": [11.366667, 106.116667],
  "vinh long": [10.250000, 105.966667],
  "dong thap": [10.533333, 105.683333],
  "an giang": [10.500000, 105.116667],
  "ca mau": [9.183333, 105.150000],
};

const PROVINCE_SPECIALTIES = {
  // --- 6 Thành phố trực thuộc Trung ương ---
  "ha noi": ["Gạo nếp cái hoa vàng", "Bưởi Diễn", "Nhãn lồng", "Rau an toàn"],
  "ho chi minh": ["Hồ tiêu", "Điều", "Cao su", "Trái cây nhiệt đới"],
  "hai phong": ["Lúa gạo", "Vải thiều", "Thủy sản", "Rau màu"],
  "da nang": ["Thủy sản", "Rau sạch", "Quế", "Tiêu"],
  "can tho": ["Lúa gạo ST25", "Cá tra", "Trái cây", "Tôm"],
  "hue": ["Thanh trà", "Bưởi", "Sen", "Quế"],

  // --- Miền Bắc (12 tỉnh) ---
  "quang ninh": ["Thủy sản", "Chè", "Na dai", "Gạo nếp cái hoa vàng"],
  "cao bang": ["Hạt dẻ", "Lê", "Thạch đen", "Miến dong"],
  "lang son": ["Na Chi Lăng", "Hồi", "Quế", "Thạch đen"],
  "lai chau": ["Chè Shan tuyết", "Gạo Séng Cù", "Thảo quả", "Mật ong"],
  "dien bien": ["Gạo Điện Biên", "Cà phê", "Chè", "Mắc ca"],
  "son la": ["Xoài", "Nhãn", "Cà phê", "Mận hậu", "Chè Shan tuyết"],
  "tuyen quang": ["Cam sành", "Chè", "Bưởi", "Mía"],
  "lao cai": ["Thảo quả", "Chè Shan tuyết", "Quế", "Mận"],
  "thai nguyen": ["Chè Thái Nguyên", "Lúa gạo", "Na", "Bưởi"],
  "phu tho": ["Chè", "Bưởi Đoan Hùng", "Hồng không hạt", "Chuối"],
  "bac ninh": ["Vải thiều", "Lúa gạo", "Rau màu", "Khoai tây"],
  "hung yen": ["Nhãn lồng", "Lúa gạo", "Chuối", "Vải"],

  // --- Miền Trung & Tây Nguyên (8 tỉnh) ---
  "thanh hoa": ["Mía đường", "Lúa gạo", "Bưởi Luận Văn", "Cam"],
  "nghe an": ["Cam Vinh", "Lạc (Đậu phộng)", "Chè", "Mía"],
  "ha tinh": ["Bưởi Phúc Trạch", "Cam", "Chè", "Lạc"],
  "ninh binh": ["Lúa gạo", "Dứa", "Cói", "Rau màu"],
  "quang tri": ["Hồ tiêu", "Cà phê", "Cao su", "Lúa gạo"],
  "quang ngai": ["Quế Trà Bồng", "Sâm Ngọc Linh", "Mì (Sắn)", "Lúa gạo"],
  "gia lai": ["Cà phê", "Hồ tiêu", "Cao su", "Chuối", "Chanh dây"],
  "khanh hoa": ["Xoài Cam Lâm", "Sầu riêng Khánh Sơn", "Yến sào", "Nho"],

  // --- Nam Trung Bộ & Nam Bộ (8 tỉnh) ---
  "lam dong": ["Cà phê Arabica", "Chè", "Rau củ", "Hoa", "Sầu riêng", "Thanh long"],
  "dak lak": ["Cà phê Robusta", "Hồ tiêu", "Bơ sáp", "Sầu riêng", "Ca cao"],
  "dong nai": ["Bưởi Tân Triều", "Chôm chôm", "Sầu riêng", "Tiêu", "Điều", "Cao su"],
  "tay ninh": ["Mãng cầu Bà Đen", "Mía đường", "Cao su", "Thanh long", "Lúa gạo"],
  "vinh long": ["Bưởi Năm Roi", "Cam sành", "Khoai lang tím", "Dừa", "Chôm chôm"],
  "dong thap": ["Xoài Cao Lãnh", "Sen", "Quýt hồng Lai Vung", "Lúa gạo"],
  "an giang": ["Lúa gạo", "Xoài", "Thốt nốt", "Hồ tiêu Phú Quốc"],
  "ca mau": ["Lúa gạo", "Mật ong rừng", "Tôm", "Cua"],
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

// Mapping tỉnh cũ → tỉnh mới (sau sáp nhập 2025)
const OLD_TO_NEW_PROVINCE = {
  "ha giang": "tuyen quang",
  "yen bai": "lao cai",
  "bac kan": "thai nguyen",
  "vinh phuc": "phu tho",
  "hoa binh": "phu tho",
  "bac giang": "bac ninh",
  "thai binh": "hung yen",
  "hai duong": "hai phong",
  "ha nam": "ninh binh",
  "nam dinh": "ninh binh",
  "quang binh": "quang tri",
  "quang nam": "da nang",
  "kon tum": "quang ngai",
  "binh dinh": "gia lai",
  "ninh thuan": "khanh hoa",
  "phu yen": "dak lak",
  "dak nong": "lam dong",
  "binh thuan": "lam dong",
  "binh phuoc": "dong nai",
  "binh duong": "ho chi minh",
  "ba ria - vung tau": "ho chi minh",
  "long an": "tay ninh",
  "tien giang": "dong thap",
  "ben tre": "vinh long",
  "tra vinh": "vinh long",
  "soc trang": "can tho",
  "hau giang": "can tho",
  "kien giang": "an giang",
  "bac lieu": "ca mau",
};

const getCoords = (regionName) => {
  const key = normalizeRegionKey(regionName);
  if (!key) return null;
  // Thử tìm trực tiếp
  if (PROVINCE_COORDS[key]) return PROVINCE_COORDS[key];
  // Mapping tên cũ → tên mới
  const mappedKey = OLD_TO_NEW_PROVINCE[key];
  if (mappedKey && PROVINCE_COORDS[mappedKey]) return PROVINCE_COORDS[mappedKey];
  // Fallback đặc biệt
  if (key.includes("vung tau")) return PROVINCE_COORDS["ho chi minh"];
  if (key.includes("hcm") || key.includes("ho chi minh")) return PROVINCE_COORDS["ho chi minh"];
  return null;
};

const getSpecialties = (regionName) => {
  const key = normalizeRegionKey(regionName);
  if (!key) return [];
  if (PROVINCE_SPECIALTIES[key]) return PROVINCE_SPECIALTIES[key];
  const mappedKey = OLD_TO_NEW_PROVINCE[key];
  if (mappedKey && PROVINCE_SPECIALTIES[mappedKey]) return PROVINCE_SPECIALTIES[mappedKey];
  return [];
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