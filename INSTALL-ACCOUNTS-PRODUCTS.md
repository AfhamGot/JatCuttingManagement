# Jat Barbershop: profiles, booking-only barber schedule and products

This update preserves the brown/cream theme and grouped sidebars. Install both the frontend and backend update; new database fields/tables are required.

## Features

Barber: edit name, email, password, phone, specialty, bio and an optional profile picture. My Schedule shows the selected date's bookings and management actions only. Attendance, QR scanning, hours management and Reports tabs are removed from the barber screen. Booking confirmation, start, completion with notes, cancellation and rescheduling remain, with the existing backend availability/conflict checks. Admin still manages available hours and retains the earlier attendance/history pages; no historical attendance data is deleted.

Admin: edit name, display name, email, password, phone and profile picture through My Profile. The sidebar uses display name when provided, otherwise name. Manage Admins appears only for the original owner and registers additional admins with validation and the owner's current password. Products lets admins create/edit products, set selling price and stock, write descriptions, remove/restore items from sale and permanently delete with confirmation.

## Install

1. Back up your database and existing project folders.
2. Start Apache and MySQL. In phpMyAdmin, select the existing `jat_barbershop` database and import `backend-php/migrations/20260922_accounts_products.sql`. Do not import `schema.sql` or recreate your database. This migration can be rerun without changing an existing owner assignment.
3. Merge the backend ZIP's `backend-php` contents into `C:\xampp\htdocs\backend-php`. Keep your current `config.php`, `bootstrap.php`, login, barber and service APIs. The package includes earlier scheduling/QR patch files for continuity. Avoid a nested `backend-php\backend-php` folder.
4. Replace the frontend with the supplied full frontend. In `web-react`, run `npm install`, then `npm run dev`. For production, run `npm run build` and deploy the new `dist`.
5. Sign out and in again, then verify the owner as below. The original schedule/QR migrations are prerequisites only if you have not already installed those earlier modules.

## Original owner permission

On its first run, the migration selects the existing admin with the lowest user ID as the original owner. It stores the owner in the separate `shop_owner` table. Newly registered admins never become owners automatically. Neither changing profile fields nor sending `role` or `is_owner` from the browser grants permission. The backend checks ownership on every admin-registration request; hiding the link is not the permission boundary.

Verify the selected owner in phpMyAdmin's SQL tab:

```sql
SELECT u.id, u.name, u.email
FROM shop_owner o JOIN users u ON u.id = o.owner_id
WHERE o.id = 1;
```

This should show the intended original admin. If your database's earliest admin is not the actual owner, correct the `owner_id` through phpMyAdmin before using Manage Admins, choosing the ID of your intended existing active admin. Do not grant this database access to ordinary staff. If no admin existed when the migration ran, no owner is selected; first establish your intended admin account through your existing setup process and rerun the migration.

New admins can manage the shop but cannot list/register admin accounts through this feature. The owner confirms registration with their current password. Each registration is recorded in `admin_registration_audit`. This feature does not add owner transfer, admin deletion or password recovery workflows.

## Profile rules

- Email must be valid and unique across admin, barber and customer accounts. Changing email or password requires the current password.
- New passwords require confirmation and must contain at least 8 non-surrounding-space characters for the browser check, with a server limit of 8–72 bytes. Existing passwords are unchanged until deliberately replaced.
- A password change signs out other sessions, while retaining the current authenticated session. Use the new email/password at your next login.
- Photos are optional JPG, PNG or WebP; maximum 1 MB and 2048 × 2048 pixels. SVG and invalid image contents are rejected. The image is stored as a validated data URI in the database, so no upload-directory permissions are needed. Removing a photo takes effect after Save changes.
- Profile photos are displayed in the staff profile/sidebar. This update does not change the customer app's public barber cards.
- Server field limits are measured in bytes; non-ASCII text can reach these limits sooner than the browser character limits.

## Products

Reference buttons prefill only names/brands for Kahf Pomade and Gatsby Moving Rubber Spiky Edge. Enter the actual variant, description, selling price and stock your shop carries. No sample stock, product rows, manufacturer photos or prices are inserted automatically.

- Price: RM 0.01–999,999.99, up to two decimal places.
- Stock: whole number from 0 to 1,000,000. Zero stock shows Out of stock.
- Remove from sale retains the record and stock; Restore to sale reverses it.
- Delete permanently removes the product after confirmation.
- Editing an outdated version returns a conflict. Refresh and reopen the product before retrying, so another admin's stock change is not overwritten.
- This is admin inventory/catalogue management for products sold in the shop. Stock is adjusted manually through Edit; there is no checkout, online ordering, payment processing or automatic deduction from sales in this update.

Brand references: https://www.kahfeveryday.com/en/shop/ and https://www.gatsbyglobal.com/usa/product/moving-rubber/ . Product names are references, not an endorsement or a price feed.

## Changed files

New backend files, relative to `C:\xampp\htdocs\backend-php`:

- `account_helpers.php`
- `api/profile.php`
- `api/admins.php`
- `api/products.php`
- `migrations/20260922_accounts_products.sql`

Frontend files, relative to `web-react`:

- New: `src/pages/Profile.jsx`, `src/pages/accounts.css`, `src/pages/admin/AdminAccounts.jsx`, `src/pages/admin/AdminProducts.jsx`.
- Replace: `src/App.jsx`, `src/api.js`, `src/AuthContext.jsx`, `src/components/Layout.jsx`, `src/pages/ScheduleWorkspace.jsx`, `src/pages/barber/BarberAppointments.jsx`.
- The old `src/pages/barber/BarberProfile.jsx` is no longer used; it may be deleted. Keep the existing shared components and styles from the full ZIP.

Use this document instead of older handoffs for current barber-screen behaviour.

## Verification

The frontend production build and 18 existing calculation/validation tests passed. Forty-two isolated PHP 8.3 API checks passed for profiles, owner restrictions, invalid data, image formats, session invalidation and product stock/version conflicts. Browser checks with test API responses passed for profile saving/sidebar refresh, owner-only navigation, admin registration, product creation/removal/deletion, booking-only barber schedule and mobile width.

PHP API checks used a SQLite dialect adapter. Actual MySQL migration execution, concurrent InnoDB locking and your XAMPP connection must still be checked locally. Test owner/non-owner access, photo upload, new credentials and product stock in a test database before using real shop records.
