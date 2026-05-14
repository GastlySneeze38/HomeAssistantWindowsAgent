import { useState } from 'react';
import { AppEntry } from '../../types';

type AppsSectionProps = {
  apps: AppEntry[];
  onAdd: (name: string, path: string, args: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onLaunch: (name: string) => void;
};

export default function AppsSection({ apps, onAdd, onDelete, onLaunch }: AppsSectionProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [args, setArgs] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim() || !path.trim()) {
      setError('Le nom et le chemin sont obligatoires.');
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await onAdd(name.trim(), path.trim(), args.trim());
      setName('');
      setPath('');
      setArgs('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {/* Registered apps list */}
      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-semibold text-slate-100">Applications enregistrées</h2>
        {apps.length === 0 ? (
          <p className="mt-4 text-slate-400">Aucune application enregistrée.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {apps.map((app) => (
              <li
                key={app.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100 capitalize">{app.name}</p>
                  <p className="truncate text-xs text-slate-400">{app.path}</p>
                  {app.args && (
                    <p className="text-xs text-slate-500">args: {app.args}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => onLaunch(app.name)}
                    className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Lancer
                  </button>
                  <button
                    onClick={() => onDelete(app.name)}
                    className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add app */}
      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-semibold text-slate-100">Ajouter une application</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-slate-300">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="chrome"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block">
            <span className="text-slate-300">Chemin</span>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Program Files\Google\Chrome\chrome.exe"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-300">Arguments (optionnel)</span>
            <input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="--launch-product=valorant --launch-patchline=live"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-4 rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {adding ? 'Ajout...' : 'Ajouter'}
        </button>
      </section>
    </>
  );
}
