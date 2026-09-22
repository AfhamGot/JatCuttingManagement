<?php
require_once __DIR__ . '/../qr_helpers.php';
header('Cache-Control: no-store, private');
$me=require_auth(['admin','barber']); $pdo=db();
if ($_SERVER['REQUEST_METHOD']!=='POST') error_out('Use POST. Attendance history is available through schedules.php.',405);
$b=json_input(); $id=schedule_scope($me,$b['barber_id'] ?? null); $action=$b['action'] ?? '';
if (!in_array($action,['clock_in','clock_out'],true)) error_out('Unknown attendance action.',422);
if (!(int)$me['is_active']) error_out('Account inactive.',403);
if ($me['role']==='admin' && $action==='clock_in') error_out('Barbers must clock in themselves.',403);
if ($me['role']==='barber') qr_schema($pdo);
$result=schedule_tx($pdo,function() use($pdo,$me,$id,$action,$b) {
    $barber=schedule_barber($pdo,$id,true); $today=date('Y-m-d'); $now=schedule_now();
    if ($me['role']==='barber') qr_consume($pdo,$id,$action,$b['qr_token'] ?? null);
    $open=schedule_active_clock($pdo,$id);
    if ($action==='clock_in') {
        if ($me['role']!=='barber') error_out('Barbers must clock in themselves.',403);
        if ($open) throw new DomainException('You are already clocked in. Clock out first.');
        schedule_open($pdo,$id,$today);
        if (!(int)$barber['is_active'] || !schedule_fits(schedule_get($pdo,$id,$today),(int)date('G')*60+(int)date('i'),1)) throw new DomainException('Clock in during your available hours, between 10 AM and 10 PM, outside your break.');
        $pdo->prepare('INSERT INTO barber_attendance (barber_id,work_date,clock_in) VALUES (?,?,?)')->execute([$id,$today,$now]);
        schedule_audit($pdo,$id,(int)$me['id'],'clock_in',['attendance_id'=>$pdo->lastInsertId(),'at'=>$now]);
        return ['ok'=>true];
    }
    if ($action!=='clock_out') throw new InvalidArgumentException('Unknown attendance action.');
    if (!$open) throw new DomainException('There is no open clock-in to close.');
    $reason=trim((string)($b['reason'] ?? ''));
    if ($me['role']==='admin' && $reason==='') throw new InvalidArgumentException('Provide a reason for closing a barber clock session.');
    if (strlen($reason)>255) throw new InvalidArgumentException('Keep the reason within 255 bytes.');
    $pdo->prepare('UPDATE barber_attendance SET clock_out=?,closed_by=?,close_reason=? WHERE id=? AND clock_out IS NULL')->execute([$now,$me['id'],$reason,$open['id']]);
    schedule_audit($pdo,$id,(int)$me['id'],'clock_out',['attendance_id'=>$open['id'],'at'=>$now,'reason'=>$reason]);
    $report=schedule_finalize($pdo,$id,$open['work_date'],(int)$me['id']);
    return ['ok'=>true,'report'=>$report];
});
send_json($result);
