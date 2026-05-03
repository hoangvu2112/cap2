const API = 'http://localhost:5000/api';

async function post(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: Object.assign({'Content-Type': 'application/json'}, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

async function get(path, token) {
  const res = await fetch(API + path, { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

async function patch(path, body, token) {
  const res = await fetch(API + path, {
    method: 'PATCH',
    headers: Object.assign({'Content-Type': 'application/json'}, token ? { Authorization: `Bearer ${token}` } : {}),
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

(async () => {
  console.log('Starting E2E test...')
  // 1. Register farmer
  const farmerEmail = `farmer.e2e.${Date.now()}@example.com`
  const buyerEmail = `buyer.e2e.${Date.now()}@example.com`

  console.log('Register farmer:', farmerEmail)
  let r = await post('/auth/register', { email: farmerEmail, password: 'pass1234', name: 'FarmerE2E' })
  console.log('farmer register', r.status, r.data)
  const farmerToken = r.data?.token
  const farmerId = r.data?.user?.id

  console.log('Register buyer:', buyerEmail)
  r = await post('/auth/register', { email: buyerEmail, password: 'pass1234', name: 'BuyerE2E' })
  console.log('buyer register', r.status, r.data)
  const buyerToken = r.data?.token
  const buyerId = r.data?.user?.id

  if (!farmerToken || !buyerId) {
    console.error('Missing tokens/ids, aborting')
    process.exit(1)
  }

  // 2. Create purchase request as farmer (initiator)
  console.log('Create purchase request as farmer -> partner is buyer')
  r = await post('/purchase-requests', { product_id: 1, partner_id: buyerId, quantity: 5, proposed_price: 12000, note: 'E2E test' }, farmerToken)
  console.log('create request', r.status, r.data)
  const requestId = r.data?.id || r.data?.insertId || (r.data && r.data.id)

  if (!requestId) {
    console.error('No request id, aborting')
    process.exit(1)
  }

  // 3. Close request (as farmer)
  console.log('Close request (farmer)')
  r = await patch(`/purchase-requests/${requestId}/status`, { status: 'closed' }, farmerToken)
  console.log('close result', r.status, r.data)
  const orderId = r.data?.orderId

  if (!orderId) {
    // maybe created but returned differently; attempt to find orders for farmer
    console.log('Attempt finding order via /orders/my')
    const ordersRes = await get(`/orders/my/${farmerId}`)
    console.log('orders for farmer', ordersRes.status, ordersRes.data)
  }

  // 4. Pay order
  const payId = orderId || (Array.isArray(r.data) && r.data[0] && r.data[0].id)
  if (payId) {
    console.log('Paying order', payId)
    const payRes = await post(`/orders/${payId}/pay`, {}, farmerToken)
    console.log('pay result', payRes.status, payRes.data)

    // 5. Verify order status
    const ordersAfter = await get(`/orders/my/${farmerId}`)
    console.log('orders after pay', ordersAfter.status, ordersAfter.data)
  } else {
    console.log('No order id found to pay')
  }

  console.log('E2E test finished')
  process.exit(0)
})()
