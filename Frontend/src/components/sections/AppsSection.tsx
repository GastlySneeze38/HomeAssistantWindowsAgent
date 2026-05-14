import { useState, useMemo } from 'react';
import { AppEntry } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';

type AppsSectionProps = {
  apps: AppEntry[];
  onAdd: (name: string, path: string, args: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onLaunch: (name: string) => void;
};

function appIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('chrome') || n.includes('firefox') || n.includes('edge')) return '🌐';
  if (n.includes('code') || n.includes('vscode')) return '💻';
  if (n.includes('steam') || n.includes('valorant') || n.includes('game')) return '🎮';
  if (n.includes('spotify') || n.includes('music')) return '🎵';
  if (n.includes('discord')) return '💬';
  if (n.includes('vlc') || n.includes('video')) return '🎬';
  if (n.includes('notepad') || n.includes('word') || n.includes('excel')) return '📄';
  if (n.includes('explorer')) return '📁';
  return '⚙️';
}

export default function AppsSection({ apps, onAdd, onDelete, onLaunch }: AppsSectionProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [args, setArgs] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { favorites, toggle, isFavorite } = useFavorites();

  const favApps = useMemo(() => apps.filter((a) => isFavorite(a.name)), [apps, favorites]);
  const filtered = useMemo(
    () => apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [apps, search]
  );

  const handleAdd = async () => {
    if (!name.trim() || !path.trim()) { setFormError('Le nom et le chemin sont obligatoires.'); return; }
    setFormError(null);
    setAdding(true);
    try {
      await onAdd(name.trim(), path.trim(), args.trim());
      setName(''); setPath(''); setArgs('');
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setAdding(false);
    }
  };

  const AppCard = ({ app }: { app: AppEntry }) => (
    <div className="group relative flex flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 transition hover:border-slate-500 hover:bg-slate-900">
      {/* Star */}
      <button
        onClick={() => toggle(app.name)}
        title={isFavorite(app.name) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={`absolute top-3 right-3 text-base transition ${
          isFavorite(app.name) ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
        }`}
      >
        {isFavorite(app.name) ? '★' : '☆'}
      </button>

      {/* Icon + name */}
      <div className="flex items-center gap-3 pr-6">
        <span className="text-2xl select-none">{appIcon(app.name)}</span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-100 capitalize truncate">{app.name}</p>
          <p className="text-xs text-slate-500 truncate" title={app.path}>{app.path}</p>
        </div>
      </div>

      {app.args && (
        <div className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-slate-400 font-mono truncate" title={app.args}>
          {app.args}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onLaunch(app.name)}
          className="flex-1 rounded-xl bg-cyan-500 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          ▶ Lancer
        </button>
        {confirmDelete === app.name ? (
          <div className="flex gap-1">
            <button
              onClick={() => { onDelete(app.name); setConfirmDelete(null); }}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-red-500"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(app.name)}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:border-red-700 hover:text-red-400"
            title="Supprimer"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Applications</h2>
          <p className="text-sm text-slate-400 mt-1">
            {apps.length} enregistrée{apps.length !== 1 ? 's' : ''} · {favApps.length} favori{favApps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <span className="text-lg">{showForm ? '✕' : '+'}</span>
          {showForm ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <section className="rounded-3xl border border-cyan-700/50 bg-cyan-950/20 p-6">
          <h3 className="text-lg font-semibold text-cyan-300 mb-4">Nouvelle application</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-slate-300 text-sm">Nom *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="chrome"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400 transition" />
            </label>
            <label className="block">
              <span className="text-slate-300 text-sm">Chemin *</span>
              <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Program Files\...\app.exe"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400 transition" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-slate-300 text-sm">Arguments <span className="text-slate-500">(optionnel)</span></span>
              <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="--flag=value"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400 transition" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
          <button onClick={handleAdd} disabled={adding}
            className="mt-4 rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {adding ? 'Ajout en cours...' : 'Enregistrer'}
          </button>
        </section>
      )}

      {/* ── Favorites bar ── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-yellow-400 text-sm">★</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Favoris</span>
          {favApps.length === 0 && (
            <span className="text-xs text-slate-600 ml-1">— survolez une carte et cliquez ☆ pour épingler</span>
          )}
        </div>
        {favApps.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favApps.map((app) => <AppCard key={app.id} app={app} />)}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">Aucun favori pour l'instant.</p>
        )}
      </div>

      {/* ── All apps collapsed ── */}
      <div>
        <button
          onClick={() => setAllOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          <span className="flex items-center gap-2">
            <span className={`transition-transform duration-200 ${allOpen ? 'rotate-90' : ''}`}>▶</span>
            Toutes les applications
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{apps.length}</span>
          </span>
          <span className="text-slate-500 text-xs">{allOpen ? 'Réduire' : 'Afficher'}</span>
        </button>

        {allOpen && (
          <div className="mt-4 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 pl-11 pr-4 py-3 text-slate-100 outline-none focus:border-cyan-400 transition" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">✕</button>
              )}
            </div>

            {apps.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-slate-400">Aucune application enregistrée.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
                <p className="text-slate-400">Aucun résultat pour "<span className="text-slate-200">{search}</span>"</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((app) => <AppCard key={app.id} app={app} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
