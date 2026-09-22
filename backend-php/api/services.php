<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../admin_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

if ($method === 'GET') {
    // Public: anyone (customer app included) can browse active services.
    // Admin can pass ?all=1 to see inactive ones too.
    $showAll = isset($_GET['all']);
    if ($showAll) {
        require_auth(['admin']);
        $rows = $pdo->query('SELECT * FROM services ORDER BY id')->fetchAll();
    } else {
        $rows = $pdo->query('SELECT * FROM services WHERE is_active = 1 ORDER BY id')->fetchAll();
    }
    send_json(['services' => $rows]);
}

if ($method === 'POST') {
    require_auth(['admin']);
    $b = json_input();
    validate_admin_fields($b, false);
    $name = trim($b['name'] ?? '');
    $price = (float)($b['price'] ?? 0);
    if ($name === '' || $price <= 0) error_out('Name and a price greater than 0 are required.');

    $stmt = $pdo->prepare('INSERT INTO services (name, description, price, duration_minutes) VALUES (?, ?, ?, ?)');
    $stmt->execute([$name, $b['description'] ?? null, $price, (int)($b['duration_minutes'] ?? 30)]);
    send_json(['id' => (int)$pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    require_auth(['admin']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_out('Missing ?id=');
    $b = json_input();
    validate_admin_fields($b, false);
    $target = $pdo->prepare('SELECT id FROM services WHERE id = ?');
    $target->execute([$id]);
    if (!$target->fetch()) error_out('Service not found.', 404);

    $fields = [];
    $params = [];
    foreach (['name', 'description', 'price', 'duration_minutes', 'is_active'] as $f) {
        if (array_key_exists($f, $b)) {
            $fields[] = "$f = ?";
            $params[] = $b[$f];
        }
    }
    if (!$fields) error_out('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE services SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['ok' => true]);
}

if ($method === 'DELETE') {
    require_auth(['admin']);
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_out('Missing ?id=');
    delete_admin_record($pdo, $id, false);
}

error_out('Method not allowed', 405);
