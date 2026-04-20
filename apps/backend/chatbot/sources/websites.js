function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function toArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null) return []
  return [value]
}

function safePositiveInt(value, fallback, { min = 1, max = 30 } = {}) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function safeRegex(value) {
  if (!value) return null
  try {
    return new RegExp(String(value), "i")
  } catch {
    return null
  }
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

function resolveLink(baseUrl, href) {
  try {
    const url = new URL(href, baseUrl)
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url)
}

function isHtmlLikeUrl(url) {
  const lowered = String(url || "").toLowerCase()
  if (lowered.includes(".pdf") || lowered.includes(".jpg") || lowered.includes(".jpeg") || lowered.includes(".png")) {
    return false
  }
  if (lowered.includes(".zip") || lowered.includes(".doc") || lowered.includes(".docx") || lowered.includes(".xls")) {
    return false
  }
  return true
}

function extractLinks(html, pageUrl) {
  const links = []
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  let match = regex.exec(String(html || ""))

  while (match) {
    const href = String(match[1] || "").trim()
    if (href && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
      const absolute = resolveLink(pageUrl, href)
      if (absolute && isHttpUrl(absolute) && isHtmlLikeUrl(absolute)) {
        links.push(absolute)
      }
    }
    match = regex.exec(String(html || ""))
  }

  return links
}

function shouldIncludeUrl(url, config, seedHost) {
  if (!url) return false

  const parsed = new URL(url)
  const sameHost = parsed.host === seedHost
  if (!sameHost && !config.allowExternalLinks) return false

  if (config.includePathRegex && !config.includePathRegex.test(parsed.pathname)) {
    return false
  }

  if (config.excludePathRegex && config.excludePathRegex.test(parsed.pathname)) {
    return false
  }

  return true
}

function stripHtml(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  )
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return stripHtml(match?.[1] || "")
}

function extractMetaDescription(html) {
  const regex = /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
  const altRegex = /<meta[^>]+content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i
  const match = String(html || "").match(regex) || String(html || "").match(altRegex)
  return stripHtml(match?.[1] || "")
}

function buildWebsiteExternalId(sourceKey, url) {
  return `website:${sourceKey}:${url}`
}

export function parseWebsiteSourcesFromEnv() {
  const raw = process.env.CHATBOT_WEBSITE_SOURCES
  if (!raw) return []

  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []

    return data
      .map((item) => ({
        sourceKey: String(item.sourceKey || "").trim(),
        name: String(item.name || item.sourceKey || "Website Source").trim(),
        sourceType: "website",
        sourceUrl: normalizeUrl(String(item.sourceUrl || "").trim()),
        sourceUrls: toArray(item.sourceUrls)
          .map((url) => normalizeUrl(url))
          .filter(Boolean),
        roleScope: ["shared", "user", "dealer"].includes(item.roleScope) ? item.roleScope : "shared",
        maxPages: safePositiveInt(item.maxPages, 5, { min: 1, max: 30 }),
        maxCharsPerPage: safePositiveInt(item.maxCharsPerPage, 12000, { min: 500, max: 40000 }),
        followLinks: item.followLinks !== false,
        allowExternalLinks: item.allowExternalLinks === true,
        includePathRegex: safeRegex(item.includePathRegex),
        excludePathRegex: safeRegex(item.excludePathRegex),
        enabled: item.enabled !== false,
      }))
      .map((item) => {
        const mergedSeeds = [...item.sourceUrls]
        if (item.sourceUrl) mergedSeeds.unshift(item.sourceUrl)
        return {
          ...item,
          seedUrls: Array.from(new Set(mergedSeeds.filter(Boolean))),
        }
      })
      .filter((item) => item.enabled && item.sourceKey && item.seedUrls.length > 0)
  } catch (error) {
    console.error("❌ CHATBOT_WEBSITE_SOURCES không hợp lệ:", error.message)
    return []
  }
}

export function buildWebsiteAdapter(config) {
  const seedUrls = Array.from(new Set([...(config.seedUrls || []), ...(config.sourceUrl ? [config.sourceUrl] : [])]))
  const primaryUrl = seedUrls[0] || ""
  const seedHost = primaryUrl ? new URL(primaryUrl).host : ""

  return {
    sourceKey: config.sourceKey,
    name: config.name,
    sourceType: "website",
    sourceUrl: primaryUrl,
    roleScope: config.roleScope || "shared",
    async collectDocuments() {
      const visited = new Set()
      const queue = [...seedUrls]
      const documents = []

      while (queue.length > 0 && documents.length < config.maxPages) {
        const currentUrl = queue.shift()
        if (!currentUrl || visited.has(currentUrl)) continue
        if (!shouldIncludeUrl(currentUrl, config, seedHost)) continue

        visited.add(currentUrl)

        try {
          const response = await fetch(currentUrl, {
            method: "GET",
            headers: {
              "User-Agent": "AgriTrend-RAG-Bot/1.0 (+website-ingest)",
              Accept: "text/html,application/xhtml+xml",
            },
          })

          if (!response.ok) {
            continue
          }

          const contentType = String(response.headers.get("content-type") || "").toLowerCase()
          if (!contentType.includes("text/html")) {
            continue
          }

          const html = await response.text()
          const pageTitle = extractTitle(html) || config.name
          const description = extractMetaDescription(html)
          const plainText = stripHtml(html)
          const compactText = plainText.slice(0, config.maxCharsPerPage)

          if (!compactText) continue

          documents.push({
            externalId: buildWebsiteExternalId(config.sourceKey, currentUrl),
            title: pageTitle,
            sourceUrl: currentUrl,
            roleScope: config.roleScope || "shared",
            content: [
              `Nguồn website: ${config.name}`,
              `URL: ${currentUrl}`,
              description ? `Mô tả: ${description}` : "",
              `Nội dung chính: ${compactText}`,
            ]
              .filter(Boolean)
              .join("\n"),
            metadata: {
              source: "website",
              sourceKey: config.sourceKey,
              sourceUrl: currentUrl,
            },
          })

          if (config.followLinks && documents.length < config.maxPages) {
            for (const nextUrl of extractLinks(html, currentUrl)) {
              if (!visited.has(nextUrl) && shouldIncludeUrl(nextUrl, config, seedHost)) {
                queue.push(nextUrl)
              }
            }
          }
        } catch {
          // Bỏ qua URL lỗi và tiếp tục crawl.
        }
      }

      return documents
    },
  }
}