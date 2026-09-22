<?php
require_once __DIR__ . '/schedule_helpers.php';
// One shop per installation. Set ATTENDANCE_SHOP_ID in config.php for another shop.
function qr_shop(): string { return defined('ATTENDANCE_SHOP_ID') ? (string)ATTENDANCE_SHOP_ID : 'jat-main'; }
function qr_now(): int { return strtotime(schedule_now()); }
function qr_schema(PDO $pdo): void {
    try { $pdo->query('SELECT token_hash FROM attendance_qr_tokens LIMIT 0'); $pdo->query('SELECT token_hash FROM attendance_qr_uses LIMIT 0'); }
    catch (PDOException $e) { error_log($e->getMessage()); error_out('Import migrations/20260921_qr_attendance.sql into your existing database first.',503); }
}
// Call inside the attendance transaction after locking the barber row.
// The unique use is rolled back if any attendance business rule fails.
function qr_consume(PDO $pdo, int $barber, string $action, $token): void {
    if (!is_string($token) || !preg_match('/^JATQR1\.[a-f0-9]{64}$/D',$token)) throw new InvalidArgumentException('Scan the current QR code on the shop display.');
    $hash=hash('sha256',$token);
    $q=$pdo->prepare('SELECT shop_id,expires_at FROM attendance_qr_tokens WHERE token_hash=? FOR UPDATE');
    $q->execute([$hash]); $row=$q->fetch();
    if (!$row || !hash_equals(qr_shop(),$row['shop_id']) || (int)$row['expires_at']<=qr_now()) throw new DomainException('QR code is invalid or expired. Scan the current shop code again.');
    $q=$pdo->prepare('SELECT barber_id FROM attendance_qr_uses WHERE token_hash=? AND barber_id=?'); $q->execute([$hash,$barber]);
    if ($q->fetch()) throw new DomainException('You already used this QR code. Wait for the next code before another attendance action.');
    $pdo->prepare('INSERT INTO attendance_qr_uses (token_hash,barber_id,action,used_at) VALUES (?,?,?,?)')->execute([$hash,$barber,$action,schedule_now()]);
}
