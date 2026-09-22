<?php
// Run once from a terminal:  php generate_seed_hashes.php
// Copy the printed hashes into UPDATE statements for the seeded users
// (see the note at the bottom of schema.sql).

echo "admin123 => " . password_hash('admin123', PASSWORD_BCRYPT) . PHP_EOL;
echo "barber123 => " . password_hash('barber123', PASSWORD_BCRYPT) . PHP_EOL;
