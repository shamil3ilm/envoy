import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Contacts from './pages/Contacts';
import Snippets from './pages/Snippets';
import Compose from './pages/Compose';
import Scheduled from './pages/Scheduled';
import History from './pages/History';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import Notes from './pages/Notes';
import Expenses from './pages/Expenses';
import Calculator from './pages/Calculator';
import DocumentTemplates from './pages/DocumentTemplates';
import Reminders from './pages/Reminders';
import FocusTimer from './pages/FocusTimer';
import Automations from './pages/Automations';
import SetupWizard from './components/SetupWizard';
import { useSettings } from './contexts/SettingsContext';

function App() {
  const { settings, loading } = useSettings();
  const [setupDone, setSetupDone] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!settings.setupComplete && !setupDone) {
    return <SetupWizard onComplete={() => setSetupDone(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="templates" element={<Templates />} />
        <Route path="documents" element={<DocumentTemplates />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="snippets" element={<Snippets />} />
        <Route path="compose" element={<Compose />} />
        <Route path="scheduled" element={<Scheduled />} />
        <Route path="history" element={<History />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="notes" element={<Notes />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="focus" element={<FocusTimer />} />
        <Route path="automations" element={<Automations />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
