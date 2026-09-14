import { useState } from 'react';
import Home from './pages/Home';
import Student from './pages/Student';
import Cook from './pages/Cook';

export type Page = 'home' | 'student' | 'cook';

export default function App() {
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="min-h-screen bg-orange-50">
      {page === 'home' && <Home onNavigate={setPage} />}
      {page === 'student' && <Student onBack={() => setPage('home')} />}
      {page === 'cook' && <Cook onBack={() => setPage('home')} />}
    </div>
  );
}