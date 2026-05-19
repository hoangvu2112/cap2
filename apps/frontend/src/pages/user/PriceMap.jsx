import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Navbar from "@/components/Navbar"
import { Loader2, MapPin, Search, X, Phone, Clock, CheckCircle2, Trash2, Filter, Crosshair, Pencil } from "lucide-react"
import ndamapgl from "ndamap-gl"
import "ndamap-gl/dist/ndamap-gl.css"
import { v4 as uuidv4 } from "uuid"
import api from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const NDAMAPS_API_KEY = import.meta.env.VITE_NDAMAPS_API_KEY || ""
const NDAMAPS_STYLE = NDAMAPS_API_KEY
  ? `https://maptiles.ndamaps.vn/styles/day-v1/style.json?apikey=${NDAMAPS_API_KEY}`
  : "https://nda-tiles.openmap.vn/styles/ndamap/style.json"
const NDAMAPS_API_BASE = "https://mapapis.ndamaps.vn/v1"

// Phân vùng theo tỉnh để gắn label "Miền Nam", "Tây Nguyên",...
const REGION_BY_PROVINCE = {
  "Hà Nội": "Miền Bắc", "Hải Phòng": "Miền Bắc", "Quảng Ninh": "Miền Bắc",
  "Bắc Ninh": "Miền Bắc", "Hưng Yên": "Miền Bắc", "Ninh Bình": "Miền Bắc",
  "Thái Nguyên": "Miền Bắc", "Phú Thọ": "Miền Bắc", "Cao Bằng": "Miền Bắc",
  "Lạng Sơn": "Miền Bắc", "Lào Cai": "Miền Bắc", "Tuyên Quang": "Miền Bắc",
  "Sơn La": "Miền Bắc", "Điện Biên": "Miền Bắc", "Lai Châu": "Miền Bắc",
  "Thanh Hóa": "Miền Trung", "Nghệ An": "Miền Trung", "Hà Tĩnh": "Miền Trung",
  "Quảng Trị": "Miền Trung", "Huế": "Miền Trung", "Đà Nẵng": "Miền Trung",
  "Quảng Ngãi": "Miền Trung", "Khánh Hòa": "Miền Trung",
  "Gia Lai": "Tây Nguyên", "Đắk Lắk": "Tây Nguyên", "Lâm Đồng": "Tây Nguyên",
  "Hồ Chí Minh": "Miền Nam", "Đồng Nai": "Miền Nam", "Tây Ninh": "Miền Nam",
  "Cần Thơ": "Miền Nam", "Vĩnh Long": "Miền Nam", "Đồng Tháp": "Miền Nam",
  "An Giang": "Miền Nam", "Cà Mau": "Miền Nam",
}

const detectRegion = (province) => {
  if (!province) return ""
  for (const [key, region] of Object.entries(REGION_BY_PROVINCE)) {
    if (province.includes(key)) return region
  }
  return ""
}

// Component ảnh có skeleton loading + lazy load
function LazyImage({ src, alt, className = "" }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  if (!src || error) return null
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: "#e5e7eb" }}>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  )
}

