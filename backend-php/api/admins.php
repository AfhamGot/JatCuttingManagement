<?php
require_once __DIR__.'/../account_helpers.php';
$me=account_staff(['admin']);$pdo=db();
if(!account_owner($pdo,(int)$me['id']))error_out('Only the original owner can register or list admin accounts.',403);
$method=$_SERVER['REQUEST_METHOD'];
if($method==='GET')send_json(['admins'=>$pdo->query("SELECT id,name,display_name,email,phone,is_active FROM users WHERE role='admin' ORDER BY id")->fetchAll()]);
if($method!=='POST')error_out('Use GET or POST.',405);
$b=json_input();
$id=account_tx($pdo,function()use($pdo,$me,$b){
    $q=$pdo->query('SELECT owner_id FROM shop_owner WHERE id=1 FOR UPDATE');$owner=$q->fetch();
    if(!$owner || (int)$owner['owner_id']!==(int)$me['id'])throw new DomainException('Owner permission changed. Reload the page.');
    $q=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');$q->execute([$me['id']]);$u=$q->fetch();account_current_password($b,$u);
    [$name,$email,$phone]=account_fields($b);$display=account_text($b,'display_name',120);$password=account_password($b);
    $pdo->prepare("INSERT INTO users(name,email,phone,display_name,password_hash,role,is_active) VALUES(?,?,?,?,?,'admin',1)")->execute([$name,$email,$phone,$display,password_hash($password,PASSWORD_BCRYPT)]);
    $id=(int)$pdo->lastInsertId();
    $pdo->prepare('INSERT INTO admin_registration_audit(owner_id,admin_id,created_at) VALUES(?,?,CURRENT_TIMESTAMP)')->execute([$me['id'],$id]);return $id;
});send_json(['id'=>$id],201);
