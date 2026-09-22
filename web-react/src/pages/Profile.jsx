import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import './accounts.css';
export default function Profile() {
  const { user, updateUser } = useAuth(); const admin=user.role==='admin';
  const [form,setForm]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[reading,setReading]=useState(false);
  const fill=u=>({...u,current_password:'',password:'',password_confirmation:''});
  useEffect(()=>{let live=true;api.profile().then(d=>{if(live)setForm(fill(d.user));}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const photo=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;setError('');setSuccess('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1048576){setError('Choose JPG, PNG or WebP, maximum 1 MB.');return;}
    setReading(true);try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read image.'));r.readAsDataURL(file);});
      const image=new Image();image.src=data;await image.decode();if(image.width>2048||image.height>2048)throw new Error('Image must be no larger than 2048 × 2048 pixels.');setForm(f=>({...f,profile_photo:data}));
    }catch(e){setError(e.message);}finally{setReading(false);}
  };
  const submit=async e=>{e.preventDefault();setError('');setSuccess('');
    if(form.password && (new TextEncoder().encode(form.password).length>72||form.password.trim().length<8)){setError('Password must be 8–72 bytes.');return;}
    if(form.password!==form.password_confirmation){setError('Passwords do not match.');return;}
    setBusy(true);try{const d=await api.saveProfile(form);updateUser(d.user);setForm(fill(d.user));setSuccess('Profile saved. Other sessions are signed out if you changed your password.');}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <main className="main"><span className="eyebrow">Your account</span><h1>My Profile</h1><p>Update your details and the photo shown in your staff workspace.</p>{error&&<div role="alert" className="alert alert-error">{error}</div>}{success&&<div role="status" className="alert alert-success">{success}</div>}{!form?<p>Loading profile…</p>:<form onSubmit={submit} className="card account-form"><fieldset disabled={busy||reading}>
    <div className="profile-photo-row">{form.profile_photo?<img src={form.profile_photo} alt="Your profile" className="profile-photo"/>:<div className="profile-photo-placeholder">{form.name?.[0]}</div>}<div><label className="form-row">Profile photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={photo}/></label><small>JPG, PNG or WebP · up to 1 MB · 2048 × 2048 pixels</small>{form.profile_photo&&<button type="button" className="btn btn-outline" onClick={()=>setForm(f=>({...f,profile_photo:null}))}>Remove photo</button>}</div></div>
    <div className="form-grid"><label className="form-row">Name *<input name="name" required maxLength={120} value={form.name||''} onChange={change}/></label>{admin&&<label className="form-row">Display name<input name="display_name" maxLength={120} value={form.display_name||''} onChange={change}/></label>}<label className="form-row">Email *<input name="email" type="email" required maxLength={160} value={form.email||''} onChange={change}/></label><label className="form-row">Phone number<input name="phone" type="tel" maxLength={30} value={form.phone||''} onChange={change}/></label>{!admin&&<><label className="form-row">Specialty<input name="specialty" maxLength={160} value={form.specialty||''} onChange={change}/></label><label className="form-row field-wide">Bio<textarea name="bio" rows={4} maxLength={5000} value={form.bio||''} onChange={change}/></label></>}</div>
    <h2>Account security</h2><p>Enter your current password when changing your email or password. Leave new password blank to keep it.</p><div className="form-grid"><label className="form-row">Current password<input name="current_password" type="password" autoComplete="current-password" value={form.current_password} onChange={change}/></label><label className="form-row">New password<input name="password" type="password" autoComplete="new-password" value={form.password} onChange={change}/></label><label className="form-row">Confirm new password<input name="password_confirmation" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={change}/></label></div><button className="btn btn-primary">{busy?'Saving…':reading?'Reading image…':'Save changes'}</button>
  </fieldset></form>}</main>;
}
