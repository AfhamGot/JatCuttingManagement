# Jat Barbershop — direct barber route and rotating QR attendance

## Issue 1 — completed before QR integration

Both `/admin/schedule` and `/barber/schedule` now render `ScheduleWorkspace` directly. The last supplied `BarberSchedule.jsx` already wrapped that component; it was not the old static page described in the request. Its import and file are now removed to eliminate ambiguity. Desktop/mobile workspace checks and existing role-scope API checks passed before QR work began.

Barbers see only their own schedule, bookings, attendance and finished reports. They cannot choose another barber or close another barber's clock session. The Attendance tab selects today and disables changing the date; historical sessions remain in dated daily reports. Admin retains the date/barber filters. Booking actions and completion notes remain unchanged.

## Issue 2 — QR attendance

Admin opens **Shop attendance QR** at `/admin/attendance-qr` on a supervised fixed shop tablet/PC. It displays an SVG QR and countdown. Barber opens **My Schedule → Attendance** on their own logged-in phone, selects **Scan to clock in/out**, permits the camera, scans the display, then confirms the action. The QR contains an opaque challenge, not a URL or login token; use the in-app scanner rather than the phone's generic camera app.

The backend requires BOTH the barber's login token and the current QR challenge for clock-in and clock-out. Missing, malformed, expired or previously used challenges fail. Existing available-hours, break, account, duplicate-session and report-lock rules remain. Clock-out is still allowed after closing time, because it must be possible to end a running session.

The admin's existing **Close missed clock-out** is a separate exception: no QR required, mandatory reason, current server time, and an audit record. Admins still cannot clock in for another person.

## Exact file handoff

Frontend paths are relative to your `web-react` folder. Backend paths are relative to `C:\xampp\htdocs\backend-php`.

| Action | File | Purpose |
| --- | --- | --- |
| Replace frontend | `src/App.jsx` | Direct barber workspace route and admin-only QR display route/link |
| Replace frontend | `src/api.js` | QR issue call; QR token in attendance POST |
| Replace frontend | `src/pages/ScheduleWorkspace.jsx` | Own attendance scanning flow and today selection |
| Replace frontend | `src/pages/schedule.css` | QR/scanner styles, hidden date strip |
| Create frontend | `src/pages/ShopQrDisplay.jsx` | Live rotating SVG QR display |
| Create frontend | `src/components/AttendanceScanner.jsx` | Camera scan, cleanup and explicit action confirmation |
| Replace frontend | `package.json`, `package-lock.json` | `qrcode` and `qr-scanner` dependencies |
| Delete frontend | `src/pages/barber/BarberSchedule.jsx` | Obsolete wrapper, no longer imported |
| Replace backend | `api/attendance.php` | Enforce QR for barber actions; preserve admin correction |
| Create backend | `api/attendance_qr.php` | Admin-only short-lived token issuer |
| Create backend | `qr_helpers.php` | Shop scope, server expiry and transactional replay checks |
| Create/import backend | `migrations/20260921_qr_attendance.sql` | QR challenge and use tables |

The frontend ZIP is the full updated frontend. The backend ZIP also contains the preceding schedule patch for convenience. If that patch is already installed, only the four QR backend files above differ. Preserve your existing `config.php`, `bootstrap.php`, login, barber and service APIs.

## Install in order

1. Back up the database and both project folders. Pause attendance use while updating.
2. In phpMyAdmin, select your existing `jat_barbershop` database. If the original schedule migration has not been applied, import `20260921_schedule_attendance.sql` first. Then import `migrations/20260921_qr_attendance.sql`. Do not import `schema.sql` or reset existing tables.
3. Merge the backend ZIP's `backend-php` contents into `C:\xampp\htdocs\backend-php`. Avoid `backend-php\backend-php` nesting. Restart Apache.
4. Replace the frontend using the ZIP or copy the exact files above and delete the obsolete wrapper. Run `npm install`, then `npm run dev`; stop/restart the old Vite process so you are opening the updated project.
5. On the shop PC, sign in as admin and open **Shop attendance QR**. On the phone, sign in as barber, open Attendance and scan. Never give the barber the admin login to display a QR on their own phone.

