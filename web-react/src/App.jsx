import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminAppointments from './pages/admin/AdminAppointments';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBarbers from './pages/admin/AdminBarbers';
import AdminServices from './pages/admin/AdminServices';
import BarberAppointments from './pages/barber/BarberAppointments';
import Profile from './pages/Profile';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminProducts from './pages/admin/AdminProducts';
import ScheduleWorkspace from './pages/ScheduleWorkspace';
import ShopQrDisplay from './pages/ShopQrDisplay';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/services', label: 'Services', group: 'Services & Bookings' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/barbers', label: 'Barbers', group: 'Barbers & Attendance' },
  { to: '/admin/schedule', label: 'Schedule & Attendance' },
  { to: '/admin/attendance-qr', label: 'Shop attendance QR' },
  { to: '/admin/profile', label: 'My Profile', group: 'Account & Access' },
  { to: '/admin/admins', label: 'Manage Admins', ownerOnly: true },
];
const BARBER_LINKS = [
  { to: '/barber', label: 'My Appointments', end: true, group: 'Bookings & Schedule' },
  { to: '/barber/schedule', label: 'My Schedule' },
  { to: '/barber/profile', label: 'My Profile', group: 'My Account' },
];

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/barber'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          <Route path="/admin" element={<Layout role="admin" links={ADMIN_LINKS} />}>
            <Route index element={<AdminDashboard />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="schedule" element={<ScheduleWorkspace />} />
            <Route path="attendance-qr" element={<ShopQrDisplay />} />
            <Route path="barbers" element={<AdminBarbers />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admins" element={<AdminAccounts />} />
          </Route>

          <Route path="/barber" element={<Layout role="barber" links={BARBER_LINKS} />}>
            <Route index element={<BarberAppointments />} />
            <Route path="schedule" element={<ScheduleWorkspace />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
