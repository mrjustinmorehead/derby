// netlify/functions/debug-blobs.js
exports.handler = async () => {
  const result = { runtime: "node-func", blobs: { created: false, error: null } };
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('derby-squares');           // <-- your store name
    await store.set('probe', JSON.stringify({ ts: Date.now() })); // first write creates the store
    const value = await store.get('probe', { type: 'json' });
    result.blobs.created = !!(value && value.ts);
  } catch (e) {
    result.blobs.error = String(e && e.message || e);
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result, null, 2),
  };
};
