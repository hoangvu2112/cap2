import express from "express";
import pool from "../db.js";

const router = express.Router();

/* ===============================
   CONSTANTS & KEYWORDS
================================ */

const INTENTS = {
  GET_PRICE: "GET_PRICE",
  GET_HISTORY: "GET_HISTORY",
  GET_TREND: "GET_TREND",
  PREDICT_TREND: "PREDICT_TREND",
  COMPARE_PRICES: "COMPARE_PRICES",
  GET_ALERT: "GET_ALERT",
  SET_ALERT: "SET_ALERT",
  HELP: "HELP",
  OUT_OF_DOMAIN: "OUT_OF_DOMAIN",
};

const PRODUCT_KEYWORDS = [
  {
    names: [
      "cà phê",
      "cafe",
      "coffee"
    ], normalized: "cà phê"
  },
  {
    names: [
      "tiêu",
      "hồ tiêu",
      "pepper"
    ], normalized: "tiêu"
  },
  {
    names: [
      "lúa",
      "gạo",
      "rice"
    ], normalized: "lúa"
  },
  {
    names: [
      "cao su",
      "rubber"
    ], normalized: "cao su"
  },
  {
    names: [
      "ca cao",
      "cacao"
    ], normalized: "ca cao"
  },
];

const REGION_KEYWORDS = [
  "đắk lắk",
  "dak lak",
  "lâm đồng",
  "lam dong",
  "gia lai",
  "đắk nông",
  "dak nong",
  "tiền giang",
  "tien giang",
  "sông cửu long",
  "song cuu long",
  "mekong delta"
];

const PRICE_KEYWORDS = [
  "giá",
  "bao nhiêu",
  "hiện tại",
  "price",
  "cost"
];
const HISTORY_KEYWORDS = [
  "lịch sử",
  "trước đây",
  "các ngày",
  "biến động",
  "history"
];
const TREND_KEYWORDS = [
  "xu hướng",
  "đang tăng",
  "đang giảm",
  "trend"
];
const PREDICT_KEYWORDS = [
  "dự đoán",
  "sắp tới",
  "vài ngày",
  "tương lai",
  "predict"
];
const COMPARE_KEYWORDS = [
  "so sánh",
  "compare",
  "khác nhau"
];
const ALERT_KEYWORDS = [
  "cảnh báo",
  "alert",
  "thông báo",
  "đặt giá"
];
const HELP_KEYWORDS = [
  "hướng dẫn",
  "giúp",
  "help"
];

const FORBIDDEN_INTENTS = [
  INTENTS.GET_TREND,
  INTENTS.PREDICT_TREND,
  "FORECAST",
  "ANALYZE_MARKET"
];

function validateAIResult(ai) {
  // 1️⃣ AI trả về không hợp lệ
  if (!ai || typeof ai !== "object") {
    return { intent: INTENTS.OUT_OF_DOMAIN };
  }

  // 2️⃣ Intent bị cấm → chặn thẳng
  if (FORBIDDEN_INTENTS.includes(ai.intent)) {
    return { intent: INTENTS.OUT_OF_DOMAIN };
  }

  // 3️⃣ Intent không nằm trong whitelist
  if (!Object.values(INTENTS).includes(ai.intent)) {
    return { intent: INTENTS.OUT_OF_DOMAIN };
  }

  // 4️⃣ Validate product
  if (ai.product) {
    const validProduct = PRODUCT_KEYWORDS.some(
      p => p.normalized === ai.product
    );
    if (!validProduct) ai.product = null;
  }

  // 5️⃣ Validate region
  if (ai.region) {
    const normalizedRegion = removeVietnameseTones(ai.region.toLowerCase());
    const validRegion = REGION_KEYWORDS.some(r => removeVietnameseTones(r.toLowerCase()).includes(normalizedRegion));
    if (!validRegion) ai.region = null;
  }


  return {
    intent: ai.intent,
    product: ai.product ?? null,
    region: ai.region ?? null,
    threshold: ai.threshold ?? null,
    condition: ai.condition ?? null
  };
}

/* ===============================
   CONVERSATION CONTEXT (IN-MEMORY)
================================ */

const sessionContext = new Map(); // key: userId

