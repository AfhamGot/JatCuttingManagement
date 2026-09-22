-- Select the existing jat_barbershop database. Back up before importing.
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='display_name')=0,'ALTER TABLE users ADD COLUMN display_name VARCHAR(120) NULL','SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='profile_photo')=0,'ALTER TABLE users ADD COLUMN profile_photo MEDIUMTEXT NULL','SELECT 1');
PREPARE migration FROM @ddl; EXECUTE migration; DEALLOCATE PREPARE migration;
CREATE TABLE IF NOT EXISTS shop_owner (
 id INT PRIMARY KEY, owner_id INT NOT NULL UNIQUE,
 FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB;
-- Earliest existing admin is the original owner; reruns preserve an existing owner.
INSERT INTO shop_owner(id,owner_id) SELECT 1,MIN(id) FROM users WHERE role='admin'
HAVING MIN(id) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shop_owner WHERE id=1);
CREATE TABLE IF NOT EXISTS admin_registration_audit (
 id INT AUTO_INCREMENT PRIMARY KEY,owner_id INT NOT NULL,admin_id INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS products (
 id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(120) NOT NULL,brand VARCHAR(80) NOT NULL,
 description TEXT NULL,price DECIMAL(8,2) NOT NULL,stock INT NOT NULL DEFAULT 0,
 is_active TINYINT(1) NOT NULL DEFAULT 1,version INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
