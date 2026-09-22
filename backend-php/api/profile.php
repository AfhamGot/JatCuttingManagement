<?php
require_once __DIR__.'/../account_helpers.php';
$me=account_staff();$pdo=db();$method=$_SERVER['REQUEST_METHOD'];
if($method==='GET')send_json(['user'=>account_public($pdo,$me)]);
if($method!=='PUT')error_out('Use GET or PUT.',405);
$b=json_input();
$result=account_tx($pdo,function()use($pdo,$me,$b){
    $q=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');$q->execute([$me['id']]);$u=$q->fetch();
    [$name,$email,$phone]=account_fields($b);
    $display=$u['role']==='admin'?account_text($b,'display_name',120):'';
    $specialty=$u['role']==='barber'?account_text($b,'specialty',160):($u['specialty']??null);
    $bio=$u['role']==='barber'?account_text($b,'bio',5000):($u['bio']??null);
    $password=$b['password']??'';
    if(!is_string($password))throw new InvalidArgumentException('Invalid password.');
    if($email!==strtolower($u['email']) || $password!=='')account_current_password($b,$u);
    $hash=$password!==''?password_hash(account_password($b),PASSWORD_BCRYPT):$u['password_hash'];
    $photo=array_key_exists('profile_photo',$b)?account_photo($b['profile_photo']):($u['profile_photo']??null);
    $pdo->prepare('UPDATE users SET name=?,email=?,phone=?,display_name=?,specialty=?,bio=?,password_hash=?,profile_photo=? WHERE id=?')->execute([$name,$email,$phone,$display,$specialty,$bio,$hash,$photo,$u['id']]);
    if($password!=='') {
        $headers=function_exists('getallheaders')?getallheaders():[];
        $auth=$headers['Authorization']??$headers['authorization']??($_SERVER['HTTP_AUTHORIZATION']??'');
        $token=trim(substr($auth,7));
        $pdo->prepare('DELETE FROM auth_tokens WHERE user_id=? AND token<>?')->execute([$u['id'],$token]);
    }
    $q->execute([$u['id']]);return ['user'=>account_public($pdo,$q->fetch())];
});send_json($result);
