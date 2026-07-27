import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOtp from './pages/VerifyOtp';
import Editor from './pages/Editor';
import History from './pages/History';
import LandingPage from './pages/LandingPage';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-xs tracking-[0.3em] uppercase text-ink-500">Loading…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-xs tracking-[0.3em] uppercase text-ink-500">Loading…</span>
      </div>
    );
  }
  if (user) return <Navigate to="/app/editor" replace />;
  return children;
};

function AppRoutes() {
  useTheme();
  return (
    <div className="relative min-h-full">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: 'toast-ink',
          style: {
            background: '#1C1917',
            color: '#FBF8F2',
            borderRadius: 2,
            fontSize: 13,
            border: '1px solid #44403C',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<Layout />}>
            <Route index element={<Navigate to="editor" replace />} />
            <Route path="editor" element={<Editor />} />
            <Route path="editor/:id" element={<Editor />} />
            <Route path="history" element={<History />} />
          </Route>
        </Route>

        <Route path="/dashboard" element={<Navigate to="/app/editor" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
