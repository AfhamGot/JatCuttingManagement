<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_out('Use POST', 405);
}

$body = json_input();
$name = trim($body['name'] ?? '');
$email = trim(strtolower($body['email'] ?? ''));
$phone = trim($body['phone'] ?? '');
$password = (string)($body['password'] ?? '');

if ($name === '' || $email === '' || strlen($password) < 6) {
    error_out('Name, a valid email, and a password of at least 6 characters are required.');
}

$pdo = db();
$exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetch()) {
    error_out('An account with that email already exists.', 409);
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, "customer")');
$stmt->execute([$name, $email, $phone, $hash]);
$userId = (int)$pdo->lastInsertId();

// Log the new customer straight in, same as login.php does.
$token = bin2hex(random_bytes(32));
$pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' . TOKEN_TTL_HOURS . ' HOUR))')
    ->execute([$userId, $token]);

$userRow = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$userRow->execute([$userId]);

send_json([
    'token' => $token,
    'user' => public_user($userRow->fetch()),
], 201);
