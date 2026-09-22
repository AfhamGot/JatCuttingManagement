-- Select your existing jat_barbershop database before importing.
-- Additive and safe to re-run; never drops or resets existing data.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS barber_schedules (
 id INT AUTO_INCREMENT PRIMARY KEY,
 barber_id INT NOT NULL,
 work_date DATE NOT NULL,
 start_time TIME NOT NULL DEFAULT '10:00:00',
 end_time TIME NOT NULL DEFAULT '22:00:00',
 break_start TIME NULL,
 break_end TIME NULL,
 is_available TINYINT(1) NOT NULL DEFAULT 1,
 notes VARCHAR(255) NOT NULL DEFAULT '',
 updated_by INT NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uq_barber_day (barber_id, work_date),
 FOREIGN KEY (barber_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS barber_attendance (
 id INT AUTO_INCREMENT PRIMARY KEY,
 barber_id INT NOT NULL,
 work_date DATE NOT NULL,
 clock_in DATETIME NOT NULL,
 clock_out DATETIME NULL,
 closed_by INT NULL,
 close_reason VARCHAR(255) NULL,
 INDEX ix_attendance_day (barber_id, work_date),
 FOREIGN KEY (barber_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS barber_daily_reports (
 id INT AUTO_INCREMENT PRIMARY KEY,
 barber_id INT NOT NULL,
 work_date DATE NOT NULL,
 generated_at DATETIME NOT NULL,
 generated_by INT NULL,
 snapshot LONGTEXT NOT NULL,
 UNIQUE KEY uq_report_day (barber_id, work_date),
 FOREIGN KEY (barber_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS barber_schedule_audit (
 id INT AUTO_INCREMENT PRIMARY KEY,
 barber_id INT NOT NULL,
 actor_id INT NOT NULL,
 action VARCHAR(40) NOT NULL,
 details LONGTEXT NOT NULL,
 created_at DATETIME NOT NULL,
 INDEX ix_audit_barber (barber_id)
) ENGINE=InnoDB;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='completion_notes')=0, 'ALTER TABLE appointments ADD COLUMN completion_notes TEXT NULL', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='completed_at')=0, 'ALTER TABLE appointments ADD COLUMN completed_at DATETIME NULL', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='booked_price')=0, 'ALTER TABLE appointments ADD COLUMN booked_price DECIMAL(8,2) NULL', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='booked_duration')=0, 'ALTER TABLE appointments ADD COLUMN booked_duration INT NULL', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='booked_service')=0, 'ALTER TABLE appointments ADD COLUMN booked_service VARCHAR(120) NULL', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='appointments' AND COLUMN_NAME='legacy_price')=0, 'ALTER TABLE appointments ADD COLUMN legacy_price TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
-- Older prices cannot be reconstructed; preserve the current value and mark it as legacy.
UPDATE appointments a JOIN services s ON s.id=a.service_id
 SET a.booked_price=COALESCE(a.booked_price,s.price),
     a.booked_duration=COALESCE(a.booked_duration,s.duration_minutes),
     a.booked_service=COALESCE(a.booked_service,s.name)
 WHERE a.booked_price IS NULL OR a.booked_duration IS NULL OR a.booked_service IS NULL;
