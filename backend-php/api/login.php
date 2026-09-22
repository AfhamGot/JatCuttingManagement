<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_out('Use POST', 405);
}

$body = json_input();
$email = trim(strtolower($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($email === '' || $password === '') {
    error_out('Email and password are required.');
}

$pdo = db();
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? AND is_active = 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    error_out('Invalid email or password.', 401);
}

$token = bin2hex(random_bytes(32));
$pdo->prepare('INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' . TOKEN_TTL_HOURS . ' HOUR))')
    ->execute([$user['id'], $token]);

send_json([
    'token' => $token,
    'user' => public_user($user),
]);
