# Morehead Derby Exacta Squares

Production-ready Netlify Functions app with Netlify Blobs persistence.

## Quick start
1. Set env vars in Netlify (Site settings → Environment):
   - `ADMIN_KEY` (admin login secret)
   - `ADMIN_JWT_SECRET` (optional, defaults to ADMIN_KEY)
   - `PRICE_PER_SQUARE` (default 5), `GRID_SIZE` (default 20), `HOLD_MINUTES` (default 10)
   - `PAYPAL_ENV` (`sandbox` or `live`)
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
2. In `public/index.html`, replace `YOUR_PAYPAL_CLIENT_ID` in the PayPal SDK URL.
3. Deploy and visit `/?admin=1` to log in.

## API
- `/api/list-squares`, `/api/lock-squares`, `/api/create-order`, `/api/capture-order`
- Admin endpoints: `/api/admin-login`, `/api/admin-logout`, `/api/admin-assign-horses`, `/api/admin-set-horses`, `/api/admin-adjust-horses`, `/api/admin-scratch`, `/api/admin-set-config`, `/api/admin-backup`, `/api/admin-restore`, `/api/admin-export`, `/api/admin-health`
- Webhook: `/api/paypal-webhook`

## Storage
Uses Netlify Blobs via `@netlify/blobs` in `kv-util.js`.
