
const https = require('https')
const crypto = require('crypto')

const amount = process.argv[2] || process.env.AMOUNT || '50000'
const orderInfo = process.argv[3] || process.env.ORDER_INFO || 'pay with MoMo'

const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO'
const accessKey = process.env.MOMO_ACCESS_KEY || ''
const secretKey = process.env.MOMO_SECRET_KEY || ''
const redirectUrl = process.env.FRONTEND_URL || process.env.REDIRECT_URL || 'http://localhost:3000'

const backendRaw = process.env.BACKEND_URL || process.env.BACKEND_ROOT || ''
const backendRoot = backendRaw.replace(/\/api\/?$/i, '') || ''
const ipnUrl = backendRoot ? `${backendRoot}/api/dealer-upgrade/momo/webhook` : (process.env.IPN_URL || redirectUrl)

const requestType = 'captureWallet'
const requestId = `${partnerCode}-${Date.now()}`
const orderId = `${partnerCode}${Date.now()}`
const extraData = ''

if (!accessKey || !secretKey) {
    console.error('Missing MOMO_ACCESS_KEY or MOMO_SECRET_KEY in environment')
    process.exit(1)
}

const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`
console.log('RAW SIGNATURE:', rawSignature)

const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')
console.log('SIGNATURE:', signature)

const body = JSON.stringify({
    partnerCode,
    partnerName: 'Test',
    storeId: 'MomoTestStore',
    requestId,
    amount: String(amount),
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: 'vi',
    requestType,
    extraData,
    signature,
})

const options = {
    hostname: 'test-payment.momo.vn',
    port: 443,
    path: '/v2/gateway/api/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    },
}

const req = https.request(options, (res) => {
    let data = ''
    res.setEncoding('utf8')
    res.on('data', (chunk) => data += chunk)
    res.on('end', () => {
        try {
            const json = JSON.parse(data)
            console.log('Response:', JSON.stringify(json, null, 2))
            // print payUrl / qrCodeUrl if present
            console.log('payUrl:', json.payUrl || json.deeplink || json.payUrl)
            console.log('qrCodeUrl:', json.qrCodeUrl || json.qr_code || null)
        } catch (e) {
            console.log('Non-JSON response:', data)
        }
    })
})

req.on('error', (e) => console.error('Request error:', e.message))
req.write(body)
req.end()