<?php
require_once __DIR__ . '/bootstrap.php';
date_default_timezone_set('Asia/Kuala_Lumpur');

// Scheduling endpoints always return JSON, including migration/database failures.
set_exception_handler(function (Throwable $e) {
    error_log('Scheduling: ' . $e->getMessage());
    if ($e instanceof InvalidArgumentException) error_out($e->getMessage(), 422);
    if ($e instanceof DomainException) error_out($e->getMessage(), 409);
    error_out('Schedule data could not be loaded or saved. Import migrations/20260921_schedule_attendance.sql into the existing database, then check the PHP error log if this continues.', 500);
});

function schedule_date($value): string {
    if (!is_string($value)) throw new InvalidArgumentException('Choose a valid date.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Choose a valid date.');
    return $value;
}
function schedule_minutes($value): int {
    if (!is_string($value) || !preg_match('/^(\d{1,2}):(\d{2})(?::00)?\s*(AM|PM)?$/i', trim($value), $m)) throw new InvalidArgumentException('Enter a valid time.');
    $hour = (int)$m[1]; $minute = (int)$m[2];
    if ($minute > 59) throw new InvalidArgumentException('Invalid minutes.');
    if (!empty($m[3])) {
        if ($hour < 1 || $hour > 12) throw new InvalidArgumentException('Invalid hour.');
        $hour = $hour % 12 + (strtoupper($m[3]) === 'PM' ? 12 : 0);
    } elseif ($hour > 23) throw new InvalidArgumentException('Invalid hour.');
    return $hour * 60 + $minute;
}
function schedule_time(int $minutes): string { return sprintf('%02d:%02d:00', intdiv($minutes,60), $minutes % 60); }
function schedule_now(): string { return date('Y-m-d H:i:s'); }
function schedule_tx(PDO $pdo, callable $fn) {
    $pdo->beginTransaction();
    try { $result=$fn(); $pdo->commit(); return $result; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function schedule_barber(PDO $pdo, int $id, bool $lock=false): array {
    $q=$pdo->prepare("SELECT id,name,is_active FROM users WHERE id=? AND role='barber'" . ($lock ? ' FOR UPDATE' : ''));
    $q->execute([$id]); $b=$q->fetch();
    if (!$b) throw new InvalidArgumentException('Barber not found.');
    return $b;
}
function schedule_scope(array $me, $requested): int {
    $id=(int)($requested ?: $me['id']);
    if ($me['role']==='barber' && $id !== (int)$me['id']) error_out('You can only manage your own schedule.',403);
    return $id;
}
function schedule_get(PDO $pdo, int $id, string $date): array {
    $q=$pdo->prepare('SELECT * FROM barber_schedules WHERE barber_id=? AND work_date=?'); $q->execute([$id,$date]);
    $row=$q->fetch();
    return $row ?: ['barber_id'=>$id,'work_date'=>$date,'start_time'=>'10:00:00','end_time'=>'22:00:00','break_start'=>null,'break_end'=>null,'is_available'=>1,'notes'=>'','is_default'=>true];
}
function schedule_report(PDO $pdo,int $id,string $date): ?array {
    $q=$pdo->prepare('SELECT id,generated_at,snapshot FROM barber_daily_reports WHERE barber_id=? AND work_date=?'); $q->execute([$id,$date]);
    $r=$q->fetch(); if (!$r) return null;
    return ['id'=>(int)$r['id'],'generated_at'=>$r['generated_at'],'data'=>json_decode($r['snapshot'],true)];
}
function schedule_open(PDO $pdo,int $id,string $date): void {
    if (schedule_report($pdo,$id,$date)) throw new DomainException('This day has a final report and is locked. Choose another day.');
}
function schedule_fits(array $s,int $start,int $duration): bool {
    $end=$start+$duration;
    if (!(int)$s['is_available'] || $duration<1 || $start<600 || $end>1320 || $start<schedule_minutes($s['start_time']) || $end>schedule_minutes($s['end_time'])) return false;
    return empty($s['break_start']) || $end<=schedule_minutes($s['break_start']) || $start>=schedule_minutes($s['break_end']);
}
function schedule_bookings(PDO $pdo,int $id,string $date): array {
    $q=$pdo->prepare('SELECT a.*,c.name AS customer_name,c.phone AS customer_phone,b.name AS barber_name,COALESCE(a.booked_service,s.name) AS service_name,COALESCE(a.booked_price,s.price) AS service_price,COALESCE(a.booked_duration,s.duration_minutes) AS duration_minutes FROM appointments a JOIN users c ON c.id=a.customer_id JOIN users b ON b.id=a.barber_id JOIN services s ON s.id=a.service_id WHERE a.barber_id=? AND a.appt_date=?');
    $q->execute([$id,$date]); $rows=$q->fetchAll();
    usort($rows,function($a,$b){return schedule_minutes($a['appt_time'])<=>schedule_minutes($b['appt_time']);});
    return $rows;
}
function schedule_slot(PDO $pdo,int $id,string $date,int $start,int $duration,int $ignore=0): void {
    schedule_open($pdo,$id,$date);
    if ($date.' '.schedule_time($start) < schedule_now()) throw new DomainException('Choose a future booking time.');
    $barber=schedule_barber($pdo,$id);
    if (!(int)$barber['is_active'] || !schedule_fits(schedule_get($pdo,$id,$date),$start,$duration)) throw new DomainException('This booking must fit the barber availability, avoid breaks, and finish by 10 PM.');
    foreach(schedule_bookings($pdo,$id,$date) as $a) {
        if ((int)$a['id']===$ignore || $a['status']==='cancelled') continue;
        $other=schedule_minutes($a['appt_time']);
        if ($start < $other+(int)$a['duration_minutes'] && $start+$duration > $other) throw new DomainException('This time overlaps another booking. Choose a different slot.');
    }
}
function schedule_audit(PDO $pdo,int $id,int $actor,string $action,array $details): void {
    $pdo->prepare('INSERT INTO barber_schedule_audit (barber_id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)')->execute([$id,$actor,$action,json_encode($details),schedule_now()]);
}
function schedule_attendance(PDO $pdo,int $id,string $date): array {
    $q=$pdo->prepare('SELECT a.*,u.name AS closed_by_name FROM barber_attendance a LEFT JOIN users u ON u.id=a.closed_by WHERE a.barber_id=? AND a.work_date=? ORDER BY a.clock_in'); $q->execute([$id,$date]);
    $rows=$q->fetchAll();
    foreach($rows as &$row) $row['worked_seconds']=max(0,strtotime($row['clock_out'] ?: schedule_now())-strtotime($row['clock_in']));
    return $rows;
}
function schedule_active_clock(PDO $pdo,int $id): ?array {
    $q=$pdo->prepare('SELECT * FROM barber_attendance WHERE barber_id=? AND clock_out IS NULL ORDER BY id LIMIT 1'); $q->execute([$id]); return $q->fetch() ?: null;
}
// Called inside a transaction after locking the barber. Reports are immutable snapshots.
function schedule_finalize(PDO $pdo,int $id,string $date,int $actor,bool $manual=false): ?array {
    if ($r=schedule_report($pdo,$id,$date)) return $r;
    $s=schedule_get($pdo,$id,$date);
    $appointments=schedule_bookings($pdo,$id,$date); $attendance=schedule_attendance($pdo,$id,$date);
    $reason=null;
    if ($date>date('Y-m-d')) $reason='A future day cannot be finished.';
    elseif (!$manual && $date.' '.$s['end_time']>schedule_now()) return null;
    elseif ($manual && (int)$s['is_available'] && $date.' '.$s['start_time']>schedule_now()) $reason='The scheduled day has not started.';
    foreach($appointments as $a) if (in_array($a['status'],['pending','confirmed','in_progress'],true)) $reason='Resolve pending, confirmed and in-progress bookings before finishing the day.';
    foreach($attendance as $a) if (!$a['clock_out']) $reason='Clock out before finishing this day.';
    if ($reason) { if ($manual) throw new DomainException($reason); return null; }
    if (!$manual && !$appointments && !$attendance && !empty($s['is_default'])) return null;
    $completed=array_values(array_filter($appointments,function($a){return $a['status']==='completed';}));
    $seconds=array_sum(array_column($attendance,'worked_seconds'));
    $snapshot=['barber'=>schedule_barber($pdo,$id),'date'=>$date,'timezone'=>'Asia/Kuala_Lumpur','schedule'=>$s,'appointments'=>$appointments,'attendance'=>$attendance,'summary'=>['bookings'=>count($appointments),'completed'=>count($completed),'cancelled'=>count(array_filter($appointments,function($a){return $a['status']==='cancelled';})),'worked_seconds'=>$seconds,'completed_value'=>array_sum(array_column($completed,'service_price')),'legacy_prices'=>count(array_filter($completed,function($a){return (int)$a['legacy_price']===1;}))]];
    $pdo->prepare('INSERT INTO barber_daily_reports (barber_id,work_date,generated_at,generated_by,snapshot) VALUES (?,?,?,?,?)')->execute([$id,$date,schedule_now(),$actor,json_encode($snapshot,JSON_THROW_ON_ERROR)]);
    schedule_audit($pdo,$id,$actor,'finish_day',['date'=>$date,'manual'=>$manual]);
    return schedule_report($pdo,$id,$date);
}
