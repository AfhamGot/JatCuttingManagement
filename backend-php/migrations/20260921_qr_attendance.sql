-- Run after the schedule migration, in the existing jat_barbershop database.
CREATE TABLE IF NOT EXISTS attendance_qr_tokens (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 shop_id VARCHAR(64) NOT NULL,
 issued_by INT NOT NULL,
 expires_at BIGINT NOT NULL,
 INDEX ix_qr_expiry (expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance_qr_uses (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 barber_id INT NOT NULL,
 action VARCHAR(16) NOT NULL,
 used_at DATETIME NOT NULL,
 PRIMARY KEY (token_hash, barber_id),
 FOREIGN KEY (token_hash) REFERENCES attendance_qr_tokens(token_hash) ON DELETE CASCADE
) ENGINE=InnoDB;
