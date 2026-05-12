import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import { apiFetch } from './api';

type SystemInfo = {
  available_ram_gb: number;
};

type LaunchResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
};

type CloseResponse = {
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
};

type HistoryEntry = {
  id: number;
  action_type: string;
  command: string;
  success: boolean;
  error: string | null;
  timestamp: string;
};


function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [command, setCommand] = useState('notepad.exe');
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [closeCommand, setCloseCommand] = useState('notepad');
  const [closeResult, setCloseResult] = useState<CloseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  // Gestion du login
  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch("http://127.0.0.1:3000/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch(err) {
      setError('Erreur lors de l\'appel au backend :' + err);
    }

    setToken(null);
    localStorage.removeItem("token");
  };

  const handleUnautorized = (ErrMessage : string) => {
    if (ErrMessage === 'UNAUTHORIZED') {
      handleLogout();
    } else {
      setError('Erreur lors de l\'appel au backend : ' + ErrMessage);
      setIsOnline(false);
    }
  };

  // Vérifier la disponibilité du backend régulièrement

  useEffect(() => {
    const fetchProtectedData = async () => {
      if (!token) {
        setSystem(null);
        setHistory([]);
        return;
      }

      try {
        // Récupération du système
        const systemResponse = await apiFetch(
          'http://127.0.0.1:3000/system',
          { signal: AbortSignal.timeout(2000) },
          token
        );

        const systemData = await systemResponse.json();
        setSystem(systemData);

        // Récupération de l'historique
        const historyResponse = await apiFetch(
          'http://127.0.0.1:3000/history',
          { signal: AbortSignal.timeout(2000) },
          token
        );

        const historyData = await historyResponse.json();
        setHistory(historyData);

      } catch (err) {
        if (err instanceof Error) {
          handleUnautorized(err.message);
        }
      }
    };

    const checkBackendHealth = async () => {
      try {

        // Vérification du backend
        const healthResponse = await fetch(
          'http://127.0.0.1:3000/health',
          {
            signal: AbortSignal.timeout(2000),
          }
        );

        const healthText = await healthResponse.text();

        if (healthText !== 'OK') {
          throw new Error('Backend health check failed');
        }

        // Si on arrive ici, le backend est en bonne santé
        setIsOnline(true);

        // Chargement des données protégées
        await fetchProtectedData();

      } catch (err) {
        setIsOnline(false);
        setSystem(null);
        setHistory([]);

      }
    };

    // Premier appel
    checkBackendHealth();
    fetchProtectedData();

    // Vérification automatique
    const interval = setInterval(() => {

      checkBackendHealth();
      fetchProtectedData();

    }, 2000);

    return () => {
      clearInterval(interval);
    };

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
      const payload = { command };

      const resp = await apiFetch('http://127.0.0.1:3000/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, token);

      setLaunchResult(await resp.json());
    
    } catch (err) {
      if (err instanceof Error) {
        handleUnautorized(err.message);
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
      const payload = {
        command: closeCommand,
      };
      const resp = await apiFetch('http://127.0.0.1:3000/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, token);
      setCloseResult(await resp.json());
    } catch (err) {
      if (err instanceof Error) {
        handleUnautorized(err.message);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-cyan-300">Windows Agent</h1>
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`font-semibold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'PC en ligne' : 'PC hors ligne'}
              </span>
              <button onClick={handleLogout} className="ml-4 rounded-xl bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700">Déconnexion</button>
            </div>
          </div>
        </header>
        {!isOnline && (
          <div className="rounded-3xl border border-red-700 bg-red-950/80 p-6 text-center">
            <p className="text-xl font-semibold text-red-300">⚠️ PC HORS LIGNE</p>
            <p className="mt-2 text-red-200">Le PC n'est pas accessible. Vérifie que le backend Rust tourne sur http://127.0.0.1:3000</p>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Backend health</h2>
            <p className="mt-4 text-slate-300">Statut : <span className={`font-medium ${isOnline ? 'text-green-300' : 'text-red-300'}`}>{isOnline ? 'En ligne' : 'Hors ligne'}</span></p>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Mémoire disponible</h2>
            <p className="mt-4 text-slate-300">{system ? `${system.available_ram_gb.toFixed(2)} GB` : isOnline ? 'Chargement...' : 'PC hors ligne'}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
          <h2 className="text-2xl font-semibold text-slate-100">Lancer une application</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-slate-300">Application</span>
                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
            <button
              onClick={launchApp}
              className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Lancer
            </button>
          </div>
          {launchResult && (
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              <p className="text-slate-200">Succès : {launchResult.success ? 'oui' : 'non'}</p>
              {launchResult.error && <p className="mt-2 text-red-300">Erreur : {launchResult.error}</p>}
              <div className="mt-3 text-slate-300">
                <p className="font-semibold">stdout</p>
                <pre className="whitespace-pre-wrap">{launchResult.stdout || '—'}</pre>
                <p className="mt-3 font-semibold">stderr</p>
                <pre className="whitespace-pre-wrap">{launchResult.stderr || '—'}</pre>
              </div>
            </div>
          )}
          {error && <p className="mt-4 text-red-400">{error}</p>}
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
          <h2 className="text-2xl font-semibold text-slate-100">Fermer une application</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-slate-300">Application</span>
                <input
                  value={closeCommand}
                  onChange={(e) => setCloseCommand(e.target.value)}
                  placeholder="valorant, notepad, calc..."
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
            <button
              onClick={closeApp}
              className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-slate-950 transition hover:bg-red-500"
            >
              Fermer
            </button>
          </div>
          {closeResult && (
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              <p className="text-slate-200">Succès : {closeResult.success ? 'oui' : 'non'}</p>
              {closeResult.error && <p className="mt-2 text-red-300">Erreur : {closeResult.error}</p>}
              <div className="mt-3 text-slate-300">
                <p className="font-semibold">stdout</p>
                <pre className="whitespace-pre-wrap">{closeResult.stdout || '—'}</pre>
                <p className="mt-3 font-semibold">stderr</p>
                <pre className="whitespace-pre-wrap">{closeResult.stderr || '—'}</pre>
              </div>
            </div>
          )}
          {error && <p className="mt-4 text-red-400">{error}</p>}
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
          <h2 className="text-2xl font-semibold text-slate-100">Historique des actions</h2>
          <div className="mt-4 space-y-4">
            {history.length > 0 ? (
              <table className="w-full text-slate-300">
                <thead>
                  <tr>
                    <th className="border-b border-slate-700 p-2 text-left">ID</th>
                    <th className="border-b border-slate-700 p-2 text-left">Action</th>
                    <th className="border-b border-slate-700 p-2 text-left">Commande</th>
                    <th className="border-b border-slate-700 p-2 text-left">Succès</th>
                    <th className="border-b border-slate-700 p-2 text-left">Erreur</th>
                    <th className="border-b border-slate-700 p-2 text-left">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border-b border-slate-800 p-2">{entry.id}</td>
                      <td className="border-b border-slate-800 p-2">{entry.action_type}</td>
                      <td className="border-b border-slate-800 p-2">{entry.command}</td>
                      <td className="border-b border-slate-800 p-2">{entry.success ? 'Oui' : 'Non'}</td>
                      <td className="border-b border-slate-800 p-2">{entry.error || 'Aucune'}</td>
                      <td className="border-b border-slate-800 p-2">{entry.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-400">Aucune action enregistrée.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;