## HTTPS and phone setup — required

Camera scanning needs a secure browser context. `http://localhost` can work on the development PC, but `http://192.168.x.x:5173` on a phone is not a secure context. Use an HTTPS deployment or a local HTTPS setup whose certificate is trusted by the phone. Both the frontend and API must be reachable from the phone, and the API must also use HTTPS to avoid mixed-content blocking.

Set the frontend's `.env` before running/building:

```dotenv
VITE_API_BASE=https://YOUR-SERVER/backend-php/api
```

Replace `YOUR-SERVER` with your real HTTPS hostname. If frontend and PHP are served from the same HTTPS host, you may instead use `VITE_API_BASE=/backend-php/api`. Run `npm run build` again after changing a production API URL. The default `http://localhost/backend-php/api` is for the development PC only: on a phone, localhost means the phone itself. No HTTPS hostname, certificate or public hosting has been provisioned by this update.

## Token design / FYP explanation

The issuer creates 32 cryptographically random bytes (256 bits), prefixed with a format identifier. Only a SHA-256 hash is stored in the database. Each challenge belongs to this shop installation (`jat-main` by default), expires 90 seconds after issuance according to the PHP server clock, and cannot identify or authenticate a barber by itself. The authenticated session determines the barber identity.

The display requests a new token after 75 seconds. The 15-second overlap lets someone finish scanning the previous code during screen rotation, without allowing an unlimited grace period. Expiry is checked again on the server after obtaining the transaction lock; client time is never trusted. The screen removes a code when expired or refresh fails.

A token may be used by different barbers but only once by each barber, across both attendance actions. An immediate clock-in followed by clock-out requires the next rotating code. A unique database key and transactional validation prevent replays; failed business-rule checks roll back consumption. Expired challenges older than one day are cleaned up during issuance. Attendance history and audit records remain.

For separate shop installations sharing infrastructure, set `define('ATTENDANCE_SHOP_ID', 'your-shop-id');` in each installation's existing config. This app remains a single-shop system, not a multi-branch staff management system.

This demonstrates possession of an authenticated account and access to a recent shop code. It does **not** prove the physical person or location: a live photo/video can be relayed, credentials can be shared, and admins could display a code elsewhere. There is no device enrollment, geofence or anti-relay guarantee. Keep the admin station supervised. The short lifetime reduces the opportunity for sharing; it does not eliminate it.

Dependencies: [qr-scanner](https://www.npmjs.com/package/qr-scanner) for camera decoding and [qrcode](https://www.npmjs.com/package/qrcode) for SVG generation. These run locally in the browser; QR contents and camera frames are not sent to an external QR service.

## Verification and acceptance

- Production build and all 18 existing frontend tests passed; lint has warnings but no errors.
- 71 isolated PHP API requests passed, including existing scheduling rules plus issuer permissions, missing/invalid/expired QR rejection, exact expiry boundary, multi-barber use, replay rejection, failed-action rollback and admin correction rules.
- Browser checks passed for SVG rendering, 75-second rotation, decoding a QR through a synthetic camera video, confirmation submission, barber role isolation and mobile width.
- These PHP checks use PHP 8.3 with a SQLite SQL adapter. They do not verify the migration on MySQL or concurrent InnoDB locking. Camera decoding used synthetic video, not a physical phone.

On your XAMPP test database, verify migration success, two barbers scanning the same display, duplicate scans rejected, expiry rejected, break/out-of-hours clock-in rejected, and an actual phone camera over HTTPS. Confirm clock-out remains possible after closing and admin corrections still require a reason.

Reports, appointments and available-hour validation retain the previous module's behaviour. See `INSTALL-SCHEDULE-UPDATE.md` for those rules; this QR handoff supersedes its plain-button attendance instructions.
