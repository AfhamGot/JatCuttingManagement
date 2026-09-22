-- Jat Barbershop — shared database schema
-- Import this once into MySQL, e.g.:
--   mysql -u root -p -e "CREATE DATABASE jat_barbershop"
--   mysql -u root -p jat_barbershop < schema.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- users: admin, barber, and customer accounts all live here.
-- Barber-only fields (specialty, bio) are simply left NULL for other roles.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120)        NOT NULL,
    email         VARCHAR(160)        NOT NULL UNIQUE,
    phone         VARCHAR(30)         NULL,
    password_hash VARCHAR(255)        NOT NULL,
    role          ENUM('admin','barber','customer') NOT NULL,
    specialty     VARCHAR(160)        NULL,   -- barber only, e.g. "Fades, Beard Styling"
    bio           TEXT                NULL,   -- barber only
    is_active     TINYINT(1)          NOT NULL DEFAULT 1,
    created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- services: haircut, beard trim, hair colouring, etc. Managed by admin.
-- ---------------------------------------------------------------------------
CREATE TABLE services (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(120) NOT NULL,
    description      VARCHAR(255) NULL,
    price            DECIMAL(8,2) NOT NULL,
    duration_minutes INT          NOT NULL DEFAULT 30,
    is_active        TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- appointments: created by the customer app, managed by barber/admin web.
-- ---------------------------------------------------------------------------
CREATE TABLE appointments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    customer_id   INT NOT NULL,
    barber_id     INT NOT NULL,
    service_id    INT NOT NULL,
    appt_date     DATE NOT NULL,
    appt_time     VARCHAR(20) NOT NULL,  -- stored as display string e.g. "10:30 AM"
    status        ENUM('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
    notes         VARCHAR(255) NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_appt_customer FOREIGN KEY (customer_id) REFERENCES users(id),
    CONSTRAINT fk_appt_barber   FOREIGN KEY (barber_id)   REFERENCES users(id),
    CONSTRAINT fk_appt_service  FOREIGN KEY (service_id)  REFERENCES services(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- auth_tokens: simple bearer-token auth shared by the web app and the
-- Android customer app (no server-side sessions needed).
-- ---------------------------------------------------------------------------
CREATE TABLE auth_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Seed data — same accounts as the old AppDataStore.kt, plus two services.
-- Passwords below are the bcrypt hash of "admin123" / "barber123".
-- Generate your own with: php -r "echo password_hash('admin123', PASSWORD_BCRYPT);"
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, phone, password_hash, role, specialty) VALUES
('Shop Admin',     'admin@jatbarbershop.com', '010-0000000', '$2y$10$replace.with.real.hash.for.admin123........', 'admin',  NULL),
('Ali bin Kassim',  'ali@jatbarbershop.com',   '012-1111111', '$2y$10$replace.with.real.hash.for.barber123.......', 'barber', 'Fades, Beard Styling'),
('Faiz Rahman',     'faiz@jatbarbershop.com',  '013-2222222', '$2y$10$replace.with.real.hash.for.barber123.......', 'barber', 'Classic Cuts, Hair Colouring');

INSERT INTO services (name, description, price, duration_minutes) VALUES
('Haircut',                'Classic haircut, wash & style',      25.00, 30),
('Haircut + Beard Trim',   'Haircut with beard shaping',         40.00, 45),
('Hair Colouring',         'Full colour treatment',              60.00, 60),
('Kids Haircut',           'For customers 12 and under',         15.00, 20),
('Hair Spa + Haircut',     'Relaxing scalp spa plus haircut',    55.00, 60);

-- IMPORTANT: the placeholder password hashes above will NOT work as-is.
-- After creating the database, run generate_seed_hashes.php (included) once
-- to print real hashes, then UPDATE the three rows, e.g.:
--   UPDATE users SET password_hash = '<hash>' WHERE email = 'admin@jatbarbershop.com';
