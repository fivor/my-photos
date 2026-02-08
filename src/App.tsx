import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Gallery from './pages/Gallery';
import Upload from './pages/Upload';
import Settings from './pages/Settings';

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <Router basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Gallery Access */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/gallery" replace />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/favorites" element={<Gallery />} />
              <Route path="/map" element={<Gallery />} />
              <Route path="/folder/:id" element={<Gallery />} />
              <Route path="/upload" element={<Upload />} />
            </Route>

            <Route element={<ProtectedRoute requireAdmin />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/trash" element={<Gallery />} />
            </Route>

            <Route path="*" element={<Navigate to="/gallery" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
