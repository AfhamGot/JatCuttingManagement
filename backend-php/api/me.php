<?php
require_once __DIR__ . '/../bootstrap.php';

$user = require_auth();
send_json(['user' => public_user($user)]);
