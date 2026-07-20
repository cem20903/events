import { Routes, Route } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage.jsx';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <span className="text-lg font-semibold text-slate-800">misEvents</span>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<CalendarPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
