<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_out('Use POST', 405);
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($authHeader && stripos($authHeader, 'Bearer ') === 0) {
    $token = trim(substr($authHeader, 7));
    db()->prepare('DELETE FROM auth_tokens WHERE token = ?')->execute([$token]);
}

send_json(['ok' => true]);
