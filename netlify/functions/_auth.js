// Minimal HS256 JWT (no external deps)
const crypto = require('crypto');

const COOKIE_NAME = 'derby_admin';
const MAX_AGE_SEC = 12 * 60 * 60; // 12h

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function b64urlJSON(obj) {
  return b64url(JSON.stringify(obj));
}

function sign(payload, secret, expiresInSec = MAX_AGE_SEC) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const content = b64urlJSON(header) + '.' + b64urlJSON(body);
  const sig = crypto.createHmac('sha256', secret).update(content).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return content + '.' + sig;
}

function verify(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const expected = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    if (expected !== s) return null;
    const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > -1) {
      const k = kv.slice(0, idx).trim();
      const v = kv.slice(idx+1).trim();
      out[k] = v;
    }
  });
  return out;
}

function adminFromEvent(event, allowHeaderKey = true) {
  const envKey = process.env.ADMIN_KEY;
  // Legacy: x-admin-key header
  if (allowHeaderKey && envKey && event.headers && event.headers['x-admin-key'] === envKey) {
    return { method: 'header', sub: 'legacy-admin' };
  }
  // Cookie JWT
  const secret = process.env.ADMIN_JWT_SECRET || envKey || 'change-me';
  const cookies = parseCookies(event.headers && (event.headers.cookie || event.headers.Cookie));
  const token = cookies && cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = verify(token, secret);
  return payload ? { method: 'jwt', ...payload } : null;
}

function adminCookie(token) {
  // httpOnly; secure in production
  const secure = 'Secure'; // Netlify is HTTPS
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${secure}; Max-Age=${MAX_AGE_SEC}`;
}
function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = { sign, verify, adminFromEvent, adminCookie, clearCookie, COOKIE_NAME };
