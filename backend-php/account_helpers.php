<?php
require_once __DIR__.'/bootstrap.php';
header('Cache-Control: no-store, private');
set_exception_handler(function(Throwable $e) {
    error_log('Accounts: '.$e->getMessage());
    if ($e instanceof InvalidArgumentException) error_out($e->getMessage(),422);
    if ($e instanceof DomainException) error_out($e->getMessage(),409);
    if ($e instanceof PDOException && $e->getCode()==='23000') error_out('That email or record already exists.',409);
    error_out('Could not save or load data. Import the account/products migration and check the PHP error log.',500);
});
function account_staff(array $roles=['admin','barber']): array { $u=require_auth($roles); if (!(int)$u['is_active']) error_out('Account inactive.',403); return $u; }
function account_text(array $b,string $key,int $max,bool $required=false): string {
    $v=$b[$key]??''; if (!is_string($v)) throw new InvalidArgumentException('Invalid '.$key.'.'); $v=trim($v);
    if (($required && $v==='') || strlen($v)>$max) throw new InvalidArgumentException($key.' is required or exceeds '.$max.' bytes.'); return $v;
}
function account_fields(array $b): array {
    $name=account_text($b,'name',120,true); $email=strtolower(account_text($b,'email',160,true));
    if (!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Enter a valid email address.');
    $phone=account_text($b,'phone',30);
    if ($phone!=='' && (!preg_match('/^\+?[0-9 ()-]+$/D',$phone) || strlen(preg_replace('/\D/','',$phone))<7 || strlen(preg_replace('/\D/','',$phone))>15)) throw new InvalidArgumentException('Phone must contain 7–15 digits.');
    return [$name,$email,$phone];
}
function account_password(array $b): string {
    $p=$b['password']??''; if (!is_string($p) || strlen(trim($p))<8 || strlen($p)>72) throw new InvalidArgumentException('Use a password of 8–72 bytes, not just spaces.');
    if ($p!==($b['password_confirmation']??null)) throw new InvalidArgumentException('Passwords do not match.'); return $p;
}
function account_photo($value): ?string {
    if ($value===null || $value==='') return null;
    if (!is_string($value) || strlen($value)>1400000 || !preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#D',$value,$m)) throw new InvalidArgumentException('Choose a JPG, PNG or WebP image, maximum 1 MB.');
    $bytes=base64_decode($m[2],true); $info=$bytes===false?false:@getimagesizefromstring($bytes);
    if (!$info || strlen($bytes)>1048576 || $info[0]>2048 || $info[1]>2048 || $info['mime']!=='image/'.$m[1]) throw new InvalidArgumentException('Use a valid JPG, PNG or WebP, maximum 1 MB and 2048 × 2048 pixels.');
    return $value;
}
function account_owner(PDO $pdo,int $id): bool { $q=$pdo->prepare('SELECT owner_id FROM shop_owner WHERE id=1 AND owner_id=?');$q->execute([$id]);return (bool)$q->fetch(); }
function account_public(PDO $pdo,array $u): array { return array_merge(public_user($u),['display_name'=>$u['display_name']??'','profile_photo'=>$u['profile_photo']??null,'is_owner'=>$u['role']==='admin' && account_owner($pdo,(int)$u['id'])]); }
function account_tx(PDO $pdo,callable $fn) { $pdo->beginTransaction();try{$r=$fn();$pdo->commit();return $r;}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;} }
function account_current_password(array $b,array $u): void { if (!is_string($b['current_password']??null) || !password_verify($b['current_password'],$u['password_hash'])) throw new InvalidArgumentException('Your current password is incorrect.'); }
