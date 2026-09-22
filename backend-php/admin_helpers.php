<?php
// Shared validation for both create and edit; frontend checks are not security checks.
function validate_admin_fields(array &$b, bool $barber): void {
    foreach (['name', 'email', 'phone', 'specialty', 'bio', 'description'] as $key) {
        if (array_key_exists($key, $b)) {
            if (!is_string($b[$key])) error_out('Invalid ' . $key . '.');
            $b[$key] = trim($b[$key]);
        }
    }
    $limits = $barber ? ['name' => 120, 'email' => 160, 'phone' => 30, 'specialty' => 160] : ['name' => 120, 'description' => 255];
    foreach ($limits as $key => $max) {
        if (isset($b[$key]) && mb_strlen($b[$key], 'UTF-8') > $max) error_out(ucfirst($key) . ' is too long.');
    }
    if (isset($b['name']) && $b['name'] === '') error_out('Name is required.');
    if ($barber && isset($b['email'])) {
        $b['email'] = strtolower($b['email']);
        if (!filter_var($b['email'], FILTER_VALIDATE_EMAIL)) error_out('Enter a valid email address.');
    }
    if ($barber && isset($b['password']) && (!is_string($b['password']) || strlen(trim($b['password'])) < 6 || strlen($b['password']) > 72)) error_out('Password must be at least 6 characters and at most 72 bytes.');
    if ($barber && !empty($b['phone'])) {
        $digits = preg_replace('/\D/', '', $b['phone']);
        if (!preg_match('/^\+?[\d\s()-]+$/', $b['phone']) || strlen($digits) < 7 || strlen($digits) > 15) error_out('Enter a valid phone number with 7–15 digits.');
    }
    if (!$barber && array_key_exists('price', $b) && (!is_scalar($b['price']) || !preg_match('/^\d+(\.\d{1,2})?$/', (string)$b['price']) || (float)$b['price'] <= 0 || (float)$b['price'] > 999999.99)) error_out('Enter a price above zero with at most two decimal places.');
    if (!$barber && array_key_exists('duration_minutes', $b) && (filter_var($b['duration_minutes'], FILTER_VALIDATE_INT) === false || (int)$b['duration_minutes'] < 1 || (float)$b['duration_minutes'] > 2147483647)) error_out('Duration must be a positive whole number.');
    if (array_key_exists('is_active', $b) && !in_array($b['is_active'], [0, 1, '0', '1'], true)) error_out('Invalid active status.');
}

function delete_admin_record(PDO $pdo, int $id, bool $barber): void {
    // Restrict deletion to unused records. Never cascade-delete appointment history.
    $table = $barber ? 'users' : 'services';
    $where = $barber ? "id = ? AND role = 'barber'" : 'id = ?';
    $reference = $barber ? '(barber_id = ? OR customer_id = ?)' : 'service_id = ?';
    $pdo->beginTransaction();
    try {
        $record = $pdo->prepare("SELECT id FROM $table WHERE $where FOR UPDATE");
        $record->execute([$id]);
        if (!$record->fetch()) {
            $pdo->rollBack();
            error_out('Record not found. Refresh the list.', 404);
        }
        $linked = $pdo->prepare("SELECT id FROM appointments WHERE $reference LIMIT 1");
        $linked->execute($barber ? [$id, $id] : [$id]);
        if ($linked->fetch()) {
            $pdo->rollBack();
            error_out('This record has linked appointments and cannot be permanently deleted. Use Deactivate to hide it from new bookings while keeping appointment history.', 409);
        }
        if ($barber) $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$id]);
        $pdo->prepare("DELETE FROM $table WHERE $where")->execute([$id]);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_out('Unable to delete this record. It may have linked records; refresh and use Deactivate instead.', 409);
    }
    send_json(['ok' => true]);
}
