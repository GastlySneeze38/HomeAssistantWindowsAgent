import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import { apiFetch } from './api';
import Sidebar from './components/Sidebar';
import ControlSection from './components/sections/ControlSection';
import HistorySection from './components/sections/HistorySection';
import UsersSection from './components/sections/UsersSection';
import {
  CloseResponse,
  HistoryEntry,
  LaunchResponse,
  SystemInfo,
  View,
} from './types';

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [command, setCommand] = useState('notepad.exe');
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [closeCommand, setCloseCommand] = useState('notepad');
  const [closeResult, setCloseResult] = useState<CloseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [activeView, setActiveView] = useState<View>('control');

  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState('');
  const [deleteUserPassword, setDeleteUserPassword] = useState('');

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('http://127.0.0.1:3000/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  useEffect(() => {
    const fetchProtectedData = async () => {
      if (!token) {
        setSystem(null);
        setHistory([]);
        return;
      }

      try {
        const systemResponse = await apiFetch(
          'http://127.0.0.1:3000/system',
          { signal: AbortSignal.timeout(2000) },
          token
        );

        const systemData = await systemResponse.json();
        setSystem(systemData);

        const historyResponse = await apiFetch(
          'http://127.0.0.1:3000/history',
          { signal: AbortSignal.timeout(2000) },
          token
        );

        const historyData = await historyResponse.json();
        setHistory(historyData);
      } catch (err) {
        if (err instanceof Error) {
          handleUnauthorized(err.message);
        }
      }
    };

    const checkBackendHealth = async () => {
      try {
        const healthResponse = await fetch('http://127.0.0.1:3000/health', {
          signal: AbortSignal.timeout(2000),
        });

        const healthText = await healthResponse.text();

        if (healthText !== 'OK') {
          throw new Error('Backend health check failed');
        }

        setIsOnline(true);
        await fetchProtectedData();
      } catch {
        setIsOnline(false);
        setSystem(null);
        setHistory([]);
      }
    };

    checkBackendHealth();
    fetchProtectedData();

    const interval = setInterval(() => {
      checkBackendHealth();
      fetchProtectedData();
    }, 2000);

    return () => clearInterval(interval);
  }, [token]);

  const launchApp = async () => {
    if (!isOnline) {
      setError('Le PC est hors ligne. Impossible de lancer une application.');
      return;
    }
    if (!token) {
      setError('Vous devez être connecté.');
      return;
    }

    setLaunchResult(null);
    setError(null);

    try {
      const resp = await apiFetch(
        'http://127.0.0.1:3000/launch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        },
        token
      );

      setLaunchResult(await resp.json());
    } catch (err) {
      if (err instanceof Error) {
        handleUnauthorized(err.message);
      }
    }
  };

  const closeApp = async () => {
    if (!isOnline) {
      setError('Le PC est hors ligne. Impossible de fermer une application.');
      return;
    }
    if (!token) {
      setError('Vous devez être connecté.');
      return;
    }

    setCloseResult(null);
    setError(null);

    try {
      const resp = await apiFetch(
        'http://127.0.0.1:3000/close',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: closeCommand }),
        },
        token
      );

      setCloseResult(await resp.json());
    } catch (err) {
      if (err instanceof Error) {
        handleUnauthorized(err.message);
      }
    }
  };

  const createUser = async () => {
    if (!token) {
      setError('Vous devez être connecté.');
      return;
    }

    try {
      const resp = await apiFetch(
        'http://127.0.0.1:3000/create_user',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newUserId, password: newUserPassword }),
        },
        token
      );

      const result = await resp.json();
      if (result.success) {
        alert('Utilisateur créé avec succès');
        setNewUserId('');
        setNewUserPassword('');
      } else {
        alert("Erreur lors de la création de l'utilisateur");
      }
    } catch (err) {
      if (err instanceof Error) {
        handleUnauthorized(err.message);
      }
    }
  };

  const deleteUser = async () => {
    if (!token) {
      setError('Vous devez être connecté.');
      return;
    }

    try {
      const resp = await apiFetch(
        'http://127.0.0.1:3000/delete_user',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: deleteUserId, password: deleteUserPassword }),
        },
        token
      );

      const result = await resp.json();
      if (result.success) {
        alert('Utilisateur supprimé avec succès');
        setDeleteUserId('');
        setDeleteUserPassword('');
      } else {
        alert("Erreur lors de la suppression de l'utilisateur");
      }
    } catch (err) {
      if (err instanceof Error) {
        handleUnauthorized(err.message);
      }
    }
  };

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
          onLogout={handleLogout}
        />

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-5xl space-y-8">
            {!isOnline && (
              <div className="rounded-3xl border border-red-700 bg-red-950/80 p-6 text-center">
                <p className="text-xl font-semibold text-red-300">⚠️ PC HORS LIGNE</p>
                <p className="mt-2 text-red-200">
                  Le PC n'est pas accessible. Vérifie que le backend Rust tourne sur http://127.0.0.1:3000
                </p>
              </div>
            )}

            {activeView === 'control' && (
              <ControlSection
                isOnline={isOnline}
                system={system}
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