# Jat Barbershop staff dashboard

Current release: read `../INSTALL-ACCOUNTS-PRODUCTS.md` first. This adds profiles, owner-only admin registration and products, and makes the barber schedule booking-only. Its instructions supersede the older QR handoff for the barber interface.

For this QR attendance release, start with `../QR-UPDATE-HANDOFF.md`. Phone scanning requires HTTPS and a reachable HTTPS API. Run `npm install` for the new QR dependencies.

Follow ../INSTALL-SCHEDULE-UPDATE.md first. This version requires the companion PHP patch and database migration.

Run npm install and npm run dev in this folder. The API defaults to http://localhost/backend-php/api. Override VITE_API_BASE in .env if needed, then restart Vite. Use your existing staff accounts.

Admin: dashboard, appointments, Schedule & Attendance, barber and service management.
Barber: appointments, My Schedule with availability/clock-in/out/reports, profile.

Run npm run build for production and node --test tests/*.test.js for calculation/validation checks. The development frontend can run outside XAMPP; PHP remains in htdocs/backend-php.
