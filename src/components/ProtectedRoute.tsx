import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/gallery" replace />;
  }

  return <Outlet />;
}
