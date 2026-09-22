<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../admin_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'GET') {
    // Public: customer app browses active barbers to book with.
    $showAll = isset($_GET['all']);
    if ($showAll) {
        require_auth(['admin']);
        $rows = $pdo->query("SELECT id, name, email, phone, specialty, bio, is_active FROM users WHERE role = 'barber' ORDER BY name")->fetchAll();
    } else {
        $rows = $pdo->query("SELECT id, name, specialty, bio FROM users WHERE role = 'barber' AND is_active = 1 ORDER BY name")->fetchAll();
    }
    send_json(['barbers' => $rows]);
}

if ($method === 'POST') {
    // Admin creates a new barber account.
    require_auth(['admin']);
    $b = json_input();
    validate_admin_fields($b, true);
    $name = trim($b['name'] ?? '');
    $email = trim(strtolower($b['email'] ?? ''));
    $password = (string)($b['password'] ?? '');
    if ($name === '' || $email === '' || strlen($password) < 6) {
        error_out('Name, email, and a password of at least 6 characters are required.');
    }

    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) error_out('An account with that email already exists.', 409);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (name, email, phone, password_hash, role, specialty, bio) VALUES (?, ?, ?, ?, "barber", ?, ?)');
    $stmt->execute([$name, $email, $b['phone'] ?? null, $hash, $b['specialty'] ?? null, $b['bio'] ?? null]);
    send_json(['id' => (int)$pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    // Admin edits any barber; a barber may edit their own profile (not role/email).
    $me = require_auth(['admin', 'barber']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_out('Missing ?id=');
    if ($me['role'] === 'barber' && (int)$me['id'] !== $id) {
        error_out('Barbers can only edit their own profile.', 403);
    }

    $b = json_input();
    validate_admin_fields($b, true);
    $target = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'barber'");
    $target->execute([$id]);
    if (!$target->fetch()) error_out('Barber not found.', 404);
    if ($me['role'] === 'admin' && isset($b['email'])) {
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
        $exists->execute([$b['email'], $id]);
        if ($exists->fetch()) error_out('An account with that email already exists.', 409);
    }
    $allowed = $me['role'] === 'admin'
        ? ['name', 'email', 'phone', 'specialty', 'bio', 'is_active']
        : ['phone', 'specialty', 'bio'];

    $fields = [];
    $params = [];
    if ($me['role'] === 'admin' && isset($b['password'])) {
        $fields[] = 'password_hash = ?';
        $params[] = password_hash($b['password'], PASSWORD_BCRYPT);
    }
    foreach ($allowed as $f) {
        if (array_key_exists($f, $b)) {
            $fields[] = "$f = ?";
            $params[] = $b[$f];
        }
    }
    if (!$fields) error_out('Nothing to update.');
    $params[] = $id;
    try {
        $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . " WHERE id = ? AND role = 'barber'")->execute($params);
    } catch (PDOException $e) {
        error_out('Unable to save barber. The email may already be in use.', 409);
    }
    send_json(['ok' => true]);
}

if ($method === 'DELETE') {
    require_auth(['admin']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_out('Missing ?id=');
    delete_admin_record($pdo, $id, true);
}

error_out('Method not allowed', 405);
