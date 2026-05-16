import axios from 'axios'
import crypto from 'crypto'

const DEFAULT_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create'

/**
 * Create a MoMo payment (sandbox/prod depending on env).
 * Returns object: { payUrl, qrCodeUrl, deeplink, raw }
 */
export async function createMomoPayment({ orderId, amount, orderInfo, redirectUrl, ipnUrl, requestType = 'captureWallet' }) {
  const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO'
  const accessKey = process.env.MOMO_ACCESS_KEY || ''
  const secretKey = process.env.MOMO_SECRET_KEY || ''
  const endpoint = process.env.MOMO_ENDPOINT || DEFAULT_ENDPOINT

  if (!accessKey || !secretKey) {
    throw new Error('Missing MOMO_ACCESS_KEY or MOMO_SECRET_KEY in environment')
  }

  const requestId = `${partnerCode}-${Date.now()}`
  const extraData = ''

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`

  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')

  const body = {
    partnerCode,
    accessKey,
    requestId,
    amount: String(amount),
    orderId: String(orderId),
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: 'vi',
  }

  const { data } = await axios.post(endpoint, body, { timeout: 30000 })

  // Normalize common fields
  return {
    payUrl: data.payUrl || data.paymentUrl || data.deeplink || null,
    qrCodeUrl: data.qrCodeUrl || data.qr_code || null,
    deeplink: data.deeplink || null,
    raw: data,
  }
}

export async function checkMomoPaymentStatus(orderId) {
  const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO'
  const accessKey = process.env.MOMO_ACCESS_KEY || ''
  const secretKey = process.env.MOMO_SECRET_KEY || ''
  // Hardcode test endpoint for query status as it's the standard for test env
  const endpoint = 'https://test-payment.momo.vn/v2/gateway/api/query'

  const requestId = `${partnerCode}-${Date.now()}`
  const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')

  const body = {
    partnerCode,
    requestId,
    orderId: String(orderId),
    signature,
    lang: 'vi'
  }

  const { data } = await axios.post(endpoint, body, { timeout: 30000 })
  return data
}

export default { createMomoPayment, checkMomoPaymentStatus }
