import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { validateRegistration } from './registrationValidation';

const barberFields = [
  ['name', 'Full name', 'text', 'e.g. Ali bin Kassim', true],
  ['email', 'Email address', 'email', 'e.g. ali@example.com', true],
  ['password', 'Password', 'password', 'At least 6 characters', true],
  ['confirmPassword', 'Confirm password', 'password', 'Re-enter the password', true],
  ['phone', 'Phone number', 'tel', 'e.g. 012-3456789'],
  ['specialty', 'Specialty', 'text', 'e.g. Fades, beard styling'],
  ['bio', 'Short bio', 'textarea', 'Tell customers a little about this barber'],
];
const serviceFields = [
  ['name', 'Service name', 'text', 'e.g. Haircut & beard trim', true],
  ['price', 'Price (RM)', 'text', 'e.g. 35.00', true],
  ['duration_minutes', 'Duration (minutes)', 'text', 'e.g. 30', true],
  ['description', 'Description', 'textarea', 'Describe what is included'],
];

export default function AddRecordForm({ kind, records, initialRecord, onClose, onSaved }) {
  const barber = kind === 'barber';
  const editing = !!initialRecord;
  const title = `${editing ? 'Edit' : 'Add'} ${barber ? 'Barber' : 'Service'}`;
  const validate = (values) => {
    const errors = validateRegistration(kind, values, records.filter(r => !editing || String(r.id) !== String(initialRecord.id)));
    if (editing && barber && !values.password && !values.confirmPassword) {
      delete errors.password;
      delete errors.confirmPassword;
    }
    return errors;
  };
  const dialog = useRef(null);
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState(() => initialRecord ? (barber
    ? { name: initialRecord.name || '', email: initialRecord.email || '', password: '', confirmPassword: '', phone: initialRecord.phone || '', specialty: initialRecord.specialty || '', bio: initialRecord.bio || '' }
    : { name: initialRecord.name || '', price: String(initialRecord.price), duration_minutes: String(initialRecord.duration_minutes), description: initialRecord.description || '' }) : barber
    ? { name: '', email: '', password: '', confirmPassword: '', phone: '', specialty: '', bio: '' }
    : { name: '', price: '', duration_minutes: '30', description: '' });

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const close = () => { if (!submitting.current) onClose(); };
  const change = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (attempted) setErrors(validate(next));
    setSaveError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const nextErrors = validate(form);
    setAttempted(true);
    setErrors(nextErrors);
    setSaveError('');
    if (Object.keys(nextErrors).length) {
      dialog.current.querySelector(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      if (barber) {
        const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), bio: form.bio.trim() };
        if (!editing || form.password) payload.password = form.password;
        if (editing) await api.updateBarber(initialRecord.id, payload);
        else await api.createBarber(payload);
      } else {
        const payload = { name: form.name.trim(), price: Number(form.price), duration_minutes: Number(form.duration_minutes), description: form.description.trim() };
        if (editing) await api.updateService(initialRecord.id, payload);
        else await api.createService(payload);
      }
    } catch (error) {
      setSaveError(error.message || 'Unable to save. Please try again.');
      submitting.current = false;
      setSaving(false);
      return;
    }
    submitting.current = false;
    onSaved();
  };

  return (
    <dialog ref={dialog} className="registration-dialog" aria-labelledby="registration-title" onCancel={(e) => { e.preventDefault(); close(); }}>
      <div className="registration-heading">
        <div><span className="eyebrow">{barber ? 'Grow your team' : 'Build your menu'}</span><h2 id="registration-title">{title}</h2><p>{barber ? 'Create a new staff account for your barbershop.' : 'Add a service customers can book.'}</p></div>
        <button type="button" className="registration-close" aria-label="Close form" disabled={saving} onClick={close}>×</button>
      </div>
      <form noValidate onSubmit={submit} aria-busy={saving}>
        <div className="registration-body">
          <p className="form-note">Fields marked <span aria-hidden="true">*</span> are required. {editing && barber && 'Leave both password fields empty to keep the current password.'}</p>
          {saveError && <div className="alert alert-error" role="alert">{saveError}</div>}
          {Object.keys(errors).length > 0 && <p className="validation-summary" role="alert">Please correct the highlighted fields below.</p>}
          <fieldset disabled={saving} className="registration-fields form-grid">
            {(barber ? barberFields : serviceFields).map(([key, label, type, placeholder, required]) => {
              if (editing && type === 'password') required = false;
              const props = { id: `register-${key}`, name: key, value: form[key], placeholder, required: !!required, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `error-${key}` : undefined, onChange: (e) => change(key, e.target.value) };
              return <div key={key} className={`form-row ${type === 'textarea' ? 'field-wide' : ''}`}>
                <label htmlFor={props.id}>{label}{required ? <span className="required-mark"> *</span> : <span className="optional-label"> (optional)</span>}</label>
                {type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={type} autoComplete={type === 'password' ? 'new-password' : undefined} inputMode={key === 'price' ? 'decimal' : key === 'duration_minutes' ? 'numeric' : undefined} />}
                {errors[key] && <span id={`error-${key}`} className="field-error">{errors[key]}</span>}
              </div>;
            })}
          </fieldset>
        </div>
        <div className="registration-footer"><button type="button" className="btn btn-outline" onClick={close} disabled={saving}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : title}</button></div>
      </form>
    </dialog>
  );
}
