<?php
require_once __DIR__ . '/config.php';

// ---- CORS (so the React web app and, if tested from a browser, the API
// itself can be called from a different origin) ---------------------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Database --------------------------------------------------------------
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

// ---- JSON helpers ------------------------------------------------------------
function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function send_json($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function error_out(string $message, int $status = 400): void {
    send_json(['error' => $message], $status);
}

// ---- Auth --------------------------------------------------------------------
/** Reads "Authorization: Bearer <token>" and returns the matching user row, or null. */
function current_user(): ?array {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (!$authHeader || stripos($authHeader, 'Bearer ') !== 0) {
        return null;
    }
    $token = trim(substr($authHeader, 7));
    if ($token === '') return null;

    $stmt = db()->prepare(
        'SELECT u.* FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    return $user ?: null;
}

/** Ends the request with 401 unless the caller is authenticated (and, if given, has one of $roles). */
function require_auth(array $roles = []): array {
    $user = current_user();
    if (!$user) {
        error_out('Not authenticated. Include "Authorization: Bearer <token>".', 401);
    }
    if (!empty($roles) && !in_array($user['role'], $roles, true)) {
        error_out('You do not have permission to do that.', 403);
    }
    return $user;
}

function public_user(array $user): array {
    return [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'role' => $user['role'],
        'specialty' => $user['specialty'],
        'bio' => $user['bio'],
    ];
}
