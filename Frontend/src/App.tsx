import { useEffect, useState, useCallback } from 'react';
import LoginPage from './LoginPage';
import SetupWizard from './SetupWizard';
import { apiFetch } from './api';
import { useWebSocket, WsMessage } from './hooks/useWebSocket';
import Sidebar from './components/Sidebar';
import ControlSection from './components/sections/ControlSection';
import HistorySection from './components/sections/HistorySection';
import UsersSection from './components/sections/UsersSection';
import DashboardSection from './components/sections/DashboardSection';
import AppsSection from './components/sections/AppsSection';
import {
  AppEntry,
  CloseResponse,
  DashboardData,
  HistoryEntry,
  LaunchResponse,
  View,
} from './types';

function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [command, setCommand] = useState('notepad.exe');
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [closeCommand, setCloseCommand] = useState('notepad');
  const [closeResult, setCloseResult] = useState<CloseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [activeView, setActiveView] = useState<View>('dashboard');

  const [apps, setApps] = useState<AppEntry[]>([]);

  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState('');
  const [deleteUserPassword, setDeleteUserPassword] = useState('');

  // Setup check
  useEffect(() => {
    fetch('http://127.0.0.1:3000/setup/status')
      .then((r) => r.json())
      .then((d) => setNeedsSetup(d.needs_setup === true))
      .catch(() => setNeedsSetup(false));
  }, []);

  // Backend health poll
  useEffect(() => {
    const check = () => {
      fetch('http://127.0.0.1:3000/health')
        .then((r) => setBackendHealthy(r.ok))
        .catch(() => setBackendHealthy(false));
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const handleWsMessage = useCallback((msg: WsMessage) => {
    if (msg.type === 'system_update') {
      setDashboard(msg.data);
    }
  }, []);

  const handleWsStatus = useCallback((online: boolean) => {
    setIsOnline(online);
    if (!online) setDashboard(null);
  }, []);

  useWebSocket({ token, onMessage: handleWsMessage, onStatusChange: handleWsStatus });

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('http://127.0.0.1:3000/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      setError("Erreur lors de l'appel au backend : " + err);
    }
    setToken(null);
    localStorage.removeItem('token');
  };

  const handleUnauthorized = (errMessage: string) => {
    if (errMessage === 'UNAUTHORIZED') {
      handleLogout();
    } else {
      setError("Erreur lors de l'appel au backend : " + errMessage);
      setIsOnline(false);
    }
  };

  // Apps fetch
  const fetchApps = useCallback(async () => {
    if (!token) { setApps([]); return; }
    try {
      const res = await apiFetch('http://127.0.0.1:3000/apps', {}, token);
      setApps(await res.json());
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') handleLogout();
    }
  }, [token]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const addApp = async (name: string, path: string, args: string) => {
    if (!token) return;
    await apiFetch('http://127.0.0.1:3000/apps/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, args: args || null }),
    }, token);
    await fetchApps();
  };

  const deleteApp = async (name: string) => {
    if (!token) return;
    await apiFetch('http://127.0.0.1:3000/apps/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }, token);
    await fetchApps();
  };

  const launchAppByName = (name: string) => {
    setCommand(name);
    setActiveView('control');
  };

  // History poll
  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) { setHistory([]); return; }
      try {
        const res = await apiFetch('http://127.0.0.1:3000/history', { signal: AbortSignal.timeout(3000) }, token);
        setHistory(await res.json());
      } catch (err) {
        if (err instanceof Error) handleUnauthorized(err.message);
      }
    };
    fetchHistory();
    const id = setInterval(fetchHistory, 5000);
    return () => clearInterval(id);
  }, [token]);

  const launchApp = async () => {
    if (!isOnline) { setError('Le PC est hors ligne.'); return; }
    if (!token) { setError('Vous devez être connecté.'); return; }
    setLaunchResult(null); setError(null);
    try {
      const resp = await apiFetch('http://127.0.0.1:3000/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      }, token);
      setLaunchResult(await resp.json());
    } catch (err) {
      if (err instanceof Error) handleUnauthorized(err.message);
    }
  };

  const closeApp = async () => {
    if (!isOnline) { setError('Le PC est hors ligne.'); return; }
    if (!token) { setError('Vous devez être connecté.'); return; }
    setCloseResult(null); setError(null);
    try {
      const resp = await apiFetch('http://127.0.0.1:3000/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: closeCommand }),
      }, token);
      setCloseResult(await resp.json());
    } catch (err) {
      if (err instanceof Error) handleUnauthorized(err.message);
    }
  };

  const createUser = async () => {
    if (!token) { setError('Vous devez être connecté.'); return; }
    try {
      const resp = await apiFetch('http://127.0.0.1:3000/create_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUserId, password: newUserPassword }),
      }, token);
      const result = await resp.json();
      if (result.success) { alert('Utilisateur créé avec succès'); setNewUserId(''); setNewUserPassword(''); }
      else alert("Erreur lors de la création de l'utilisateur");
    } catch (err) {
      if (err instanceof Error) handleUnauthorized(err.message);
    }
  };

  const deleteUser = async () => {
    if (!token) { setError('Vous devez être connecté.'); return; }
    try {
      const resp = await apiFetch('http://127.0.0.1:3000/delete_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: deleteUserId, password: deleteUserPassword }),
      }, token);
      const result = await resp.json();
      if (result.success) { alert('Utilisateur supprimé avec succès'); setDeleteUserId(''); setDeleteUserPassword(''); }
      else alert("Erreur lors de la suppression de l'utilisateur");
    } catch (err) {
      if (err instanceof Error) handleUnauthorized(err.message);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Chargement...
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="max-w-md w-full p-8 rounded-3xl border border-slate-700 bg-slate-900/80 shadow-xl shadow-slate-900/40 backdrop-blur-md">
          <SetupWizard onSetupComplete={() => setNeedsSetup(false)} />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="max-w-md w-full p-8 rounded-3xl border border-slate-700 bg-slate-900/80 shadow-xl shadow-slate-900/40 backdrop-blur-md">
          <h1 className="text-3xl font-bold text-cyan-300 mb-6 text-center">Connexion requise</h1>
          <LoginPage onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar
          activeView={activeView}
          onChangeView={setActiveView}
          isOnline={isOnline}
          backendHealthy={backendHealthy}
          onLogout={handleLogout}
        />

        <main className="flex-1 px-6 py-8 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-8">
            {!isOnline && (
              <div className="rounded-3xl border border-red-700 bg-red-950/80 p-6 text-center">
                <p className="text-xl font-semibold text-red-300">⚠️ PC HORS LIGNE</p>
                <p className="mt-2 text-red-200">
                  Le PC n'est pas accessible. Vérifie que le backend Rust tourne sur http://127.0.0.1:3000
                </p>
              </div>
            )}

            {activeView === 'dashboard' && <DashboardSection data={dashboard} />}

            {activeView === 'control' && (
              <ControlSection
                isOnline={isOnline}
                apps={apps}
                command={command}
                setCommand={setCommand}
                closeCommand={closeCommand}
                setCloseCommand={setCloseCommand}
                launchResult={launchResult}
                closeResult={closeResult}
                error={error}
                onLaunch={launchApp}
                onClose={closeApp}
              />
            )}

            {activeView === 'apps' && (
              <AppsSection
                apps={apps}
                onAdd={addApp}
                onDelete={deleteApp}
                onLaunch={launchAppByName}
              />
            )}

            {activeView === 'history' && <HistorySection history={history} />}

            {activeView === 'users' && (
              <UsersSection
                newUserId={newUserId}
                setNewUserId={setNewUserId}
                newUserPassword={newUserPassword}
                setNewUserPassword={setNewUserPassword}
                deleteUserId={deleteUserId}
                setDeleteUserId={setDeleteUserId}
                deleteUserPassword={deleteUserPassword}
                setDeleteUserPassword={setDeleteUserPassword}
                onCreateUser={createUser}
                onDeleteUser={deleteUser}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