function updateContext(userId, analysis) {
  if (!userId) return;

  const prev = sessionContext.get(userId) || {};
  sessionContext.set(userId,
    {
      product: analysis.product || prev.product,
      region: analysis.region || prev.region
    });
}

function applyContext(userId, analysis) {
  if (!userId) return analysis;

  const ctx = sessionContext.get(userId);
  if (!ctx) return analysis;

  return {
    ...analysis,
    product: analysis.product || ctx.product,
    region: analysis.region || ctx.region
  };
}
/* ===============================
   UTILITY FUNCTIONS
================================ */

function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,
      "")
    .replace(/đ/g,
      "d")
    .replace(/Đ/g,
      "D");
}

function fuzzyMatch(text, keywords) {
  const normalized = removeVietnameseTones(text);
  return keywords.some(k => {
    const nk = removeVietnameseTones(k);
    return normalized.includes(nk) || text.includes(k);
  });
}
/* ===============================
   ENHANCED NLP PARSER
================================ */

function extractProduct(text) {
  for (const prod of PRODUCT_KEYWORDS) {
    if (fuzzyMatch(text, prod.names)) {
      return prod.normalized;
    }
  }
  return null;
}

function extractRegion(text) {
  for (const region of REGION_KEYWORDS) {
    if (fuzzyMatch(text, [region])) {
      return region.split(",")[0].toLowerCase();
    }
  }
  return null;
}

function extractPriceThreshold(text) {
  const match = text.match(/(\d+)[\s]?k ?/i);
  if (match) {
    let price = parseInt(match[
      1
    ]);
    if (text.includes("k") || text.includes("K")) price *= 1000;
    return price;
  }
  return null;
}

function parseMessage(message) {
  const text = message.toLowerCase();

  const product = extractProduct(text);
  const region = extractRegion(text);

  if (ALERT_KEYWORDS.some(k => text.includes(k))) {
    const threshold = extractPriceThreshold(text);
    if (text.includes("đặt") || text.includes("tạo") || text.includes("set")) {
      return {
        intent: INTENTS.SET_ALERT,
        product,
        region,
        threshold,
        condition: text.includes("trên") || text.includes("cao hơn") ? "above" : "below"
      };
    }
    return {
      intent: INTENTS.GET_ALERT, product
    };
  }

  if (COMPARE_KEYWORDS.some(k => text.includes(k))) {
    return {
      intent: INTENTS.COMPARE_PRICES, product, region
    };
  }

  if (!product && !HELP_KEYWORDS.some(k => text.includes(k))) {
    return {
      intent: INTENTS.OUT_OF_DOMAIN
    };
  }

  if (HISTORY_KEYWORDS.some(k => text.includes(k)))
    return {
      intent: INTENTS.GET_HISTORY, product, region
    };

  if (PREDICT_KEYWORDS.some(k => text.includes(k)))
    return {
      intent: INTENTS.PREDICT_TREND, product, region
    };

  if (TREND_KEYWORDS.some(k => text.includes(k)))
    return {
      intent: INTENTS.GET_TREND, product, region
    };

  if (PRICE_KEYWORDS.some(k => text.includes(k)))
    return {
      intent: INTENTS.GET_PRICE, product, region
    };

  if (HELP_KEYWORDS.some(k => text.includes(k)))
    return {
      intent: INTENTS.HELP
    };

  if (product) return {
    intent: INTENTS.GET_PRICE, product, region
  };

  return {
    intent: INTENTS.HELP
  };
}

