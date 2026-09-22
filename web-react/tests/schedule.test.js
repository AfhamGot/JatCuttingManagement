import { test } from 'node:test';
import assert from 'node:assert/strict';
import { malaysiaDate, shiftDate, minutes, prettyTime, time24, duration, validateSchedule, canClockIn } from '../src/pages/scheduleUtils.js';
const form = { date:'2026-09-21', start_time:'10:00', end_time:'22:00', break_start:'13:00', break_end:'14:00', is_available:1 };
test('Malaysia day is correct across UTC midnight and month boundaries', () => {
  assert.equal(malaysiaDate(new Date('2026-09-20T17:00:00Z')), '2026-09-21');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
});
test('12 and 24 hour times agree and invalid times are rejected', () => {
  assert.equal(minutes('10:00 AM'), 600); assert.equal(minutes('10:00 PM'),1320);
  assert.equal(time24('12:30 PM'),'12:30'); assert.equal(prettyTime('22:00:00'),'10:00 PM');
  for(const value of ['25:00','10:99','0:30 AM','oops']) assert.ok(Number.isNaN(minutes(value)));
});
test('schedule validation enforces working hours and break boundaries', () => {
  assert.equal(validateSchedule(form),'');
  for(const update of [{start_time:'09:59'},{end_time:'22:01'},{start_time:'22:00'},{break_end:''},{break_start:'09:30'},{break_start:'14:00',break_end:'13:00'}]) assert.ok(validateSchedule({...form,...update}));
});
test('clock in is allowed at opening, not during break or at closing', () => {
  const day = { barber:{is_active:1}, schedule:{...form,work_date:form.date}, active_clock:null, report:null };
  const allowed = (time, patch={}) => canClockIn({...day,...patch},new Date(`2026-09-21T${time}:00+08:00`));
  assert.equal(allowed('10:00'),true); assert.equal(allowed('09:59'),false);
  assert.equal(allowed('13:00'),false); assert.equal(allowed('14:00'),true);
  assert.equal(allowed('22:00'),false); assert.equal(allowed('10:00',{active_clock:{id:1}}),false);
  assert.equal(allowed('10:00',{report:{id:1}}),false);
  assert.equal(allowed('10:00',{schedule:{...day.schedule,is_available:0}}),false);
  assert.equal(allowed('10:00',{barber:{is_active:0}}),false);
  assert.equal(canClockIn(day,new Date('2026-09-22T10:00:00+08:00')),false);
});
test('worked time displays full hours without wrapping at 24h', () => {
  assert.equal(duration(3660),'1h 01m'); assert.equal(duration(25*3600),'25h 00m'); assert.equal(duration(-5),'0h 00m');
});
