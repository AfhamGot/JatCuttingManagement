import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, timeMinutes, csvCell, localDate } from '../src/pages/admin/dashboardData.js';
test('year filter, months and status totals use real appointments', () => {
  const result = summarize([
    { appt_date:'2026-01-02', status:'completed', customer_id:1 },
    { appt_date:'2026-01-03', status:'cancelled', customer_id:1 },
    { appt_date:'2026-12-01', status:'pending', customer_id:2 },
    { appt_date:'2025-12-01', status:'confirmed', customer_id:3 },
  ], '2026');
  assert.equal(result.selected.length, 3);
  assert.equal(result.clients, 2);
  assert.equal(result.months[0].all, 2);
  assert.equal(result.months[0].completed, 1);
  assert.equal(result.months[11].all, 1);
  assert.equal(Object.values(result.statuses).reduce((a,b)=>a+b,0),3);
});
test('empty data has zero counts', () => {
  assert.equal(summarize([],2026).clients,0);
  assert.ok(summarize([],2026).months.every(m=>m.all===0));
});
test('12-hour and 24-hour booking times sort correctly', () => {
  assert.equal(timeMinutes('12:00 AM'),0);
  assert.equal(timeMinutes('12:00 PM'),720);
  assert.equal(timeMinutes('2:30 PM'),870);
  assert.equal(timeMinutes('14:30:00'),870);
  assert.ok(timeMinutes('9:00 AM')<timeMinutes('10:00 AM'));
});
test('CSV escapes cells and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
});
test('local calendar dates are padded', () => {
  assert.equal(localDate(new Date(2026,0,2)),'2026-01-02');
});
