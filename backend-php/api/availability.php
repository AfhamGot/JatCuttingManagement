<?php
require_once __DIR__ . '/../schedule_helpers.php';
if ($_SERVER['REQUEST_METHOD']!=='GET') error_out('Use GET',405);
$pdo=db(); $id=(int)($_GET['barber_id'] ?? 0); $date=schedule_date($_GET['date'] ?? '');
$service=(int)($_GET['service_id'] ?? 0); $barber=schedule_barber($pdo,$id);
$q=$pdo->prepare('SELECT duration_minutes FROM services WHERE id=? AND is_active=1'); $q->execute([$service]); $duration=$q->fetchColumn();
if (!$duration) error_out('Active service not found.',404);
$s=schedule_get($pdo,$id,$date); $bookings=schedule_bookings($pdo,$id,$date); $slots=[];
if ((int)$barber['is_active'] && !schedule_report($pdo,$id,$date)) {
    for($start=600;$start+(int)$duration<=1320;$start+=15) {
        if ($date.' '.schedule_time($start)<schedule_now() || !schedule_fits($s,$start,(int)$duration)) continue;
        $free=true;
        foreach($bookings as $a) {
            if ($a['status']==='cancelled') continue;
            $other=schedule_minutes($a['appt_time']);
            if ($start<$other+(int)$a['duration_minutes'] && $start+(int)$duration>$other) { $free=false; break; }
        }
        if ($free) $slots[]=substr(schedule_time($start),0,5);
    }
}
// Do not expose customer details, staff notes or attendance through this public endpoint.
send_json(['barber_id'=>$id,'date'=>$date,'timezone'=>'Asia/Kuala_Lumpur','duration_minutes'=>(int)$duration,'slots'=>$slots]);
