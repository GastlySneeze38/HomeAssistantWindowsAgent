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
  const [command, setCommand] = useState('notepad.exe');
  const [args, setArgs] = useState('');
  const [launchResult, setLaunchResult] = useState<LaunchResponse | null>(null);
  const [closeCommand, setCloseCommand] = useState('notepad');
  const [closeResult, setCloseResult] = useState<CloseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBackend() {
      try {
        const healthResp = await fetch('http://127.0.0.1:3000/health');
        const healthText = await healthResp.text();
        setHealth(healthText);

        const systemResp = await fetch('http://127.0.0.1:3000/system');
        setSystem(await systemResp.json());
      } catch (err) {
        setError('Impossible de joindre le backend Rust. Vérifie qu\'il tourne sur http://127.0.0.1:3000');
      }
    }

    fetchBackend();
  }, []);

  const launchApp = async () => {
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
    }
  };

  const closeApp = async () => {
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
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40 backdrop-blur-md">
          <h1 className="text-4xl font-bold text-cyan-300">Windows Agent</h1>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Backend health</h2>
            <p className="mt-4 text-slate-300">Statut : <span className="font-medium text-cyan-300">{health}</span></p>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-2xl font-semibold text-slate-100">Mémoire disponible</h2>
            <p className="mt-4 text-slate-300">{system ? `${system.available_ram_gb.toFixed(2)} GB` : 'Chargement...'}</p>
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
