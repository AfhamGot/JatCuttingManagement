<?php
require_once __DIR__ . '/../schedule_helpers.php';
$me=require_auth(['admin','barber']); $pdo=db(); $method=$_SERVER['REQUEST_METHOD'];
if ($method==='GET') {
    $date=schedule_date($_GET['date'] ?? date('Y-m-d'));
    if ($me['role']==='admin' && empty($_GET['barber_id'])) {
        $ids=$pdo->query("SELECT id FROM users WHERE role='barber' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    } else $ids=[schedule_scope($me,$_GET['barber_id'] ?? null)];
    $days=[];
    foreach($ids as $id) {
        $days[]=schedule_tx($pdo,function() use($pdo,$id,$date,$me) {
            $barber=schedule_barber($pdo,(int)$id,true);
            $report=schedule_finalize($pdo,(int)$id,$date,(int)$me['id']);
            $attendance=schedule_attendance($pdo,(int)$id,$date);
            return ['barber'=>$barber,'schedule'=>schedule_get($pdo,(int)$id,$date),'appointments'=>schedule_bookings($pdo,(int)$id,$date),'attendance'=>$attendance,'active_clock'=>schedule_active_clock($pdo,(int)$id),'worked_seconds'=>array_sum(array_column($attendance,'worked_seconds')),'report'=>$report];
        });
    }
    send_json(['date'=>$date,'timezone'=>'Asia/Kuala_Lumpur','server_now'=>date(DATE_ATOM),'days'=>$days]);
}
if ($method!=='POST') error_out('Method not allowed',405);
$b=json_input(); $id=schedule_scope($me,$b['barber_id'] ?? null); $date=schedule_date($b['date'] ?? '');
$action=$b['action'] ?? 'save';
$result=schedule_tx($pdo,function() use($pdo,$id,$date,$action,$me,$b) {
    schedule_barber($pdo,$id,true);
    if ($action==='finish') return ['report'=>schedule_finalize($pdo,$id,$date,(int)$me['id'],true)];
    if ($action!=='save') throw new InvalidArgumentException('Unknown schedule action.');
    schedule_open($pdo,$id,$date);
    if ($date<date('Y-m-d')) throw new DomainException('Past availability cannot be changed.');
    $start=schedule_minutes($b['start_time'] ?? '10:00'); $end=schedule_minutes($b['end_time'] ?? '22:00');
    if ($start<600 || $end>1320 || $start>=$end) throw new InvalidArgumentException('Working hours must be between 10 AM and 10 PM, with end after start.');
    if (!in_array($b['is_available'] ?? null,[0,1,'0','1'],true)) throw new InvalidArgumentException('Choose available or off day.');
    $available=(int)$b['is_available'];
    $bs=empty($b['break_start']) ? null : schedule_minutes($b['break_start']);
    $be=empty($b['break_end']) ? null : schedule_minutes($b['break_end']);
    if (($bs===null)!==($be===null) || ($bs!==null && ($bs<$start || $be>$end || $bs>=$be))) throw new InvalidArgumentException('Break must have a start and end within the working hours.');
    $notes=trim((string)($b['notes'] ?? ''));
    if (strlen($notes)>255) throw new InvalidArgumentException('Keep the schedule note within 255 bytes.');
    $next=['start_time'=>schedule_time($start),'end_time'=>schedule_time($end),'break_start'=>$bs===null?null:schedule_time($bs),'break_end'=>$be===null?null:schedule_time($be),'is_available'=>$available];
    foreach(schedule_bookings($pdo,$id,$date) as $a) {
        if ($a['status']!=='cancelled' && !schedule_fits($next,schedule_minutes($a['appt_time']),(int)$a['duration_minutes'])) throw new DomainException('These hours conflict with existing bookings. Reschedule or cancel the affected booking first.');
    }
    $clock=schedule_active_clock($pdo,$id);
    if ($clock && $clock['work_date']===$date && (!$available || !schedule_fits($next,(int)date('G')*60+(int)date('i'),1))) throw new DomainException('Clock out before making yourself unavailable now.');
    $before=schedule_get($pdo,$id,$date);
    $q=$pdo->prepare('INSERT INTO barber_schedules (barber_id,work_date,start_time,end_time,break_start,break_end,is_available,notes,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE start_time=VALUES(start_time),end_time=VALUES(end_time),break_start=VALUES(break_start),break_end=VALUES(break_end),is_available=VALUES(is_available),notes=VALUES(notes),updated_by=VALUES(updated_by),updated_at=VALUES(updated_at)');
    $q->execute([$id,$date,$next['start_time'],$next['end_time'],$next['break_start'],$next['break_end'],$available,$notes,$me['id'],schedule_now()]);
    schedule_audit($pdo,$id,(int)$me['id'],'save_schedule',['date'=>$date,'before'=>$before,'after'=>array_merge($next,['notes'=>$notes])]);
    return ['ok'=>true];
});
send_json($result);
