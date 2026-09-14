import { useState } from 'react';
import Home from './pages/Home';
import Student from './pages/Student';
import Cook from './pages/Cook';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthScreen, RoleNotice } from './components/auth/AuthScreen';

export type Page = 'home' | 'student' | 'cook';

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const [page, setPage] = useState<Page>('home');
  const { user } = useAuth();

  if (page === 'student') {
    if (!user) return <AuthScreen requiredRole="STUDENT" onBack={() => setPage('home')} />;
    if (user.role !== 'STUDENT') {
      return <RoleNotice requiredRole="STUDENT" onBack={() => setPage('home')} />;
    }
    return <Student onBack={() => setPage('home')} />;
  }

  if (page === 'cook') {
    if (!user) return <AuthScreen requiredRole="COOK" onBack={() => setPage('home')} />;
    if (user.role !== 'COOK') {
      return <RoleNotice requiredRole="COOK" onBack={() => setPage('home')} />;
    }
    return <Cook onBack={() => setPage('home')} />;
  }

  return <Home onNavigate={setPage} />;
}