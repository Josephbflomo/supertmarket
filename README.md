# AllDayDash

A customer-facing grocery website with a private shop backend, built with React, Express, and MongoDB.

## Requirements

- Node.js 20 or newer and npm
- MongoDB (local instance or hosted URI)

## Setup

1. Copy `backend/.env.example` to `backend/.env`. Set a long random `JWT_SECRET`, your admin name/email/password, and the mobile-money number customers should pay. The example connects to local MongoDB; set `MONGODB_URI` to your hosted MongoDB connection URI when deploying. If you have no MongoDB service installed, leaving it blank starts a disk-backed local database.
2. Optionally copy `frontend/.env.example` to `frontend/.env` to set the API URL or USD/LRD display rate.
3. Install dependencies from the project root:

   ```sh
   npm install
   ```

4. Start the website and API:

   ```sh
   npm run dev
   ```

   The customer website runs at `http://localhost:5173`. The API listens on port 5000.

5. Create your private administrator account:

   ```sh
   npm run seed:admin --workspace backend
   ```

6. Open `http://localhost:5173/admin` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## How it works

- Customers browse goods, leave a star rating, add items to a basket, and order without creating an account.
- Customers provide their name, phone number, and delivery address at checkout. Their order is saved and reduces available stock.
- Checkout shows the configured `MOBILE_MONEY_NUMBER`. Customers can confirm they have sent payment.
- The private admin page lets the administrator post goods and photos, set an optional regular price to advertise a sale, see the order inbox, accept or cancel orders, and mark accepted orders complete. It checks for new orders every 15 seconds while open.
- Admin tools include login email and password changes, searchable customer/order history, and monthly sales summaries.
- The admin login is the only login; there is no customer or vendor product-posting interface.
- Product images must be JPG, PNG, or WebP and no larger than 5 MB.
- USD/LRD display conversion uses the fixed configurable rate in `frontend/src/config.js`; it is not a live exchange rate.

Mobile-money payment is confirmed manually; the website does not contact a mobile-money provider or verify transfers automatically. Local database files are stored under `backend/data`. Protect the administrator credentials and use HTTPS, a production database, and a strong JWT secret before deploying publicly.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Set `CLIENT_ORIGIN` to the website origin if it differs from `http://localhost:5173`.
