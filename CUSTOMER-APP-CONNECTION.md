# Customer app → database → admin and selected barber

The staff web app reads actual bookings from the existing PHP API. There are no sample bookings included in this update. Admin → Appointments shows all customer bookings, totals, a barber selector, status/date filters and booking details. Barber → My Appointments shows only bookings assigned to the logged-in barber, with Customer Bookings, Today, Pending and Completed counts.

Both appointment pages refresh every 15 seconds while visible, when returning to the page and after status changes. This is polling, not instant push notifications. Use Refresh for an immediate check. My Schedule retains its existing selected-day refresh behaviour. Today uses Malaysia time.

## Install this frontend update

Use the full frontend ZIP, or copy every file from the small update ZIP into your existing `web-react` folder, preserving paths:

- `src/api.js`
- `src/pages/useLiveAppointments.js` (new)
- `src/pages/admin/AdminAppointments.jsx`
- `src/pages/barber/BarberAppointments.jsx`

Run `npm install` if using the full frontend, then `npm run dev`. Rebuild production with `npm run build`. Keep the previously installed PHP scheduling/profile/products backend and its migrations. This update requires no new SQL migration or backend replacement.

## Required customer app connection

The Android/customer app source has not been supplied, so its API address or request code could not be edited or verified. Give the following contract to the customer-app developer. All clients must call the SAME PHP backend, which connects to the SAME `jat_barbershop` database through `config.php`.

Use a reachable API base, for example `https://YOUR-SERVER/backend-php/api`. On a physical phone, `localhost` means that phone, not your laptop. For local network testing, the laptop's address is required; for deployment use HTTPS. Configure the staff frontend's `VITE_API_BASE` to the same backend and restart/rebuild it after changes.

1. Log in the customer using `POST /login.php` with JSON email and password. Keep the returned customer token securely.
2. Load `/barbers.php` and `/services.php`. Use the returned database IDs for selections, never a list position or a barber name.
3. Request `/availability.php?barber_id=2&service_id=1&date=YYYY-MM-DD` to obtain free slots for that barber/service/date. Substitute real IDs and a future date.
4. Submit the booking below. Treat it as successful only after receiving HTTP 201 with its booking ID. Do not save it only in Android SQLite or a separate Firebase database and expect the staff web app to see it.

```http
POST /backend-php/api/appointments.php
Authorization: Bearer CUSTOMER_LOGIN_TOKEN
Content-Type: application/json
```

```json
{
  "barber_id": 2,
  "service_id": 1,
  "date": "2026-10-01",
  "time": "10:00",
  "notes": "Please keep the sides short."
}
```

The date, time and IDs above are examples: choose an actual available future slot. The server derives `customer_id` from the authenticated customer, validates availability/duration/overlaps and saves a pending appointment with the selected `barber_id`. JSON response on success: `{"id":123}` (actual ID differs). A failed validation returns a non-2xx response with an `error` message; display that message instead of confirming the booking.

## Reading and updating bookings

- Admin login token + `GET /appointments.php`: all bookings. The admin may filter a barber or view details. The dropdown includes only barbers with booking records, including historical bookings.
- Barber login token + `GET /appointments.php`: only that barber's assigned bookings. Sending another barber's ID does not grant access. The barber must sign in to their own account.
- Customer login token + `GET /appointments.php`: only that customer's bookings. The customer app must refresh this endpoint to display status changes made by staff.
- `GET /appointments.php?id=123` returns `{"appointment": {...}}` only when authorized.
- Staff status updates use `PUT /appointments.php?id=123` with `{"status":"confirmed"}`, then `in_progress`, then `completed`. Completing also requires `completion_notes`. The customer sees the updated state on their next fetch.

No separate database synchronization or copying of appointments is required: the same record is shared through authorized API requests. Never put MySQL root credentials inside the phone app.

## Verify your actual installation

Create a booking through the customer app for barber A at a valid future time. In phpMyAdmin, check that the new `appointments` row has the expected `customer_id`, `barber_id`, service, date/time and `pending` status. Within 15 seconds on visible pages it should appear for admin and barber A. Sign in as barber B: it should not appear there. Confirm it as barber A, then refresh the customer app to see `confirmed`.

If there is no database row, inspect the customer app's API URL, login token, request JSON and server response. If a row exists but the staff page is empty, verify that both clients use the same backend/database and the barber account ID matches the booking's `barber_id`. Old dates will not appear in a selected-day schedule; use All dates in the appointments page.

## Verification performed

Production build passed. Ten database-backed PHP checks verified customer creation → admin visibility → selected-barber visibility, rejection for another barber, customer identity from login, and a status change visible to the customer. These ran in isolated PHP with a SQLite adapter, not your live MySQL or Android app. Browser checks with test responses verified totals, barber/status/date filters, a newly arriving booking appearing after the polling interval, booking details and mobile width.
