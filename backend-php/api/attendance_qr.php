<?php
require_once __DIR__ . '/../qr_helpers.php';
header('Cache-Control: no-store, private');
$me=require_auth(['admin']);
if ($_SERVER['REQUEST_METHOD']!=='POST') error_out('Use POST.',405);
if (!(int)$me['is_active']) error_out('Account inactive.',403);
$pdo=db(); qr_schema($pdo);
$token='JATQR1.'.bin2hex(random_bytes(32)); $now=qr_now();
$pdo->prepare('INSERT INTO attendance_qr_tokens (token_hash,shop_id,issued_by,expires_at) VALUES (?,?,?,?)')->execute([hash('sha256',$token),qr_shop(),$me['id'],$now+90]);
// Short-lived challenges are not the attendance audit. Retain them for one day.
$pdo->prepare('DELETE FROM attendance_qr_tokens WHERE expires_at<?')->execute([$now-86400]);
send_json(['token'=>$token,'shop_id'=>qr_shop(),'server_now'=>$now,'expires_at'=>$now+90,'refresh_after'=>75]);
