

import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), 'apps/backend/.env') })

const [,, webhookUrl, orderIdArg, amountArg] = process.argv
if (!webhookUrl || !orderIdArg || !amountArg) {
  console.error('Usage: node simulate_momo_ipn.js <webhookUrl> <orderId> <amount>')
  process.exit(1)
}

const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO'
const accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85'
const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz'

const orderId = String(orderIdArg)
const requestId = `${partnerCode}-${Date.now()}`
const amount = String(amountArg)
const orderInfo = `Simulated payment for order ${orderId}`
const orderType = 'captureWallet'
const transId = `${Date.now()}`
const resultCode = 0
const message = 'Success.'
const payType = 'qr'
const responseTime = String(Date.now())
const extraData = ''

const rawSignature =
  `accessKey=${accessKey}` +
  `&amount=${amount}` +
  `&extraData=${extraData}` +
  `&message=${message}` +
  `&orderId=${orderId}` +
  `&orderInfo=${orderInfo}` +
  `&orderType=${orderType}` +
  `&partnerCode=${partnerCode}` +
  `&payType=${payType}` +
  `&requestId=${requestId}` +
  `&responseTime=${responseTime}` +
  `&resultCode=${resultCode}` +
  `&transId=${transId}`

const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')

const payload = {
  partnerCode,
  orderId,
  requestId,
  amount,
  orderInfo,
  orderType,
  transId,
  resultCode,
  message,
  payType,
  responseTime,
  extraData,
  signature
}

async function send() {
  try {
    console.log('Posting simulated IPN to', webhookUrl)
    const res = await axios.post(webhookUrl, payload, { timeout: 10000 })
    console.log('Response status:', res.status)
    console.log('Response data:', res.data)
  } catch (err) {
    console.error('Error posting simulated IPN:', err.message)
    if (err.response) console.error(err.response.data)
    process.exit(2)
  }
}

send()
