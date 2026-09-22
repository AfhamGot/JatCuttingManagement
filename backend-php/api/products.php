<?php
require_once __DIR__.'/../account_helpers.php';
account_staff(['admin']);$pdo=db();$method=$_SERVER['REQUEST_METHOD'];
if($method==='GET')send_json(['products'=>$pdo->query('SELECT * FROM products ORDER BY name')->fetchAll()]);
if(!in_array($method,['POST','PUT','DELETE'],true))error_out('Method not allowed.',405);
$b=json_input();$id=(int)($_GET['id']??0);
$result=account_tx($pdo,function()use($pdo,$method,$b,$id){
    if($method!=='POST') { $q=$pdo->prepare('SELECT * FROM products WHERE id=? FOR UPDATE');$q->execute([$id]);$old=$q->fetch();if(!$old)throw new InvalidArgumentException('Product not found.');
        if((int)($b['version']??0)!==(int)$old['version'])throw new DomainException('This product changed in another session. Refresh before saving.');
    }
    if($method==='DELETE'){$pdo->prepare('DELETE FROM products WHERE id=?')->execute([$id]);return ['ok'=>true];}
    $name=account_text($b,'name',120,true);$brand=account_text($b,'brand',80,true);$desc=account_text($b,'description',2000);
    $price=$b['price']??'';$stock=$b['stock']??'';$active=$b['is_active']??1;
    if(!is_scalar($price)||!preg_match('/^\d+(\.\d{1,2})?$/D',(string)$price)||(float)$price<=0||(float)$price>999999.99)throw new InvalidArgumentException('Price must be RM 0.01–999,999.99, with up to 2 decimals.');
    if(!is_scalar($stock)||!preg_match('/^\d+$/D',(string)$stock)||(float)$stock>1000000)throw new InvalidArgumentException('Stock must be a whole number from 0 to 1,000,000.');
    if(!in_array($active,[0,1,'0','1'],true))throw new InvalidArgumentException('Choose a valid availability.');
    $args=[$name,$brand,$desc,$price,(int)$stock,(int)$active];
    if($method==='POST'){$pdo->prepare('INSERT INTO products(name,brand,description,price,stock,is_active) VALUES(?,?,?,?,?,?)')->execute($args);return ['id'=>(int)$pdo->lastInsertId()];}
    $args[]=$id;$pdo->prepare('UPDATE products SET name=?,brand=?,description=?,price=?,stock=?,is_active=?,version=version+1 WHERE id=?')->execute($args);return ['ok'=>true];
});send_json($result,$method==='POST'?201:200);