async function parseMessageWithAI(message) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.warn("⚠️ Thiếu GROQ_API_KEY để chạy Chatbot NLP");
      return { intent: "OUT_OF_DOMAIN" };
    }

    const prompt = `
Bạn là một MODULE NLP PARSER cho chatbot GIÁ NÔNG SẢN VIỆT NAM.
NHIỆM VỤ DUY NHẤT: Trích xuất intent và tham số từ câu hỏi người dùng.

INTENT HỢP LỆ: GET_PRICE, GET_HISTORY, COMPARE_PRICES, SET_ALERT, GET_ALERT, HELP, OUT_OF_DOMAIN
PRODUCT HỢP LỆ: cà phê, tiêu, sầu riêng, lúa, cao su, ca cao, thanh long, tôm thẻ, cá tra

FORMAT JSON BẮT BUỘC:
{
  "intent": string,
  "product": string | null,
  "region": string | null,
  "threshold": number | null,
  "condition": "above" | "below" | null
}
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "llama-3.3-70b-versatile",
        "messages": [
          { "role": "system", "content": prompt },
          { "role": "user", "content": `User message: "${message}"` }
        ],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("⚠️ Groq Chatbot Parser lỗi:", error.message);
    return { intent: "OUT_OF_DOMAIN" };
  }
}

// async function naturalizeAnswer(rawText) {
//   const completion = await openai.chat.completions.create({
//     model: "gpt-4o-mini",
//     temperature: 0.3,
//     messages: [
//       {
//         role: "system",
//         content: `
// Bạn là chatbot nông sản.
// CHỈ diễn đạt lại cho dễ hiểu.
// KHÔNG thêm thông tin mới.
// `
//       },
//       { role: "user", content: rawText }
//     ]
//   });
//   return completion.choices[0].message.content;
// }
/* ===============================
   ENHANCED ANALYSIS FUNCTIONS
================================ */

function analyzeTrend(prices) {
  if (prices.length < 2) return {
    trend: "stable", confidence: "low"
  };

  const dataSize = Math.min(prices.length,
    7);
  const recent = prices.slice(0, dataSize);
  const last = recent[
    0
  ];
  const prev = recent[
    1
  ];

  const avg = recent.reduce((sum, p) => sum + p,
    0) / recent.length;
  const percentChange = ((last - prev) / prev) * 100;

  let trend = "stable";
  let confidence = "medium";

  if (percentChange > 2) {
    trend = "up";
    confidence = percentChange > 5 ? "high" : "medium";
  } else if (percentChange < -2) {
    trend = "down";
    confidence = percentChange < -5 ? "high" : "medium";
  }

  return {
    trend,
    confidence,
    percentChange: percentChange.toFixed(2),
    average: avg.toFixed(0)
  };
}

function calculateVolatility(prices) {
  if (prices.length < 2) return 0;

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(Math.abs((prices[i - 1
    ] - prices[i
      ]) / prices[i
      ] * 100));
  }

  return changes.reduce((sum, c) => sum + c,
    0) / changes.length;
}

