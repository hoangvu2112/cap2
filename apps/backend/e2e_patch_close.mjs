const API = 'http://localhost:5000/api';
const requestId = 17; // from previous run
const token = process.argv[2];
if (!token) { console.error('Usage: node e2e_patch_close.mjs <TOKEN>'); process.exit(1) }

(async () => {
  const res = await fetch(`${API}/purchase-requests/${requestId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'closed' })
  })
  const t = await res.text();
  console.log('status', res.status)
  try { console.log(JSON.parse(t)) } catch(e) { console.log(t) }
})()
