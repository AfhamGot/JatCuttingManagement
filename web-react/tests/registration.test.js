import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration as validate } from '../src/components/registrationValidation.js';

const barber = { name: 'Ali', email: 'ali@example.com', password: 'barber123', confirmPassword: 'barber123', phone: '', specialty: '', bio: '' };
const service = { name: 'Haircut', price: '25.00', duration_minutes: '30', description: '' };
test('valid barber and service forms pass', () => {
  assert.deepEqual(validate('barber', barber), {});
  assert.deepEqual(validate('service', service), {});
});
test('required names reject whitespace', () => {
  assert.ok(validate('barber', { ...barber, name: '   ' }).name);
  assert.ok(validate('service', { ...service, name: '   ' }).name);
});
test('email syntax and existing barber email are checked', () => {
  assert.ok(validate('barber', { ...barber, email: 'invalid' }).email);
  assert.ok(validate('barber', barber, [{ email: 'ALI@example.com' }]).email);
});
test('password minimum, confirmation and bcrypt byte limit', () => {
  assert.ok(validate('barber', { ...barber, password: 'short' }).password);
  assert.ok(validate('barber', { ...barber, confirmPassword: 'different' }).confirmPassword);
  assert.ok(validate('barber', { ...barber, password: 'x'.repeat(73) }).password);
});
test('phone accepts optional and formatted numbers but rejects invalid values', () => {
  assert.equal(validate('barber', { ...barber, phone: '+60 12-3456789' }).phone, undefined);
  for (const phone of ['abc', '123', '1'.repeat(16)]) assert.ok(validate('barber', { ...barber, phone }).phone);
});
test('price rejects empty, negative, zero, excessive precision and out-of-range values', () => {
  for (const price of ['', '-1', '0', '1.001', '1000000', 'Infinity', '1abc']) assert.ok(validate('service', { ...service, price }).price);
});
test('duration must be a positive integer', () => {
  for (const duration_minutes of ['', '0', '-1', '1.5', 'abc', '2147483648']) assert.ok(validate('service', { ...service, duration_minutes }).duration_minutes);
});
test('database string length limits are checked', () => {
  assert.ok(validate('service', { ...service, name: 'x'.repeat(121) }).name);
  assert.ok(validate('service', { ...service, description: 'x'.repeat(256) }).description);
  assert.ok(validate('barber', { ...barber, specialty: 'x'.repeat(161) }).specialty);
});