function predictTrend(prices, dataPoints) {
  if (prices.length < 2) {
    return {
      prediction: "⚠️ Chưa đủ dữ liệu để dự đoán (cần ít nhất 2 ngày)",
      confidence: "none",
      reason: "Không đủ dữ liệu lịch sử",
      dataPoints
    };
  }
  // Xác định kích thước dữ liệu để phân tích
  const hasLongHistory = prices.length >= 14;
  const hasMediumHistory = prices.length >= 7;
  const hasShortHistory = prices.length >= 3;

  let longTermSize, shortTermSize;

  if (hasLongHistory) {
    // Đủ 14+ ngày: phân tích đầy đủ
    longTermSize = Math.min(14, prices.length);
    shortTermSize = 7;
  } else if (hasMediumHistory) {
    // 7-13 ngày: phân tích trung bình
    longTermSize = Math.min(10, prices.length);
    shortTermSize = Math.min(5, prices.length);
  } else if (hasShortHistory) {
    // 3-6 ngày: phân tích cơ bản
    longTermSize = prices.length;
    shortTermSize = Math.min(3, prices.length);
  } else {
    // 2 ngày: chỉ so sánh đơn giản
    const last = prices[
      0
    ];
    const prev = prices[
      1
    ];
    const change = ((last - prev) / prev) * 100;

    let prediction;
    if (change > 3) {
      prediction = "📈 Giá vừa TĂNG so với ngày hôm qua, có thể tiếp tục tăng";
    } else if (change < -3) {
      prediction = "📉 Giá vừa GIẢM so với ngày hôm qua, có thể tiếp tục giảm";
    } else {
      prediction = "➖ Giá thay đổi nhẹ, dự kiến dao động ổn định";
    }

    return {
      prediction,
      confidence: "low",
      percentChange: change.toFixed(2),
      reason: "Dữ liệu ít, chỉ dựa trên 2 ngày gần nhất",
      dataPoints
    };
  }
  // Tính toán các chỉ số
  const longTerm = prices.slice(0, longTermSize);
  const shortTerm = prices.slice(0, shortTermSize);

  const longTermAvg = longTerm.reduce((a, b) => a + b,
    0) / longTerm.length;
  const shortTermAvg = shortTerm.reduce((a, b) => a + b,
    0) / shortTerm.length;
  const currentPrice = prices[
    0
  ];
  const yesterdayPrice = prices[
    1
  ];

  const volatility = calculateVolatility(shortTerm);
  const momentum = ((shortTermAvg - longTermAvg) / longTermAvg) * 100;
  const dailyChange = ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100;

  // Phân loại xu hướng
  let trendStrength = "yếu";
  let trendDirection = "ổn định";
  let trendDescription = "";

  if (Math.abs(momentum) > 3) {
    trendStrength = "mạnh";
  } else if (Math.abs(momentum) > 1) {
    trendStrength = "trung bình";
  }

  if (momentum > 1) {
    trendDirection = "tăng";
    trendDescription = `Xu hướng TĂNG ${trendStrength
      } (${momentum.toFixed(2)
      }%)`;
  } else if (momentum < -1) {
    trendDirection = "giảm";
    trendDescription = `Xu hướng GIẢM ${trendStrength
      } (${momentum.toFixed(2)
      }%)`;
  } else {
    trendDescription = `Xu hướng ỔN ĐỊNH (biến động ${Math.abs(momentum).toFixed(2)
      }%)`;
  }
  // Logic dự đoán thông minh
  let prediction = "";
  let confidence = "medium";
  let reason = "";

  // Điều chỉnh độ tin cậy dựa vào số ngày dữ liệu
  if (!hasLongHistory) {
    confidence = "low";
    reason = `Dữ liệu còn ít (${dataPoints
      } ngày), độ chính xác hạn chế. `;
  } else {
    reason = `Dựa trên ${dataPoints
      } ngày dữ liệu. `;
  }
  // Case 1: Xu hướng tăng mạnh + tăng hôm nay
  if (momentum > 3 && dailyChange > 0) {
    if (volatility > 8) {
      prediction = "🚀 Giá CÓ KHẢ NĂNG TĂNG MẠNH trong 1-2 ngày tới";
      confidence = hasLongHistory ? "high" : "medium";
    } else {
      prediction = "📈 Giá DỰ KIẾN TĂNG NHẸ trong 1-2 ngày tới";
    }
    reason += "Momentum tăng mạnh và giá đang tăng.";
  }
  // Case 2: Xu hướng giảm mạnh + giảm hôm nay
  else if (momentum < -3 && dailyChange < 0) {
    if (volatility > 8) {
      prediction = "📉 Giá CÓ KHẢ NĂNG GIẢM MẠNH trong 1-2 ngày tới";
      confidence = hasLongHistory ? "high" : "medium";
    } else {
      prediction = "📊 Giá DỰ KIẾN GIẢM NHẸ trong 1-2 ngày tới";
    }
    reason += "Momentum giảm mạnh và giá đang giảm.";
  }
  // Case 3: Giá hiện tại thấp hơn trung bình ngắn hạn (có thể phục hồi)
  else if (currentPrice < shortTermAvg * 0.98 && momentum > 0) {
    prediction = "📈 Giá CÓ THỂ PHỤC HỒI TĂNG NHẸ trong 1-2 ngày tới";
    reason += "Giá đang thấp hơn trung bình gần đây.";
  }
  // Case 4: Giá hiện tại cao hơn trung bình ngắn hạn (có thể điều chỉnh)
  else if (currentPrice > shortTermAvg * 1.02 && momentum < 0) {
    prediction = "📊 Giá CÓ THỂ ĐIỀU CHỈNH GIẢM NHẸ trong 1-2 ngày tới";
    reason += "Giá đang cao hơn trung bình gần đây.";
  }
  // Case 5: Đảo chiều từ tăng sang giảm
  else if (momentum > 2 && dailyChange < -2) {
    prediction = "⚠️ Giá ĐANG ĐẢO CHIỀU từ tăng sang giảm, CẨN TRỌNG";
    reason += "Xu hướng tăng nhưng hôm nay giá giảm mạnh.";
  }
  // Case 6: Đảo chiều từ giảm sang tăng
  else if (momentum < -2 && dailyChange > 2) {
    prediction = "✅ Giá ĐANG PHỤC HỒI sau đợt giảm, có thể tăng tiếp";
    reason += "Xu hướng giảm nhưng hôm nay giá tăng mạnh.";
  }
  // Case 7: Biến động cao - khó dự đoán
  else if (volatility > 10) {
    prediction = "🌊 Giá BIẾN ĐỘNG MẠNH, khó dự đoán chính xác. Nên theo dõi sát";
    confidence = "low";
    reason += `Biến động cao (${volatility.toFixed(2)
      }%).`;
  }
  // Case 8: Xu hướng tăng nhẹ
  else if (momentum > 1 && momentum <= 3) {
    prediction = "📈 Giá CÓ XU HƯỚNG TĂNG NHẸ trong 1-2 ngày tới";
    reason += "Momentum tăng nhẹ.";
  }
  // Case 9: Xu hướng giảm nhẹ
  else if (momentum < -1 && momentum >= -3) {
    prediction = "📊 Giá CÓ XU HƯỚNG GIẢM NHẸ trong 1-2 ngày tới";
    reason += "Momentum giảm nhẹ.";
  }
  // Case 10: Ổn định
  else {
    prediction = "➖ Giá DỰ KIẾN DAO ĐỘNG ỔN ĐỊNH trong 1-2 ngày tới";
    reason += "Không có biến động đáng kể.";
  }

  return {
    prediction,
    confidence,
    volatility: volatility.toFixed(2),
    momentum: momentum.toFixed(2),
    dailyChange: dailyChange.toFixed(2),
    trendDirection,
    trendStrength,
    trendDescription,
    currentPrice: currentPrice.toFixed(0),
    yesterdayPrice: yesterdayPrice.toFixed(0),
    shortTermAvg: shortTermAvg.toFixed(0),
    longTermAvg: longTermAvg.toFixed(0),
    dataPoints,
    reason
  };
}
/* ===============================
   CHATBOT API
================================ */

