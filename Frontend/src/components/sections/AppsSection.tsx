import { useState, useMemo, useRef } from 'react';
import { AppEntry } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';

type ScanStep = 'scanning_registry' | 'scanning_startmenu' | 'scanning_launchers' | 'inserting' | 'done' | null;

type ScanState = {
  step: ScanStep;
  total?: number;
  inserted?: number;
  updated?: number;
};

type AddMode = 'choice' | 'manual' | 'scan';

type AppsSectionProps = {
  apps: AppEntry[];
  token: string | null;
  onAdd: (name: string, path: string, args: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onLaunch: (name: string) => void;
  onRefreshApps: () => void;
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

const STEP_LABELS: Record<string, string> = {
  scanning_registry: 'Recherche dans le registre Windows…',
  scanning_startmenu: 'Recherche dans le menu Démarrer…',
  scanning_launchers: 'Recherche dans les launchers (Steam, Epic, GOG)…',
  inserting: 'Insertion dans la base de données…',
  done: 'Terminé !',
};

export default function AppsSection({ apps, token, onAdd, onDelete, onLaunch, onRefreshApps }: AppsSectionProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [args, setArgs] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('choice');
  const [allOpen, setAllOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ step: null });
  const abortRef = useRef<AbortController | null>(null);
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
      setAddMode('choice');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setAdding(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setAddMode('choice');
    setScanState({ step: null });
    abortRef.current?.abort();
  };

  const startScan = async () => {
    if (!token) return;
    setAddMode('scan');
    setScanState({ step: 'scanning_registry' });

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('http://localhost:3000/apps/scan', {
        headers: { Authorization: `Bearer ${token}` },
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setScanState({ step: null });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as ScanState & { step: ScanStep };
            setScanState(ev);
            if (ev.step === 'done') {
              onRefreshApps();
            }
          } catch {
            // malformed event, ignore
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setScanState({ step: null });
      }
    }
  };

  const AppCard = ({ app }: { app: AppEntry }) => (
    <div className="group relative flex flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 transition hover:border-slate-500 hover:bg-slate-900">
      <button
        onClick={() => toggle(app.name)}
        title={isFavorite(app.name) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={`absolute top-3 right-3 text-base transition ${
          isFavorite(app.name) ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
        }`}
      >
        {isFavorite(app.name) ? '★' : '☆'}
      </button>

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
          onClick={() => showForm ? handleCloseForm() : setShowForm(true)}
          className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <span className="text-lg">{showForm ? '✕' : '+'}</span>
          {showForm ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* Add mode: choice */}
      {showForm && addMode === 'choice' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Manual */}
          <button
            onClick={() => setAddMode('manual')}
            className="text-left rounded-3xl border border-cyan-700/50 bg-cyan-950/20 p-6 transition hover:border-cyan-500 hover:bg-cyan-950/40"
          >
            <p className="text-3xl mb-3">✏️</p>
            <p className="text-lg font-semibold text-cyan-300 mb-1">Ajouter manuellement</p>
            <p className="text-sm text-slate-400">Saisir le nom et le chemin de l'exécutable.</p>
          </button>

          {/* Import from PC */}
          <button
            onClick={startScan}
            className="text-left rounded-3xl border border-violet-700/50 bg-violet-950/20 p-6 transition hover:border-violet-500 hover:bg-violet-950/40"
          >
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-lg font-semibold text-violet-300 mb-1">Importer depuis le PC</p>
            <p className="text-sm text-slate-400">
              Détecte automatiquement les applications installées (registre Windows + Menu Démarrer).
            </p>
          </button>
        </div>
      )}

      {/* Manual add form */}
      {showForm && addMode === 'manual' && (
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
          <div className="mt-4 flex gap-3">
            <button onClick={() => setAddMode('choice')}
              className="rounded-2xl border border-slate-600 px-5 py-3 text-sm text-slate-300 transition hover:bg-slate-800">
              ← Retour
            </button>
            <button onClick={handleAdd} disabled={adding}
              className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
              {adding ? 'Ajout en cours…' : 'Enregistrer'}
            </button>
          </div>
        </section>
      )}

      {/* Scan progress */}
      {showForm && addMode === 'scan' && (
        <section className="rounded-3xl border border-violet-700/50 bg-violet-950/20 p-6">
          <h3 className="text-lg font-semibold text-violet-300 mb-5">Importation des applications</h3>

          <div className="space-y-3">
            {(['scanning_registry', 'scanning_startmenu', 'scanning_launchers', 'inserting', 'done'] as ScanStep[]).map((s) => {
              const steps: ScanStep[] = ['scanning_registry', 'scanning_startmenu', 'scanning_launchers', 'inserting', 'done'];
              const currentIdx = steps.indexOf(scanState.step ?? 'scanning_registry');
              const thisIdx = steps.indexOf(s!);
              const isDone = thisIdx < currentIdx || scanState.step === 'done';
              const isActive = scanState.step === s;

              return (
                <div key={s} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                  isActive ? 'bg-violet-900/40 border border-violet-600/40' :
                  isDone ? 'opacity-60' : 'opacity-30'
                }`}>
                  <span className="text-lg w-6 text-center">
                    {isDone ? '✓' : isActive ? (
                      <span className="inline-block animate-spin">⟳</span>
                    ) : '○'}
                  </span>
                  <span className={`text-sm font-medium ${isActive ? 'text-violet-200' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {STEP_LABELS[s!]}
                    {s === 'inserting' && scanState.total !== undefined && (
                      <span className="ml-1 text-violet-400">({scanState.total} apps trouvées)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {scanState.step === 'done' && (
            <div className="mt-5 rounded-2xl bg-violet-900/30 border border-violet-600/30 px-5 py-4">
              <p className="text-violet-200 font-semibold">
                {scanState.inserted} ajoutée{(scanState.inserted ?? 0) > 1 ? 's' : ''} ·{' '}
                {scanState.updated} mise{(scanState.updated ?? 0) > 1 ? 's' : ''} à jour ·{' '}
                {scanState.total} au total
              </p>
              <button
                onClick={handleCloseForm}
                className="mt-3 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Fermer
              </button>
            </div>
          )}
        </section>
      )}

      {/* Favorites bar */}
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

      {/* All apps collapsed */}
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
            <div className="relative max-w-sm">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
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
