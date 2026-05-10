import { useEffect, useState } from 'react';

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

function App() {
  const [health, setHealth] = useState<string>('unknown');
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [command, setCommand] = useState('notepad.exe');
  const [args, setArgs] = useState('');
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [closeCommand, setCloseCommand] = useState('notepad');
  const [closeResult, setCloseResult] = useState<CloseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Vérifier la disponibilité du backend régulièrement
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const healthResp = await fetch('http://127.0.0.1:3000/health', {
          signal: AbortSignal.timeout(2000),
        });
        const healthText = await healthResp.text();
        setHealth(healthText);
        setIsOnline(true);

        const systemResp = await fetch('http://127.0.0.1:3000/system', {
          signal: AbortSignal.timeout(2000),
        });
        setSystem(await systemResp.json());
      } catch (err) {
        setIsOnline(false);
        setHealth('Hors ligne');
        setSystem(null);
      }
    };

    // Vérifier immédiatement au chargement
    checkBackendHealth();

    // Puis vérifier toutes les 2 secondes
    const interval = setInterval(checkBackendHealth, 2000);
    return () => clearInterval(interval);
  }, []);

  const launchApp = async () => {
    if (!isOnline) {
      setError('Le PC est hors ligne. Impossible de lancer une application.');
      return;
    }

    setLaunchResult(null);
    setError(null);

    try {
      const payload = {
        command,
        args: args.trim() ? args.split(' ') : [],
      };

      const resp = await fetch('http://127.0.0.1:3000/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      setLaunchResult(await resp.json());
    } catch (err) {
      setError('Erreur lors de l\'appel au backend de lancement');
      setIsOnline(false);
    }
  };

  const closeApp = async () => {
    if (!isOnline) {
      setError('Le PC est hors ligne. Impossible de fermer une application.');
      return;
    }

    setCloseResult(null);
    setError(null);

    try {
      const payload = {
        command: closeCommand,
      };

      const resp = await fetch('http://127.0.0.1:3000/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      setCloseResult(await resp.json());
    } catch (err) {
      setError('Erreur lors de l\'appel au backend de fermeture');
      setIsOnline(false);
    }
  };

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
      </div>
    </div>
  );
}

export default App;
