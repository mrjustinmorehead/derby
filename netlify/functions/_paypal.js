const {
  PAYPAL_ENV = 'sandbox',
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  DEFAULT_CURRENCY = 'USD',
} = process.env;

const PP_BASE = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed');
  return data.access_token;
}

async function createOrder(total, description = 'Derby Squares') {
  const access = await getAccessToken();
  const res = await fetch(`${PP_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: DEFAULT_CURRENCY, value: total.toFixed(2) }, description }],
      application_context: {
        brand_name: 'Morehead Derby Squares',
        user_action: 'PAY_NOW',
        return_url: 'https://moreheadderby.netlify.app/',
        cancel_url: 'https://moreheadderby.netlify.app/',
      },
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error('Failed to create order');
  return data;
}

async function captureOrder(orderId) {
  const access = await getAccessToken();
  const res = await fetch(`${PP_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!data.id) throw new Error('Failed to capture order');
  return data;
}

module.exports = { createOrder, captureOrder };
