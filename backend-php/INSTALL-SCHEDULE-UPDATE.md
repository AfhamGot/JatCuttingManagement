# Schedule and attendance update

**QR attendance update:** read `QR-UPDATE-HANDOFF.md` first. It lists the additional QR migration, replacement files and required phone HTTPS setup. Its scanning workflow supersedes the plain-button attendance instructions below.

Install BOTH the frontend and PHP patch, plus the database migration. This updates your existing working Jat Barbershop app and keeps its brown/cream colours. It is not a fresh database installer.

## 1. Back up

Copy your existing frontend and `C:\xampp\htdocs\backend-php`. In phpMyAdmin, select `jat_barbershop`, choose Export and save an SQL backup. Pause booking activity while installing.

## 2. Import the migration

Start Apache and MySQL in XAMPP. Open `http://localhost/phpmyadmin`, select your existing `jat_barbershop` database, click Import and choose `backend-php/migrations/20260921_schedule_attendance.sql` from the backend ZIP. Click Go and wait for success.

The migration creates schedule, attendance, report and audit tables and adds appointment completion/snapshot fields. It can be re-run. Do not import the old `schema.sql` or delete your database. This targets the supplied schema with integer `users.id` and existing `appointments` and `services` tables.

## 3. Copy the PHP patch

Merge the ZIP's `backend-php` folder into `C:\xampp\htdocs\backend-php`. Replace `api/appointments.php` when prompted. Your final paths must include:

- `C:\xampp\htdocs\backend-php\schedule_helpers.php`
- `C:\xampp\htdocs\backend-php\api\appointments.php`
- `C:\xampp\htdocs\backend-php\api\schedules.php`
- `C:\xampp\htdocs\backend-php\api\attendance.php`
- `C:\xampp\htdocs\backend-php\api\availability.php`

Keep your existing `config.php`, `bootstrap.php`, login, barber and service APIs. They are not replaced. Avoid an extra nested `backend-php\backend-php` folder. Restart Apache.

## 4. Run the frontend

Extract the frontend ZIP to your normal project folder; it need not be in `htdocs`. Open a terminal in `jat-barbershop-admin-barber-web/web-react` and run:

```sh
npm install
npm run dev
```

Open Vite's printed URL. The API defaults to `http://localhost/backend-php/api`. Override `VITE_API_BASE` in `web-react/.env` if your location differs, then restart Vite. Use your existing logins; no accounts or passwords change.

## Barber workflow

Open **My Schedule**, choose a date and **Manage hours**. Set availability within 10 AM–10 PM, one optional break, an off day and a staff note. Each edit changes only that date. Unconfigured days default to 10 AM–10 PM.

Use **Clock in / out** during today's available hours. Clock out for breaks and clock in again afterward; multiple sessions are supported. Breaks are not automatically subtracted from running sessions. Times come from the server in Asia/Kuala_Lumpur; keep the XAMPP computer's clock correct.

Confirm, start, complete, cancel or reschedule your bookings. Completing requires service notes. A rescheduled booking must fit its entire duration inside available hours, outside breaks and other bookings.

Once bookings are completed/cancelled and clock sessions closed, choose **Finish day**. The day locks and a saved report includes customers, services, booking statuses, completion notes, clock records, worked duration and completed booking value. View/export CSV in **Reports**. Choose earlier dates to review history.

## Admin workflow

Open **Schedule & Attendance** for all barbers or filter one. Manage each barber's daily hours, breaks, off days and bookings. The attendance tab shows clock-in/out records and total time for the selected date, including running sessions.

Use **Close missed clock-out** with a reason if needed. It records current server time, not a backdated estimate. Admins cannot clock in on someone's behalf. Sessions spanning midnight belong to their clock-in date and run until closed; close them promptly to avoid overstated hours.

## Important behaviour

- After scheduled closing, a ready report is generated on the next schedule load/refresh, clock-out or booking-status update. The open page refreshes every minute. No background job runs while the app is closed; **Finish day** explicitly finalizes a ready day earlier.
- Unresolved bookings or open clocks prevent finalization. Bookings are not automatically marked completed, and clocks do not stop automatically.
- Finished days are immutable and reject new bookings or edits. Resolve records before finishing.
- New bookings retain service name, price and duration. Older bookings capture service values at upgrade time because historical prices cannot be reconstructed; reports label legacy rows. Booking value is not proof of payment.
- Barbers access only their own records; admins access all. Schedule/clock/report actions are audited.
- Booking requests enforce availability. A customer app can request free slots with `GET /api/availability.php?barber_id=2&service_id=1&date=YYYY-MM-DD`. The Android app is not included; its old slot picker may show a slot now rejected by the backend.
- Retained scheduling/attendance history can prevent permanent barber deletion. Deactivate the barber to preserve their records.

## Check on XAMPP

1. Open the admin schedule page. If a migration error appears, verify the selected database and SQL import.
2. Set future hours/break for a barber. Sign in as that barber and confirm the same availability appears.
3. During available hours, clock in, refresh and clock out. Confirm admin sees matching records and duration.
4. With test bookings, confirm/start/complete with notes, clock out and finish the day. Inspect the saved report and CSV.
5. Verify overlapping and out-of-hours bookings are rejected. Use a test database for test scenarios.

## Verification

Production build and 18 frontend calculation/validation tests passed. Desktop/mobile browser checks passed for both roles using test API responses: schedule navigation, availability submission, clock eligibility and report empty states. Lint reported warnings but no errors.

An isolated PHP 8.3 runtime executed 43 API scenarios covering roles, availability, overlaps, attendance, completion and finalized-day rules. These used a SQLite dialect adapter, so MySQL migration execution and concurrent InnoDB locking still require validation on XAMPP.
