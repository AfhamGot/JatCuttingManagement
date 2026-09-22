<?php
require_once __DIR__ . '/../schedule_helpers.php';
$pdo=db(); $method=$_SERVER['REQUEST_METHOD'];
const SELECT_APPT = "SELECT a.*,COALESCE(a.booked_service,s.name) AS service_name,COALESCE(a.booked_price,s.price) AS service_price,COALESCE(a.booked_duration,s.duration_minutes) AS duration_minutes,b.name AS barber_name,c.name AS customer_name,c.phone AS customer_phone FROM appointments a JOIN services s ON s.id=a.service_id JOIN users b ON b.id=a.barber_id JOIN users c ON c.id=a.customer_id";
if ($method==='GET') {
    $me=require_auth(); $where=[]; $params=[];
    if ($me['role']==='customer') { $where[]='a.customer_id=?'; $params[]=$me['id']; }
    elseif ($me['role']==='barber') { $where[]='a.barber_id=?'; $params[]=$me['id']; }
    elseif ($me['role']!=='admin') error_out('Forbidden',403);
    if (!empty($_GET['id'])) { $where[]='a.id=?'; $params[]=(int)$_GET['id']; }
    if ($me['role']==='admin' && !empty($_GET['barber_id'])) { $where[]='a.barber_id=?'; $params[]=(int)$_GET['barber_id']; }
    if (!empty($_GET['date'])) { $where[]='a.appt_date=?'; $params[]=schedule_date($_GET['date']); }
    if (!empty($_GET['status'])) { $where[]='a.status=?'; $params[]=$_GET['status']; }
    $q=$pdo->prepare(SELECT_APPT.($where?' WHERE '.implode(' AND ',$where):'').' ORDER BY a.appt_date DESC,a.id DESC'); $q->execute($params);
    if (!empty($_GET['id'])) { $row=$q->fetch(); if (!$row) error_out('Appointment not found.',404); send_json(['appointment'=>$row]); }
    send_json(['appointments'=>$q->fetchAll()]);
}
if ($method==='POST') {
    $me=require_auth(['customer']); $b=json_input();
    $id=(int)($b['barber_id'] ?? 0); $date=schedule_date($b['date'] ?? ''); $start=schedule_minutes($b['time'] ?? '');
    $result=schedule_tx($pdo,function() use($pdo,$me,$b,$id,$date,$start) {
        schedule_barber($pdo,$id,true);
        $q=$pdo->prepare('SELECT * FROM services WHERE id=? AND is_active=1 FOR UPDATE'); $q->execute([(int)($b['service_id'] ?? 0)]); $s=$q->fetch();
        if (!$s) throw new InvalidArgumentException('Active service not found.');
        schedule_slot($pdo,$id,$date,$start,(int)$s['duration_minutes']);
        $notes=trim((string)($b['notes'] ?? '')); if (strlen($notes)>255) throw new InvalidArgumentException('Booking notes must be within 255 bytes.');
        $pdo->prepare('INSERT INTO appointments (customer_id,barber_id,service_id,appt_date,appt_time,notes,booked_price,booked_duration,booked_service,legacy_price) VALUES (?,?,?,?,?,?,?,?,?,0)')->execute([$me['id'],$id,$s['id'],$date,substr(schedule_time($start),0,5),$notes,$s['price'],$s['duration_minutes'],$s['name']]);
        return ['id'=>(int)$pdo->lastInsertId()];
    });
    send_json($result,201);
}
if ($method!=='PUT') error_out('Method not allowed',405);
$me=require_auth(['admin','barber','customer']); $b=json_input(); $id=(int)($_GET['id'] ?? 0);
$q=$pdo->prepare('SELECT * FROM appointments WHERE id=?'); $q->execute([$id]); $initial=$q->fetch();
if (!$initial) error_out('Appointment not found.',404);
if ($me['role']==='barber' && (int)$initial['barber_id']!==(int)$me['id']) error_out('You can only manage your own appointments.',403);
if ($me['role']==='customer' && (int)$initial['customer_id']!==(int)$me['id']) error_out('Forbidden',403);
$move=($b['action'] ?? '')==='reschedule';
if ($move && $me['role']==='customer') error_out('Only staff may reschedule appointments.',403);
$target=$move && $me['role']==='admin' ? (int)($b['barber_id'] ?? $initial['barber_id']) : (int)$initial['barber_id'];
$result=schedule_tx($pdo,function() use($pdo,$me,$b,$id,$initial,$target,$move) {
    $locks=array_unique([(int)$initial['barber_id'],$target]); sort($locks);
    foreach($locks as $barberId) schedule_barber($pdo,$barberId,true);
    $q=$pdo->prepare('SELECT * FROM appointments WHERE id=? FOR UPDATE'); $q->execute([$id]); $a=$q->fetch();
    if (!$a || (int)$a['barber_id']!==(int)$initial['barber_id']) throw new DomainException('The appointment changed. Refresh and try again.');
    schedule_open($pdo,(int)$a['barber_id'],$a['appt_date']);
    if ($move) {
        if (!in_array($a['status'],['pending','confirmed'],true)) throw new DomainException('Only pending or confirmed bookings can be rescheduled.');
        $date=schedule_date($b['date'] ?? ''); $start=schedule_minutes($b['time'] ?? '');
        $duration=(int)$a['booked_duration'];
        if ($duration<1) throw new DomainException('Booking duration is missing. Run the schedule migration first.');
        schedule_slot($pdo,$target,$date,$start,$duration,$id);
        $pdo->prepare('UPDATE appointments SET barber_id=?,appt_date=?,appt_time=? WHERE id=?')->execute([$target,$date,substr(schedule_time($start),0,5),$id]);
        schedule_audit($pdo,$target,(int)$me['id'],'reschedule',['appointment_id'=>$id,'from'=>['barber_id'=>$a['barber_id'],'date'=>$a['appt_date'],'time'=>$a['appt_time']],'to'=>['barber_id'=>$target,'date'=>$date,'time'=>substr(schedule_time($start),0,5)]]);
        return ['ok'=>true];
    }
    $status=$b['status'] ?? '';
    $next=['pending'=>['confirmed','cancelled'],'confirmed'=>['in_progress','cancelled'],'in_progress'=>['completed','cancelled'],'completed'=>[],'cancelled'=>[]];
    if ($me['role']==='customer' && ($a['status']!=='pending' || $status!=='cancelled')) error_out('Customers may only cancel their own pending bookings.',403);
    if (!in_array($status,$next[$a['status']] ?? [],true)) throw new DomainException('Invalid status change. Use Confirm, Start, then Complete. Finished bookings cannot be reopened.');
    if (in_array($status,['in_progress','completed'],true) && $a['appt_date']>date('Y-m-d')) throw new DomainException('Future bookings cannot be started or completed yet.');
    $notes=trim((string)($b['completion_notes'] ?? ''));
    if ($status==='completed' && ($notes==='' || strlen($notes)>5000)) throw new InvalidArgumentException('Add completion notes (up to 5000 bytes).');
    $pdo->prepare('UPDATE appointments SET status=?,completion_notes=?,completed_at=? WHERE id=?')->execute([$status,$status==='completed'?$notes:$a['completion_notes'],$status==='completed'?schedule_now():$a['completed_at'],$id]);
    schedule_audit($pdo,(int)$a['barber_id'],(int)$me['id'],'booking_status',['appointment_id'=>$id,'from'=>$a['status'],'to'=>$status]);
    schedule_finalize($pdo,(int)$a['barber_id'],$a['appt_date'],(int)$me['id']);
    return ['ok'=>true];
});
send_json($result);
