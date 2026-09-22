import { Fragment } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Layout({ role, links }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/barber'} replace />;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <span><strong>Jat</strong><small>Barbershop</small></span>
        </div>
        {links.filter(l => !l.ownerOnly || user.is_owner).map((l) => (
          <Fragment key={l.to}>
          {l.group && <div className="sidebar-section-heading">{l.group}</div>}
          <NavLink to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-dot" />{l.label}
          </NavLink>
          </Fragment>
        ))}
        <div className="logout">
          <div className="user-summary">
            <span className="user-avatar">{user.profile_photo ? <img src={user.profile_photo} alt="" /> : (user.display_name || user.name)?.charAt(0).toUpperCase()}</span>
            <span><strong>{user.display_name || user.name}</strong><small>{role}</small></span>
          </div>
          <button className="navlink" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <div className="content-shell">
        <Outlet />
      </div>
    </div>
  );
}
