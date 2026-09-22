# Jat Barbershop — PHP + MySQL Backend

This is the shared backend used by both the **Admin/Barber React web app**
and the **Customer Android app**. Plain PHP (no framework) + PDO/MySQL,
with simple bearer-token authentication.

## Setup (XAMPP/WAMP/MAMP, or any Apache+PHP+MySQL host)

1. Copy this `backend-php` folder into your server's web root, e.g.
   `htdocs/jat-barbershop/`.
2. Create the database and import the schema:
   ```
   mysql -u root -p -e "CREATE DATABASE jat_barbershop"
   mysql -u root -p jat_barbershop < schema.sql
   ```
3. Edit `config.php` with your real DB host/user/password if they differ
   from the XAMPP defaults.
4. The seed accounts in `schema.sql` use placeholder password hashes.
   Run once to get real ones:
   ```
   php generate_seed_hashes.php
   ```
   Then update the three seeded rows with the printed hashes:
   ```sql
   UPDATE users SET password_hash = '<hash for admin123>' WHERE email = 'admin@jatbarbershop.com';
   UPDATE users SET password_hash = '<hash for barber123>' WHERE email = 'ali@jatbarbershop.com';
   UPDATE users SET password_hash = '<hash for barber123>' WHERE email = 'faiz@jatbarbershop.com';
   ```
5. Test it's alive: open `http://localhost/jat-barbershop/backend-php/api/services.php`
   in a browser — you should get a JSON list of services.

## Endpoints

| Method | Endpoint                    | Who              | Purpose                              |
|--------|------------------------------|------------------|---------------------------------------|
| POST   | `/api/register.php`         | anyone           | Create a customer account, returns token |
| POST   | `/api/login.php`            | anyone           | Log in (admin, barber, or customer)  |
| POST   | `/api/logout.php`           | logged in        | Invalidate current token             |
| GET    | `/api/me.php`               | logged in        | Get your own profile                 |
| GET    | `/api/services.php`         | public           | List active services (`?all=1` admin sees all) |
| POST/PUT/DELETE | `/api/services.php` | admin            | Manage services                      |
| GET    | `/api/barbers.php`          | public           | List active barbers (`?all=1` admin sees all)  |
| POST/PUT/DELETE | `/api/barbers.php`  | admin (PUT also barber, own profile) | Manage barbers |
| GET    | `/api/appointments.php`     | logged in        | List — scoped to your own bookings (customer/barber) or all (admin, with `?status=&barber_id=&date=` filters) |
| GET    | `/api/appointments.php?id=` | logged in, owner | Get one appointment                  |
| POST   | `/api/appointments.php`     | customer         | Book an appointment                  |
| PUT    | `/api/appointments.php?id=` | barber/admin, or customer cancelling | Update status |

All authenticated requests need header: `Authorization: Bearer <token>`
(the `token` returned by login/register).

## Notes

- Passwords are hashed with `password_hash()`/`password_verify()` (bcrypt).
- Tokens live in `auth_tokens` and expire after `TOKEN_TTL_HOURS` (config.php).
- Deleting a service/barber is a soft-delete (`is_active = 0`) so past
  appointments referencing them still display correctly.
- For production: move this behind HTTPS, and consider rate-limiting
  `login.php`/`register.php`.