export default function PriceMap() {
  const { user } = useAuth()
  const isDealer = user?.role === "dealer"
  const isAdmin = user?.role === "admin"

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const dealerMarkersRef = useRef({})
  const searchMarkerRef = useRef(null)

  // Autocomplete sidebar
  const [searchInput, setSearchInput] = useState("")
  const [predictions, setPredictions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const sessionTokenRef = useRef(uuidv4())
  const debounceRef = useRef(null)

  // Filter
  const [showFilter, setShowFilter] = useState(true)
  const [regionFilter, setRegionFilter] = useState("")

  // Data
  const [dealerLocations, setDealerLocations] = useState([])
  const [myLocation, setMyLocation] = useState(null)
  const [activeId, setActiveId] = useState(null)

  // Modal đăng ký
  const [showForm, setShowForm] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState(null) // Admin đang sửa địa điểm nào (null = đang đăng ký cho chính mình)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({
    branch_name: "", region_label: "", address: "", phone: "",
    business_hours: "", image_url: "", province: "", ward: "",
    place_id: "", latitude: null, longitude: null, name: "",
  })

  // Time pickers + phone validation
  const [openTime, setOpenTime] = useState("")
  const [closeTime, setCloseTime] = useState("")
  const [phoneError, setPhoneError] = useState("")

  // Search trong modal (riêng với search sidebar)
  const [modalSearch, setModalSearch] = useState("")
  const [modalPredictions, setModalPredictions] = useState([])
  const [modalSearching, setModalSearching] = useState(false)
  const [modalShowDrop, setModalShowDrop] = useState(false)
  const modalDebounceRef = useRef(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  // Đồng bộ business_hours
  useEffect(() => {
    if (openTime && closeTime) {
      const fmt = (t) => t.replace(":", "h")
      setForm(prev => ({ ...prev, business_hours: `${fmt(openTime)} - ${fmt(closeTime)}` }))
    } else if (!openTime && !closeTime) {
      setForm(prev => ({ ...prev, business_hours: "" }))
    }
  }, [openTime, closeTime])

  const validatePhone = (phone) => {
    if (!phone) return ""
    const cleaned = phone.replace(/\s|-|\./g, "")
    if (!/^0\d{9,10}$/.test(cleaned)) {
      return "Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)"
    }
    return ""
  }

  // Load dealer locations
  const loadDealerLocations = useCallback(async () => {
    try {
      const res = await api.get("/dealer-locations")
      setDealerLocations(res.data.locations || [])
    } catch (err) { console.error(err) }

    if (isDealer) {
      try {
        const me = await api.get("/dealer-locations/me")
        setMyLocation(me.data.location)
      } catch (err) { console.error(err) }
    }
  }, [isDealer])

  useEffect(() => { loadDealerLocations() }, [loadDealerLocations])

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = new ndamapgl.Map({
      container: mapContainerRef.current,
      style: NDAMAPS_STYLE,
      center: [108.2772, 14.0583],
      zoom: 5.5,
      maplibreLogo: false,
    })
    map.addControl(new ndamapgl.NavigationControl(), "top-right")
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Render dealer markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(dealerMarkersRef.current).forEach(m => m.remove())
    dealerMarkersRef.current = {}

    dealerLocations.forEach(loc => {
      const isMine = isDealer && loc.user_id === user?.id
      const isActive = activeId === loc.id

      const el = document.createElement("div")
      const color = isMine || isActive ? "#dc2626" : "#f97316"
      const size = isActive ? 44 : 36
      el.innerHTML = `
        <div style="background:${color};color:white;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;transition:all 0.2s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg);">
            <path d="M2 7h20l-2 4H4z"/><path d="M4 11v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"/>
          </svg>
        </div>
      `
      el.addEventListener("click", () => setActiveId(loc.id))

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`
      const popupContent = `
        <div style="font-family:system-ui,sans-serif;width:300px;border-radius:12px;overflow:hidden;">
          ${loc.image_url ? `
            <div style="width:100%;height:160px;overflow:hidden;background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite;">
              <img src="${loc.image_url}" alt="${loc.branch_name || ''}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .35s;" onload="this.style.opacity=1;this.parentElement.style.background='#f3f4f6';this.parentElement.style.animation='none';" onerror="this.parentElement.style.display='none'" />
            </div>
          ` : ""}

          <div style="background:#7cb342;color:white;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <p style="font-weight:600;margin:0;font-size:15px;line-height:1.3;flex:1;min-width:0;">${loc.branch_name || loc.dealer_name}</p>
            <a href="${directionsUrl}" target="_blank" rel="noopener" style="text-decoration:none;color:white;font-size:13px;white-space:nowrap;display:flex;align-items:center;gap:6px;">
              <span>Chỉ đường</span>
            </a>
          </div>

          <div style="position:relative;background:white;padding:14px 16px;">
            <a href="${directionsUrl}" target="_blank" rel="noopener" title="Chỉ đường" style="position:absolute;top:-22px;right:16px;width:44px;height:44px;background:white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;text-decoration:none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#7cb342">
                <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
              </svg>
            </a>

            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#7cb342" style="flex-shrink:0;margin-top:1px;">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
              </svg>
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.4;">${loc.address}</p>
            </div>

            ${loc.phone ? `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#7cb342" style="flex-shrink:0;">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
                <a href="tel:${loc.phone}" style="margin:0;color:#7cb342;font-size:15px;text-decoration:none;font-weight:500;">${loc.phone}</a>
              </div>
            ` : ""}

            ${loc.business_hours ? `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#7cb342" style="flex-shrink:0;">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
                </svg>
                <p style="margin:0;color:#374151;font-size:14px;">${loc.business_hours}</p>
              </div>
            ` : ""}

            ${loc.region_label || loc.dealer_name ? `
              <div style="border-top:1px solid #e5e7eb;margin-top:10px;padding-top:10px;">
                <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.4;">
                  ${loc.region_label ? `<strong style="color:#374151;">${loc.region_label}</strong> · ` : ""}${loc.dealer_name}
                </p>
              </div>
            ` : ""}
          </div>
        </div>
      `

      const popup = new ndamapgl.Popup({
        offset: 28,
        maxWidth: "320px",
        closeButton: true,
        className: "dealer-popup"
      }).setHTML(popupContent)

      const marker = new ndamapgl.Marker({ element: el })
        .setLngLat([Number(loc.longitude), Number(loc.latitude)])
        .setPopup(popup)
        .addTo(map)

      dealerMarkersRef.current[loc.id] = marker
    })
  }, [dealerLocations, isDealer, user?.id])

  // Cập nhật style marker khi đổi activeId mà không re-tạo lại markers (tránh popup bị đóng)
  useEffect(() => {
    Object.entries(dealerMarkersRef.current).forEach(([id, marker]) => {
      const loc = dealerLocations.find(l => l.id === Number(id))
      if (!loc) return
      const isMine = isDealer && loc.user_id === user?.id
      const isActive = activeId === Number(id)
      const color = isMine || isActive ? "#dc2626" : "#f97316"
      const size = isActive ? 44 : 36
      const el = marker.getElement()
      const inner = el.firstElementChild
      if (inner) {
        inner.style.background = color
        inner.style.width = `${size}px`
        inner.style.height = `${size}px`
        const svg = inner.querySelector("svg")
        if (svg) {
          svg.setAttribute("width", String(size * 0.5))
          svg.setAttribute("height", String(size * 0.5))
        }
      }
    })
  }, [activeId, dealerLocations, isDealer, user?.id])

  const focusLocation = (loc) => {
    setActiveId(loc.id)
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [Number(loc.longitude), Number(loc.latitude)], zoom: 14, duration: 1200 })
    setTimeout(() => {
      const marker = dealerMarkersRef.current[loc.id]
      if (marker) marker.togglePopup()
    }, 1200)
  }

  // Autocomplete sidebar
  const handleSearchInput = (value) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim() || value.trim().length < 2) {
      setPredictions([])
      setShowDropdown(false)
      return
    }
    if (!NDAMAPS_API_KEY) return

    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true)
        const url = `${NDAMAPS_API_BASE}/autocomplete?format=google&input=${encodeURIComponent(value)}&sessiontoken=${sessionTokenRef.current}&apikey=${NDAMAPS_API_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.predictions) {
          setPredictions(data.predictions.slice(0, 6))
          setShowDropdown(true)
        }
      } catch (err) { console.error(err) }
      finally { setSearching(false) }
    }, 350)
  }

  const handleSelectPrediction = useCallback(async (prediction) => {
    setSearchInput(prediction.description)
    setShowDropdown(false)
    setPredictions([])
    if (!NDAMAPS_API_KEY) return

    try {
      const url = `${NDAMAPS_API_BASE}/place?ids=${prediction.place_id}&format=google&sessiontoken=${sessionTokenRef.current}&apikey=${NDAMAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data?.result
      const loc = result?.geometry?.location
      if (!loc) return

      const lngLat = [loc.lng, loc.lat]
      const map = mapRef.current
      if (!map) return

      if (searchMarkerRef.current) searchMarkerRef.current.remove()
      const el = document.createElement("div")
      el.innerHTML = `<div style="background:#2563eb;color:white;border:2px solid white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`
      searchMarkerRef.current = new ndamapgl.Marker({ element: el }).setLngLat(lngLat).addTo(map)

      map.flyTo({ center: lngLat, zoom: 15, duration: 1500 })
      sessionTokenRef.current = uuidv4()
    } catch (err) { console.error(err) }
  }, [])

  // Modal search
  const handleModalSearch = (value) => {
    setModalSearch(value)
    if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current)

    if (!value.trim() || value.trim().length < 2) {
      setModalPredictions([])
      setModalShowDrop(false)
      return
    }
    if (!NDAMAPS_API_KEY) return

    modalDebounceRef.current = setTimeout(async () => {
      try {
        setModalSearching(true)
        const url = `${NDAMAPS_API_BASE}/autocomplete?format=google&input=${encodeURIComponent(value)}&sessiontoken=${sessionTokenRef.current}&apikey=${NDAMAPS_API_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.predictions) {
          setModalPredictions(data.predictions.slice(0, 6))
          setModalShowDrop(true)
        }
      } catch (err) { console.error(err) }
      finally { setModalSearching(false) }
    }, 350)
  }

  const handleModalSelect = async (prediction) => {
    setModalSearch(prediction.description)
    setModalShowDrop(false)
    setModalPredictions([])
    if (!NDAMAPS_API_KEY) return

    try {
      const url = `${NDAMAPS_API_BASE}/place?ids=${prediction.place_id}&format=google&sessiontoken=${sessionTokenRef.current}&apikey=${NDAMAPS_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const result = data?.result
      const loc = result?.geometry?.location
      if (!loc) {
        showToast("error", "Không tìm thấy tọa độ")
        return
      }

      let province = ""
      let ward = ""
      if (Array.isArray(result.address_components)) {
        const comps = result.address_components
        province = comps[comps.length - 1]?.long_name || ""
        const wardComp = comps.find(c => /phường|xã/i.test(c.long_name))
        if (wardComp) ward = wardComp.long_name
      }

      const fullAddress = result.formatted_address || prediction.description
      const placeName = result.name || prediction.structured_formatting?.main_text || ""

      setForm(prev => ({
        ...prev,
        place_id: prediction.place_id,
        address: fullAddress,
        name: placeName,
        latitude: loc.lat,
        longitude: loc.lng,
        province,
        ward,
        region_label: detectRegion(province),
        branch_name: prev.branch_name || placeName,
      }))

      const map = mapRef.current
      if (map) {
        if (searchMarkerRef.current) searchMarkerRef.current.remove()
        const el = document.createElement("div")
        el.innerHTML = `<div style="background:#2563eb;color:white;border:2px solid white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍</div>`
        searchMarkerRef.current = new ndamapgl.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map)
        map.flyTo({ center: [loc.lng, loc.lat], zoom: 15, duration: 1200 })
      }

      sessionTokenRef.current = uuidv4()
    } catch (err) {
      console.error(err)
      showToast("error", "Không thể lấy chi tiết địa điểm")
    }
  }

  const openForm = () => {
    setPhoneError("")
    setEditingLocationId(null)
    if (myLocation) {
      setForm({
        branch_name: myLocation.branch_name || "",
        region_label: myLocation.region_label || detectRegion(myLocation.province),
        address: myLocation.address || "",
        phone: myLocation.phone || "",
        business_hours: myLocation.business_hours || "",
        image_url: myLocation.image_url || "",
        province: myLocation.province || "",
        ward: myLocation.ward || "",
        place_id: "",
        latitude: Number(myLocation.latitude),
        longitude: Number(myLocation.longitude),
        name: myLocation.branch_name || "",
      })
      const m = (myLocation.business_hours || "").match(/^(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})$/)
      if (m) {
        setOpenTime(`${m[1].padStart(2, "0")}:${m[2]}`)
        setCloseTime(`${m[3].padStart(2, "0")}:${m[4]}`)
      } else {
        setOpenTime("")
        setCloseTime("")
      }
    } else {
      setOpenTime("")
      setCloseTime("")
    }
    setShowForm(true)
  }

  // Admin: mở form chỉnh sửa địa điểm của dealer khác
  const openFormForLocation = (loc) => {
    setPhoneError("")
    setEditingLocationId(loc.id)
    setForm({
      branch_name: loc.branch_name || "",
      region_label: loc.region_label || detectRegion(loc.province),
      address: loc.address || "",
      phone: loc.phone || "",
      business_hours: loc.business_hours || "",
      image_url: loc.image_url || "",
      province: loc.province || "",
      ward: loc.ward || "",
      place_id: "",
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      name: loc.branch_name || "",
    })
    const m = (loc.business_hours || "").match(/^(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})$/)
    if (m) {
      setOpenTime(`${m[1].padStart(2, "0")}:${m[2]}`)
      setCloseTime(`${m[3].padStart(2, "0")}:${m[4]}`)
    } else {
      setOpenTime("")
      setCloseTime("")
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingLocationId(null)
    setModalSearch("")
    setModalPredictions([])
    setModalShowDrop(false)
    setPhoneError("")
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove()
      searchMarkerRef.current = null
    }
  }

  const handleSaveLocation = async () => {
    if (!form.address || form.latitude === null || form.longitude === null) {
      showToast("error", "Vui lòng tìm kiếm và chọn địa chỉ trước")
      return
    }
    if (!form.branch_name?.trim()) {
      showToast("error", "Vui lòng nhập tên chi nhánh")
      return
    }
    if (form.phone?.trim()) {
      const phoneErr = validatePhone(form.phone)
      if (phoneErr) {
        setPhoneError(phoneErr)
        showToast("error", phoneErr)
        return
      }
    }
    if ((openTime && !closeTime) || (!openTime && closeTime)) {
      showToast("error", "Vui lòng nhập đầy đủ cả giờ mở và đóng cửa")
      return
    }
    if (openTime && closeTime && openTime >= closeTime) {
      showToast("error", "Giờ đóng phải sau giờ mở cửa")
      return
    }

    try {
      setSavingLocation(true)
      let res
      if (editingLocationId) {
        // Admin sửa địa điểm của dealer khác
        res = await api.put(`/dealer-locations/${editingLocationId}`, form)
      } else {
        // Dealer tự đăng ký/cập nhật của chính mình
        res = await api.post("/dealer-locations", form)
        setMyLocation(res.data.location)
      }
      showToast("success", editingLocationId ? "Đã cập nhật địa điểm" : "Đã lưu địa điểm đại lý lên bản đồ!")
      setShowForm(false)
      setEditingLocationId(null)
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove()
        searchMarkerRef.current = null
      }
      await loadDealerLocations()
      setTimeout(() => focusLocation(res.data.location), 300)
    } catch (err) {
      showToast("error", err.response?.data?.error || "Không thể lưu địa điểm")
    } finally {
      setSavingLocation(false)
    }
  }

  const handleDeleteMyLocation = async () => {
    if (!confirm("Bạn có chắc muốn xóa địa điểm đại lý khỏi bản đồ?")) return
    try {
      await api.delete("/dealer-locations/me")
      setMyLocation(null)
      showToast("success", "Đã xóa địa điểm")
      await loadDealerLocations()
    } catch (err) {
      showToast("error", err.response?.data?.error || "Không thể xóa")
    }
  }

  // Admin xóa địa điểm bất kỳ
  const handleAdminDelete = async (loc) => {
    if (!confirm(`Xóa địa điểm "${loc.branch_name || loc.dealer_name}" khỏi bản đồ?`)) return
    try {
      await api.delete(`/dealer-locations/${loc.id}`)
      showToast("success", "Đã xóa địa điểm")
      await loadDealerLocations()
    } catch (err) {
      showToast("error", err.response?.data?.error || "Không thể xóa")
    }
  }

  // Lọc danh sách (dùng chung searchInput cho cả autocomplete + filter)
  const filteredLocations = useMemo(() => {
    let list = dealerLocations
    if (regionFilter) {
      list = list.filter(l => (l.region_label || detectRegion(l.province)) === regionFilter)
    }
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase().trim()
      list = list.filter(l =>
        (l.branch_name || "").toLowerCase().includes(q) ||
        (l.dealer_name || "").toLowerCase().includes(q) ||
        (l.address || "").toLowerCase().includes(q) ||
        (l.province || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [dealerLocations, searchInput, regionFilter])

  const availableRegions = useMemo(() => {
    const set = new Set()
    dealerLocations.forEach(l => {
      const r = l.region_label || detectRegion(l.province)
      if (r) set.add(r)
    })
    return Array.from(set)
  }, [dealerLocations])

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {toast && (
        <div className={`fixed top-20 right-4 z-[2000] px-4 py-3 rounded-2xl border-2 font-medium text-sm flex items-center gap-2 shadow-lg ${
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-red-50 border-red-300 text-red-800"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Bản đồ đại lý nông sản</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center">
            <MapPin className="w-4 h-4 mr-1 text-green-600" />
            {isDealer
              ? "Đăng ký địa chỉ kinh doanh để khách hàng tìm thấy bạn"
              : `Khám phá ${dealerLocations.length} đại lý đã đăng ký`}
          </p>
        </div>

        <div className="flex h-[calc(100vh-200px)] min-h-[560px] bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          {/* SIDEBAR */}
          <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            {/* Search bar (gộp tìm + lọc) */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => handleSearchInput(e.target.value)}
                    onFocus={() => predictions.length > 0 && setShowDropdown(true)}
                    placeholder={NDAMAPS_API_KEY ? "Tìm địa điểm hoặc lọc đại lý..." : "Cần cấu hình API"}
                    disabled={!NDAMAPS_API_KEY}
                    className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed"
                  />
                  {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />}
                  {searchInput && !searching && (
                    <button onClick={() => { setSearchInput(""); setPredictions([]); setShowDropdown(false) }} className="mr-1 p-1 hover:bg-gray-200 rounded-full">
                      <X className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  )}
                  <button
                    className="px-2.5 py-2.5 hover:bg-gray-100 border-l border-gray-200"
                    title="Vị trí của tôi"
                    onClick={() => navigator.geolocation?.getCurrentPosition(pos => {
                      mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 })
                    })}
                  >
                    <Crosshair className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {showDropdown && predictions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-y-auto z-50">
                    {predictions.map((p, idx) => (
                      <button
                        key={p.place_id || idx}
                        onClick={() => handleSelectPrediction(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {p.structured_formatting?.main_text || p.description}
                          </p>
                          {p.structured_formatting?.secondary_text && (
                            <p className="text-xs text-gray-500 truncate">{p.structured_formatting.secondary_text}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bộ lọc */}
            <div className="border-b border-gray-100">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
                  <Filter className="w-4 h-4" /> BỘ LỌC
                </span>
                <span className={`text-gray-400 transition-transform ${showFilter ? "rotate-90" : ""}`}>›</span>
              </button>
              {showFilter && (
                <div className="px-4 pb-3">
                  <select
                    value={regionFilter}
                    onChange={e => setRegionFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-emerald-400"
                  >
                    <option value="">Tất cả vùng</option>
                    {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Nút đăng ký dealer */}
            {isDealer && (
              <div className="p-3 border-b border-gray-100">
                {myLocation ? (
                  <div className="flex gap-2">
                    <Button onClick={openForm} variant="outline" size="sm" className="flex-1 rounded-xl">
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Cập nhật
                    </Button>
                    <Button onClick={handleDeleteMyLocation} variant="outline" size="sm" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={openForm} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">
                    <MapPin className="w-4 h-4 mr-2" /> Đăng ký địa điểm của bạn
                  </Button>
                )}
              </div>
            )}

            {/* Danh sách */}
            <div className="flex-1 overflow-y-auto">
              {filteredLocations.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  {dealerLocations.length === 0 ? "Chưa có đại lý nào đăng ký" : "Không tìm thấy đại lý phù hợp"}
                </div>
              ) : (
                filteredLocations.map(loc => {
                  const isMine = isDealer && loc.user_id === user?.id
                  const isActive = activeId === loc.id
                  return (
                    <div
                      key={loc.id}
                      className={`relative border-b border-gray-100 transition-colors ${
                        isActive ? "bg-orange-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <button
                        onClick={() => focusLocation(loc)}
                        className="w-full text-left p-4"
                      >
                        <div className="flex gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 uppercase truncate pr-8">
                              {isMine && "🏠 "}
                              {loc.branch_name || loc.dealer_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              {loc.region_label && <span className="font-semibold">{loc.region_label} · </span>}
                              {loc.address}
                            </p>
                            {loc.business_hours && (
                              <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {loc.business_hours}
                              </p>
                            )}
                            {loc.phone && (
                              <p className="text-xs text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {loc.phone}
                              </p>
                            )}
                          </div>
                          {loc.image_url && (
                            <LazyImage
                              src={loc.image_url}
                              alt={loc.branch_name}
                              className="w-20 h-20 rounded-lg flex-shrink-0"
                            />
                          )}
                        </div>
                      </button>

                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openFormForLocation(loc) }}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 shadow-sm"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAdminDelete(loc) }}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 shadow-sm"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {/* MAP */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0" />
          </div>
        </div>
      </div>

      {/* Modal đăng ký/cập nhật */}
      {showForm && (isDealer || isAdmin) && (
        <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4" onClick={closeForm}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">
                  {editingLocationId ? "Admin chỉnh sửa địa điểm" : (myLocation ? "Cập nhật" : "Đăng ký") + " địa điểm đại lý"}
                </h2>
                <p className="text-sm text-emerald-50 mt-0.5">Thông tin sẽ hiển thị trên bản đồ cho khách hàng</p>
              </div>
              <button onClick={closeForm} className="p-1 hover:bg-white/20 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Search trong modal */}
              <div>
                <Label className="font-bold text-gray-700 mb-1.5 block">
                  Bước 1 — Tìm địa chỉ <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <div className="flex items-center bg-gray-50 rounded-xl border border-gray-300 overflow-hidden">
                    <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />
                    <input
                      type="text"
                      value={modalSearch}
                      onChange={e => handleModalSearch(e.target.value)}
                      onFocus={() => modalPredictions.length > 0 && setModalShowDrop(true)}
                      placeholder={NDAMAPS_API_KEY ? "VD: 272 Võ Chí Công, Hà Nội..." : "Cần cấu hình API key"}
                      disabled={!NDAMAPS_API_KEY}
                      className="flex-1 px-2 py-2.5 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed"
                    />
                    {modalSearching && <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />}
                    {modalSearch && !modalSearching && (
                      <button onClick={() => { setModalSearch(""); setModalPredictions([]); setModalShowDrop(false) }} className="mr-2 p-1 hover:bg-gray-200 rounded-full">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {modalShowDrop && modalPredictions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-y-auto z-[3001]">
                      {modalPredictions.map((p, idx) => (
                        <button
                          key={p.place_id || idx}
                          onClick={() => handleModalSelect(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {p.structured_formatting?.main_text || p.description}
                            </p>
                            {p.structured_formatting?.secondary_text && (
                              <p className="text-xs text-gray-500 truncate">{p.structured_formatting.secondary_text}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {form.address ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
                  <p className="font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Địa chỉ đã chọn:
                  </p>
                  <p className="text-gray-700">{form.address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tọa độ: {form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  ⚠️ Chưa chọn địa chỉ. Hãy tìm và chọn 1 gợi ý ở trên.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-bold text-gray-700">Tên chi nhánh *</Label>
                  <Input
                    value={form.branch_name}
                    onChange={e => setForm({ ...form, branch_name: e.target.value })}
                    placeholder="VD: NHÀ BÈ AGRI || HỒ CHÍ MINH"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-bold text-gray-700">Vùng</Label>
                  <div className="mt-1 flex h-10 w-full items-center rounded-md border border-input bg-gray-50 px-3 py-2 text-sm text-muted-foreground">
                    {form.region_label || "Tự động xác định khi chọn địa chỉ"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Vùng được xác định tự động theo địa chỉ</p>
                </div>
                <div>
                  <Label className="font-bold text-gray-700">Số điện thoại</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.phone}
                    onChange={e => {
                      const v = e.target.value.replace(/[^\d]/g, "")
                      setForm({ ...form, phone: v })
                      setPhoneError(v ? validatePhone(v) : "")
                    }}
                    placeholder="0912345678"
                    className={`mt-1 ${phoneError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                  />
                  {phoneError && <p className="text-xs text-red-600 mt-1 font-medium">⚠️ {phoneError}</p>}
                  {!phoneError && form.phone && <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Hợp lệ</p>}
                </div>
                <div>
                  <Label className="font-bold text-gray-700">Giờ mở cửa</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="time"
                      value={openTime}
                      onChange={e => setOpenTime(e.target.value)}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                    <span className="text-gray-400 font-medium">→</span>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={e => setCloseTime(e.target.value)}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                  {openTime && closeTime && openTime >= closeTime && (
                    <p className="text-xs text-red-600 mt-1 font-medium">⚠️ Giờ đóng phải sau giờ mở</p>
                  )}
                  {form.business_hours && openTime < closeTime && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">✓ {form.business_hours}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="font-bold text-gray-700">URL ảnh chi nhánh (tùy chọn)</Label>
                  <Input
                    value={form.image_url}
                    onChange={e => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://example.com/branch.jpg"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={closeForm} disabled={savingLocation}>
                  Hủy
                </Button>
                <Button
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 font-bold"
                  onClick={handleSaveLocation}
                  disabled={savingLocation || !form.address}
                >
                  {savingLocation ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> {editingLocationId ? "Lưu thay đổi" : (myLocation ? "Cập nhật" : "Xác nhận")} địa điểm</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
