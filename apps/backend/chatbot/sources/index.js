import fs from "fs"
import path from "path"
import pool from "../../db.js"
import { buildWebsiteAdapter, parseWebsiteSourcesFromEnv } from "./websites.js"

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function buildProductDoc(product) {
  return {
    externalId: `product:${product.id}`,
    title: `Sản phẩm ${product.name}`,
    sourceUrl: null,
    roleScope: "shared",
    content: [
      `Tên sản phẩm: ${product.name}`,
      `Danh mục: ${product.category_name || "Chưa phân loại"}`,
      `Khu vực: ${product.region || "Chưa có"}`,
      `Giá hiện tại: ${Number(product.currentPrice || 0).toLocaleString("vi-VN")} đ/${product.unit || "đơn vị"}`,
      `Giá trước đó: ${Number(product.previousPrice || 0).toLocaleString("vi-VN")} đ/${product.unit || "đơn vị"}`,
      `Số lượng khả dụng: ${Number(product.quantity_available || 0).toLocaleString("vi-VN")}`,
      `Thời gian thu hoạch: ${product.harvest_start || "?"} đến ${product.harvest_end || "?"}`,
      `Xu hướng: ${product.trend || "stable"}`,
      `Cập nhật lần cuối: ${product.lastUpdate || ""}`,
    ].join("\n"),
    metadata: {
      productId: product.id,
      region: product.region,
      category: product.category_name,
      unit: product.unit,
    },
  }
}

function buildNewsDoc(news) {
  return {
    externalId: `news:${news.id}`,
    title: news.title,
    sourceUrl: news.url || null,
    roleScope: "shared",
    content: [
      `Tiêu đề: ${news.title}`,
      `Nguồn: ${news.source || "AgriTrend"}`,
      `Ngày đăng: ${news.published_at || ""}`,
      `Nội dung: ${safeText(news.content)}`,
    ].join("\n"),
    metadata: {
      newsId: news.id,
      source: news.source || "AgriTrend",
    },
  }
}

function buildPriceHistoryDoc(row) {
  const historyText = row.history
    .slice(0, 12)
    .map((item) => `${item.updated_at}: ${Number(item.price || 0).toLocaleString("vi-VN")} đ`)
    .join(" | ")

  return {
    externalId: `history:${row.product_id}`,
    title: `Lịch sử giá ${row.product_name}`,
    sourceUrl: null,
    roleScope: "shared",
    content: [
      `Sản phẩm: ${row.product_name}`,
      `Khu vực: ${row.region || ""}`,
      `Giá gần đây: ${historyText}`,
      `Giá cao nhất 30 ngày: ${Number(row.high_30d || 0).toLocaleString("vi-VN")} đ`,
      `Giá thấp nhất 30 ngày: ${Number(row.low_30d || 0).toLocaleString("vi-VN")} đ`,
      `Giá trung bình 30 ngày: ${Math.round(Number(row.avg_30d || 0)).toLocaleString("vi-VN")} đ`,
    ].join("\n"),
    metadata: {
      productId: row.product_id,
      productName: row.product_name,
      region: row.region,
    },
  }
}

function parseScrapedRegionDoc(region) {
  const rows = Array.isArray(region.data) ? region.data : []
  return {
    externalId: `scraped:${region.name}:${region.region}`,
    title: region.name,
    sourceUrl: null,
    roleScope: "shared",
    content: [
      `Tên vùng/sản phẩm: ${region.name}`,
      `Khu vực: ${region.region || ""}`,
      `Xu hướng hiện tại: ${region.trend || "stable"}`,
      ...rows.slice(0, 12).map((item) => `${item.Ngày || item.date || ""}: ${item.Giá || item.GiaMua || item.priceValue || ""}`),
    ].join("\n"),
    metadata: {
      source: "scraped-json",
      region: region.region,
      productName: region.name,
    },
  }
}

async function collectDatabaseSnapshotDocuments() {
  const documents = []

  const [products] = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.currentPrice,
        p.previousPrice,
        p.unit,
        p.region,
        p.quantity_available,
        p.harvest_start,
        p.harvest_end,
        p.trend,
        p.lastUpdate,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.lastUpdate DESC, p.id DESC
      LIMIT 120
    `
  )
  documents.push(...products.map(buildProductDoc))

  const [newsRows] = await pool.query(
    `
      SELECT id, title, content, source, url, published_at
      FROM news
      WHERE status = 'published'
      ORDER BY published_at DESC, id DESC
      LIMIT 80
    `
  )
  documents.push(...newsRows.map(buildNewsDoc))

  const [historyRows] = await pool.query(
    `
      SELECT
        ph.product_id,
        p.name AS product_name,
        p.region,
        ph.price,
        ph.updated_at
      FROM price_history ph
      JOIN products p ON p.id = ph.product_id
      WHERE ph.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY ph.updated_at DESC, ph.id DESC
      LIMIT 80
    `
  ).catch(() => [])

  const grouped = new Map()
  for (const row of historyRows) {
    if (!grouped.has(row.product_id)) {
      grouped.set(row.product_id, {
        product_id: row.product_id,
        product_name: row.product_name,
        region: row.region,
        history: [],
      })
    }
    grouped.get(row.product_id).history.push({ price: row.price, updated_at: row.updated_at })
  }

  for (const row of grouped.values()) {
    const prices = row.history.map((item) => Number(item.price || 0))
    const high_30d = prices.length ? Math.max(...prices) : 0
    const low_30d = prices.length ? Math.min(...prices) : 0
    const avg_30d = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
    documents.push(buildPriceHistoryDoc({ ...row, high_30d, low_30d, avg_30d }))
  }

  return documents
}

async function collectScrapedJsonDocuments() {
  const dataPath = path.join(process.cwd(), "scraped/all_regions.json")
  if (!fs.existsSync(dataPath)) return []

  try {
    const raw = fs.readFileSync(dataPath, "utf8")
    const data = JSON.parse(raw)
    const regions = Array.isArray(data.regions) ? data.regions : []
    return regions.map(parseScrapedRegionDoc)
  } catch (error) {
    console.error("❌ Lỗi đọc scraped/all_regions.json:", error.message)
    return []
  }
}

export const chatbotSourceAdapters = [
  {
    sourceKey: "database-snapshot",
    name: "Snapshot từ database hệ thống",
    sourceType: "database",
    sourceUrl: null,
    roleScope: "shared",
    async collectDocuments() {
      return collectDatabaseSnapshotDocuments()
    },
  },
  {
    sourceKey: "scraped-json",
    name: "Dữ liệu cào từ website hiện có",
    sourceType: "file",
    sourceUrl: null,
    roleScope: "shared",
    async collectDocuments() {
      return collectScrapedJsonDocuments()
    },
  },
  ...parseWebsiteSourcesFromEnv().map((config) => buildWebsiteAdapter(config)),
]
