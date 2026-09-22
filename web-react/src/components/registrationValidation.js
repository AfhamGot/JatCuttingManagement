export function validateRegistration(kind, form, records = []) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Please enter a name.';
  else if (form.name.trim().length > 120) errors.name = 'Use 120 characters or fewer.';
  if (kind === 'barber') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 160) errors.email = 'Enter a valid email address (up to 160 characters).';
    else if (records.some((r) => r.email?.toLowerCase() === form.email.trim().toLowerCase())) errors.email = 'A barber with this email already exists.';
    if (form.password.trim().length < 6) errors.password = 'Use at least 6 characters, excluding surrounding spaces.';
    else if (new TextEncoder().encode(form.password).length > 72) errors.password = 'Password must be no more than 72 bytes.';
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
    const phone = form.phone.trim();
    if (phone && (!/^\+?[\d\s()-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15 || phone.length > 30)) errors.phone = 'Enter 7–15 digits; spaces, +, brackets and hyphens are allowed.';
    if (form.specialty.trim().length > 160) errors.specialty = 'Use 160 characters or fewer.';
  } else {
    if (!/^\d+(\.\d{1,2})?$/.test(String(form.price)) || Number(form.price) <= 0 || Number(form.price) > 999999.99) errors.price = 'Enter RM 0.01–999,999.99, with up to 2 decimal places.';
    if (!/^\d+$/.test(String(form.duration_minutes)) || Number(form.duration_minutes) < 1 || Number(form.duration_minutes) > 2147483647) errors.duration_minutes = 'Enter a positive whole number of minutes.';
    if (form.description.trim().length > 255) errors.description = 'Use 255 characters or fewer.';
  }
  return errors;
}
