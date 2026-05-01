const crypto = require('crypto');

const SUPABASE_URL = 'https://jvsvuccssvehayylatmp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const LEMON_SECRET = process.env.LEMON_WEBHOOK_SECRET;

const PLAN_MAP = {
  '9acb83ef-b530-4bd4-8ee8-b6866319850a': 'starter',
  '21851284-2625-44fa-9dbc-d048f4899adb': 'pro',
  'b196b9b7-45f9-454f-9c8c-da900fd0942d': 'agency'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['x-signature'];
  if (LEMON_SECRET && signature) {
    const hmac = crypto.createHmac('sha256', LEMON_SECRET);
    const digest = hmac.update(event.body).digest('hex');
    if (digest !== signature) {
      return { statusCode: 401, body: 'Invalid signature' };
    }
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const eventName = payload.meta?.event_name;
  const data = payload.data?.attributes;
  const email = data?.user_email;
  const variantId = data?.first_subscription_item?.variant_id?.toString();
  const plan = PLAN_MAP[variantId] || 'starter';

  if (!email) return { statusCode: 200, body: 'No email' };

  if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
    await updateUserPlan(email, plan, 'active');
  }

  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    await updateUserPlan(email, plan, 'cancelled');
  }

  if (eventName === 'subscription_resumed') {
    await updateUserPlan(email, plan, 'active');
  }

  return { statusCode: 200, body: 'OK' };
};

async function updateUserPlan(email, plan, status) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ plan, subscription_status: status })
  });
  return res;
}