router.post("/query", async (req, res) => {
  const { message, userId
  } = req.body;

  if (!message) {
    return res.json({
      type: "ERROR",
      text: "Vui lòng nhập câu hỏi của bạn."
    });
  }

  // 1️⃣ ƯU TIÊN RULE-BASED NLP TRƯỚC
  let analysis = parseMessage(message);
  console.log("🧠 Rule-based intent:", analysis);

  // 2️⃣ CHỈ GỌI AI NẾU RULE-BASED BÓ TAY
  if (analysis.intent === INTENTS.OUT_OF_DOMAIN) {
    try {
      const aiResult = await parseMessageWithAI(message);
      analysis = validateAIResult(aiResult);
      console.log("🤖 AI intent (fallback):", analysis);
    } catch (err) {
      console.warn("⚠️ AI parse lỗi → giữ rule-based");
    }
  }
  // 🔐 AI Guard Layer – BẮT BUỘC
  analysis = validateAIResult(analysis);
  console.log("🛡️ AI Intent (validated):", analysis);

  // 🧠 APPLY CONVERSATION CONTEXT
  analysis = applyContext(userId, analysis);


  // 🔴 NEED CLARIFICATION – BẮT MƠ HỒ
  if (
    [INTENTS.GET_PRICE, INTENTS.GET_TREND, INTENTS.PREDICT_TREND, INTENTS.GET_HISTORY
    ]
      .includes(analysis.intent)
    && !analysis.product
  ) {
    return res.json({
      type: "CLARIFY",
      text: "Bạn muốn hỏi giá sản phẩm nào? (cà phê, tiêu, ...)"
    });
  }
  // 🔴 NEED CLARIFICATION – thiếu khu vực (region)
  if (
    analysis.intent === INTENTS.GET_PRICE &&
    analysis.product &&
    !analysis.region
  ) {
    return res.json({
      type: "CLARIFY",
      text: `Bạn muốn xem giá ${analysis.product
        } ở khu vực nào? (Đắk Lắk, Gia Lai, Lâm Đồng...)`
    });
  }
  // 🧠 UPDATE CONVERSATION CONTEXT
  updateContext(userId, analysis);

  try {
    /* ===============================
   GET CURRENT PRICE
================================ */
    if (analysis.intent === INTENTS.GET_PRICE) {
      let query = `
        SELECT name, region, currentPrice, unit, trend, lastUpdate
        FROM products
        WHERE name LIKE ?
      `;
      let params = [`%${analysis.product
        }%`
      ];

      if (analysis.region) {
        query += " AND region LIKE ?";
        params.push(`%${analysis.region
          }%`);
      }

      query += " ORDER BY lastUpdate DESC LIMIT 3";

      const [rows
      ] = await pool.query(query, params);

      if (rows.length === 0) {
        return res.json({
          type: "INFO",
          text: `Không tìm thấy giá ${analysis.product
            }${analysis.region ? ` tại ${analysis.region
              }` : ''
            }. Thử tìm kiếm sản phẩm khác? 🔍`,
        });
      }

      return res.json({
        type: "PRICE_INFO",
        data: rows.length === 1 ? rows[
          0
        ] : rows,
        message: rows.length > 1 ? `Tìm thấy ${rows.length
          } kết quả:` : null
      });
    }
    /* ===============================
   GET PRICE HISTORY
================================ */
    if (analysis.intent === INTENTS.GET_HISTORY) {
      const [[product]] = await pool.query(
        `
    SELECT id, name, region
    FROM products
    WHERE LOWER(name) LIKE ?
      ${analysis.region ? "AND LOWER(region) LIKE ?" : ""}
    ORDER BY lastUpdate DESC
    LIMIT 1
    `,
        analysis.region
          ? [`%${analysis.product}%`, `%${analysis.region}%`]
          : [`%${analysis.product}%`]
      );

      if (!product) {
        return res.json({
          type: "INFO",
          text: `Không tìm thấy ${analysis.product
            }${analysis.region ? " tại " + analysis.region : ""
            }.`
        });
      }

      const [history
      ] = await pool.query(
        `
    SELECT price, updated_at
    FROM price_history
    WHERE product_id = ?
    ORDER BY updated_at DESC
    `,
        [product.id
        ]
      );

      if (history.length === 0) {
        return res.json({
          type: "INFO",
          text: `Chưa có dữ liệu lịch sử giá cho ${product.name
            }.`
        });
      }

      return res.json({
        type: "HISTORY",
        data: {
          product: product.name,
          region: product.region,
          records: history.reverse(),
          days: history.length
        }
      });
    }
    /* ===============================
   GET CURRENT TREND
================================ */
    if (analysis.intent === INTENTS.GET_TREND) {
      let query = "SELECT id, name, region, trend FROM products WHERE name LIKE ?";
      let params = [`%${analysis.product
        }%`
      ];

      if (analysis.region) {
        query += " AND region LIKE ?";
        params.push(`%${analysis.region
          }%`);
      }

      query += " LIMIT 1";

      const [
        [product
        ]
      ] = await pool.query(query, params);

      if (!product) {
        return res.json({
          type: "INFO",
          text: `Không tìm thấy sản phẩm ${analysis.product
            }${analysis.region ? ` tại ${analysis.region
              }` : ''
            }.`
        });
      }

      const [history
      ] = await pool.query(
        `SELECT price FROM price_history 
         WHERE product_id = ? 
         ORDER BY updated_at DESC 
         LIMIT 10`,
        [product.id
        ]
      );

      if (history.length === 0) {
        return res.json({
          type: "INFO",
          text: `Chưa có dữ liệu để phân tích xu hướng cho ${product.name
            }.`
        });
      }

      const prices = history.map(h => Number(h.price));
      const trendAnalysis = analyzeTrend(prices);

      const trendMap = {
        up: "đang tăng 📈",
        down: "đang giảm 📉",
        stable: "đang ổn định ➖",
      };

      const finalText = `Xu hướng giá ${product.name
        } hiện tại ${trendMap[trendAnalysis.trend
        ]
        }`;

      return res.json({
        type: "TREND",
        text: finalText,
        data: {
          product: product.name,
          region: product.region,
          trend: trendAnalysis.trend,
          percentChange: trendAnalysis.percentChange,
          confidence: trendAnalysis.confidence,
          average: trendAnalysis.average,
          dataPoints: history.length
        }
      });
    }
    /* ===============================
   PREDICT SHORT-TERM TREND
================================ */
    if (analysis.intent === INTENTS.PREDICT_TREND) {
      let query = "SELECT id, name, region FROM products WHERE name LIKE ?";
      let params = [`%${analysis.product
        }%`
      ];

      if (analysis.region) {
        query += " AND region LIKE ?";
        params.push(`%${analysis.region
          }%`);
      }

      query += " LIMIT 1";

      const [
        [product
        ]
      ] = await pool.query(query, params);

      if (!product) {
        return res.json({
          type: "INFO",
          text: `Không tìm thấy sản phẩm ${analysis.product
            }${analysis.region ? ` tại ${analysis.region
              }` : ''
            }.`,
        });
      }
      // Lấy TẤT CẢ lịch sử giá có sẵn
      const [history
      ] = await pool.query(
        `SELECT price, updated_at FROM price_history 
         WHERE product_id = ? 
         ORDER BY updated_at DESC`,
        [product.id
        ]
      );

      console.log(`📊 Sản phẩm: ${product.name
        }, Số ngày dữ liệu: ${history.length
        }`);

      if (!history || history.length < 2) {
        return res.json({
          type: "INFO",
          text: `Chưa đủ dữ liệu để dự đoán xu hướng cho ${product.name
            }. Cần ít nhất 2 ngày dữ liệu (hiện có ${history.length
            } ngày).`,
        });
      }

      const prices = history.map(h => Number(h.price));
      const prediction = predictTrend(prices, history.length);

      // Định dạng thông báo dựa trên số lượng dữ liệu
      let confidenceText = "";
      if (prediction.confidence === "high") {
        confidenceText = "✅ Độ tin cậy: CAO";
      } else if (prediction.confidence === "medium") {
        confidenceText = "⚠️ Độ tin cậy: TRUNG BÌNH";
      } else if (prediction.confidence === "low") {
        confidenceText = "❗ Độ tin cậy: THẤP";
      } else {
        confidenceText = "❌ Không đủ dữ liệu";
      }

      let responseText = `**Dự đoán giá ${product.name
        }**`;
      if (product.region) {
        responseText += ` **(${product.region
          })**`;
      }
      responseText += `\n\n${prediction.prediction
        }\n\n${confidenceText
        }`;

      // Thêm thông tin chi tiết nếu có đủ dữ liệu
      if (history.length >= 3) {
        responseText += `\n📊 Biến động: ${prediction.volatility
          }%`;
        responseText += `\n📈 Momentum: ${prediction.momentum
          }%`;
        responseText += `\n💰 Giá hôm nay: ${Number(prediction.currentPrice).toLocaleString()
          } VNĐ`;
        responseText += `\n📅 Dữ liệu: ${prediction.dataPoints
          } ngày`;
      }

      responseText += `\n\n💡 ${prediction.reason
        }`;

      return res.json({
        type: "PREDICTION",
        text: responseText,
        data: {
          ...prediction,
          product: product.name,
          region: product.region
        }
      });
    }
    /* ===============================
   COMPARE PRICES
================================ */
    if (analysis.intent === INTENTS.COMPARE_PRICES) {
      const [rows
      ] = await pool.query(
        `SELECT name, region, currentPrice, unit, trend
         FROM products
         WHERE name LIKE ?
         ORDER BY currentPrice DESC`,
        [`%${analysis.product
          }%`
        ]
      );

      if (rows.length < 2) {
        return res.json({
          type: "INFO",
          text: "Không đủ dữ liệu để so sánh giá giữa các vùng.",
        });
      }

      return res.json({
        type: "COMPARE",
        data: {
          product: analysis.product,
          regions: rows
        }
      });
    }
    /* ===============================
   SET PRICE ALERT
================================ */
    if (analysis.intent === INTENTS.SET_ALERT) {
      if (!userId) {
        return res.json({
          type: "INFO",
          text: "Vui lòng đăng nhập để sử dụng tính năng cảnh báo giá.",
        });
      }

      if (!analysis.product) {
        return res.json({
          type: "INFO",
          text: "Vui lòng cho biết sản phẩm cần cảnh báo. Ví dụ: 'Đặt cảnh báo cà phê trên 50000'",
        });
      }

      if (!analysis.threshold) {
        return res.json({
          type: "INFO",
          text: "Vui lòng cho biết mức giá cần cảnh báo. Ví dụ: 'Đặt cảnh báo cà phê trên 50000'",
        });
      }
      // Tìm product_id
      const [
        [product
        ]
      ] = await pool.query(
        "SELECT id FROM products WHERE name LIKE ? LIMIT 1",
        [`%${analysis.product
          }%`
        ]
      );

      if (!product) {
        return res.json({
          type: "INFO",
          text: `Không tìm thấy sản phẩm ${analysis.product
            }.`,
        });
      }
      // Lấy email người dùng
      const [
        [user
        ]
      ] = await pool.query(
        "SELECT email FROM users WHERE id = ?",
        [userId
        ]
      );

      await pool.query(
        `INSERT INTO price_alerts (user_id, product_id, target_price, alert_condition, email, notified)
         VALUES (?, ?, ?, ?, ?, false)`,
        [userId, product.id, analysis.threshold, analysis.condition, user.email
        ]
      );

      return res.json({
        type: "SUCCESS",
        text: `✅ Đã đặt cảnh báo giá ${analysis.product
          } ${analysis.condition === 'above' ? 'trên' : 'dưới'
          } ${analysis.threshold.toLocaleString()
          } VNĐ`,
      });
    }
    /* ===============================
   GET USER ALERTS
================================ */
    if (analysis.intent === INTENTS.GET_ALERT) {
      if (!userId) {
        return res.json({
          type: "INFO",
          text: "Vui lòng đăng nhập để xem danh sách cảnh báo.",
        });
      }

      const [alerts
      ] = await pool.query(
        `SELECT pa.*, p.name as product_name 
         FROM price_alerts pa
         JOIN products p ON pa.product_id = p.id
         WHERE pa.user_id = ? AND pa.notified = false
         ORDER BY pa.created_at DESC`,
        [userId
        ]
      );

      if (alerts.length === 0) {
        return res.json({
          type: "INFO",
          text: "Bạn chưa đặt cảnh báo giá nào. Thử hỏi 'Đặt cảnh báo cà phê trên 50k' để bắt đầu.",
        });
      }

      let text = "🔔 **Danh sách cảnh báo giá của bạn:**\n\n";

      alerts.forEach((a, index) => {
        text += `${index + 1
          }. ${a.product_name
          } ${a.alert_condition === "above" ? "trên" : "dưới"
          } ${Number(a.target_price).toLocaleString()
          } VNĐ\n`;
      });

      return res.json({
        type: "ALERT_LIST",
        text,
        data: alerts
      });
    }
    if (analysis.intent === INTENTS.HELP) {
      sessionContext.delete(userId);

      return res.json({
        type: "HELP",
        text: `
🤖 **Tôi có thể giúp bạn:**

• Hỏi giá hiện tại  
👉 "Giá cà phê Đắk Lắk hôm nay"

• Xem lịch sử giá  
👉 "Lịch sử giá tiêu Gia Lai"

• Xem xu hướng  
👉 "Xu hướng giá cà phê"

• Dự đoán ngắn hạn  
👉 "Dự đoán giá cà phê vài ngày tới"

• So sánh giá  
👉 "So sánh giá tiêu các vùng"

• Đặt cảnh báo  
👉 "Đặt cảnh báo cà phê trên 50k"

• Xem cảnh báo  
👉 "Cảnh báo giá của tôi"
`
      });
    }
    if (analysis.intent === INTENTS.OUT_OF_DOMAIN) {
      sessionContext.delete(userId);

      return res.json({
        type: "OUT_OF_DOMAIN",
        text: "❓ Tôi hiện chỉ hỗ trợ thông tin **giá nông sản** (cà phê, tiêu, lúa, cao su...). Bạn thử hỏi lại nhé!"
      });
    }

    return res.json({
      type: "INFO",
      text: "🤔 Tôi chưa hiểu rõ câu hỏi. Bạn có thể hỏi lại theo cách khác không?"
    });
  } catch (error) {
    console.error("❌ Chatbot error:", error);
    return res.status(500).json({
      type: "ERROR",
      text: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."
    });
  }
});

/* ===============================
   EXPORT ROUTER
================================ */
export default router;

