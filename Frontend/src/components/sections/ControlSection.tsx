import { useState, useMemo } from 'react';
import { AppEntry, CloseResponse, LaunchResponse } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';

type ControlSectionProps = {
  isOnline: boolean;
  apps: AppEntry[];
  command: string;
  setCommand: (value: string) => void;
  closeCommand: string;
  setCloseCommand: (value: string) => void;
  launchResult: LaunchResponse | null;
  closeResult: CloseResponse | null;
  error: string | null;
  onLaunch: () => void;
  onClose: () => void;
};

type Tab = 'launch' | 'close';

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

export default function ControlSection({
  isOnline,
  apps,
  command,
  setCommand,
  closeCommand,
  setCloseCommand,
  launchResult,
  closeResult,
  error,
  onLaunch,
  onClose,
}: ControlSectionProps) {
  const [tab, setTab] = useState<Tab>('launch');
  const [search, setSearch] = useState('');
  const [allOpen, setAllOpen] = useState(false);
  const { favorites, toggle, isFavorite } = useFavorites();

  const isLaunch = tab === 'launch';
  const activeValue = isLaunch ? command : closeCommand;
  const setActiveValue = isLaunch ? setCommand : setCloseCommand;
  const result = isLaunch ? launchResult : closeResult;

  const favApps = useMemo(() => apps.filter((a) => isFavorite(a.name)), [apps, favorites]);
  const filtered = useMemo(
    () => apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [apps, search]
  );

  const AppChip = ({ app, accent }: { app: AppEntry; accent: 'cyan' | 'red' }) => {
    const isSelected = activeValue === app.name;
    const accentSelected = accent === 'cyan'
      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
      : 'border-red-400 bg-red-500/20 text-red-200';
    return (
      <div className="relative group/chip">
        <button
          onClick={() => setActiveValue(isSelected ? '' : app.name)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 pr-8 text-sm font-medium transition ${
            isSelected
              ? accentSelected
              : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
          }`}
        >
          <span>{appIcon(app.name)}</span>
          <span className="capitalize">{app.name}</span>
          {isSelected && <span className="text-xs opacity-60">✓</span>}
        </button>
        {/* Star toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); toggle(app.name); }}
          title={isFavorite(app.name) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-0 group-hover/chip:opacity-100 transition"
        >
          {isFavorite(app.name) ? '★' : '☆'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1 w-fit gap-1">
        <button
          onClick={() => setTab('launch')}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
            tab === 'launch' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ▶ Lancer
        </button>
        <button
          onClick={() => setTab('close')}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
            tab === 'close' ? 'bg-red-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✕ Fermer
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400">{isOnline ? 'Agent connecté' : 'Agent hors ligne'}</span>
      </div>

      {/* ── Favorites bar ── */}
      {apps.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-sm">★</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Favoris</span>
            {favApps.length === 0 && (
              <span className="text-xs text-slate-600 ml-1">— survolez une app et cliquez ☆ pour épingler</span>
            )}
          </div>
          {favApps.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {favApps.map((app) => (
                <AppChip key={app.id} app={app} accent={isLaunch ? 'cyan' : 'red'} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic">Aucun favori pour l'instant.</p>
          )}
        </div>
      )}

      {/* ── Main panel ── */}
      <section className={`rounded-3xl border p-6 ${isLaunch ? 'border-cyan-800/50 bg-cyan-950/10' : 'border-red-800/50 bg-red-950/10'}`}>
        <h2 className={`text-xl font-semibold mb-4 ${isLaunch ? 'text-cyan-300' : 'text-red-300'}`}>
          {isLaunch ? '▶ Lancer une application' : '✕ Fermer une application'}
        </h2>

        {/* All apps — collapsed by default */}
        {apps.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setAllOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition mb-2"
            >
              <span className={`transition-transform duration-200 ${allOpen ? 'rotate-90' : ''}`}>▶</span>
              <span>Toutes les applications</span>
              <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{apps.length}</span>
            </button>

            {allOpen && (
              <div className="space-y-3 pl-4 border-l border-slate-700">
                {/* Search */}
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 transition"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs">✕</button>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Aucune application correspondante.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filtered.map((app) => (
                      <AppChip key={app.id} app={app} accent={isLaunch ? 'cyan' : 'red'} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manual input */}
        <div className="space-y-3 mt-2">
          <label className="block max-w-xl">
            <span className="text-slate-300 text-sm">
              {isLaunch ? "Commande ou nom d'application" : 'Nom du processus à fermer'}
            </span>
            <input
              value={activeValue}
              onChange={(e) => setActiveValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (isLaunch ? onLaunch() : onClose())}
              placeholder={isLaunch ? 'notepad, valorant, chrome...' : 'valorant.exe, notepad...'}
              className={`mt-2 w-full rounded-2xl border bg-slate-950 px-4 py-3 text-slate-100 outline-none transition ${
                isLaunch ? 'border-slate-700 focus:border-cyan-400' : 'border-slate-700 focus:border-red-400'
              }`}
            />
          </label>

          <button
            onClick={isLaunch ? onLaunch : onClose}
            disabled={!isOnline || !activeValue.trim()}
            className={`rounded-2xl px-8 py-3 font-semibold transition disabled:opacity-40 ${
              isLaunch ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-red-600 text-slate-100 hover:bg-red-500'
            }`}
          >
            {isLaunch ? '▶ Lancer' : '✕ Fermer'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-5 rounded-2xl border p-4 ${result.success ? 'border-green-700 bg-green-950/40' : 'border-red-700 bg-red-950/40'}`}>
            <p className={`font-semibold ${result.success ? 'text-green-300' : 'text-red-300'}`}>
              {result.success
                ? isLaunch ? '✓ Lancé avec succès' : '✓ Application fermée'
                : isLaunch ? '✗ Échec du lancement' : '✗ Échec de la fermeture'}
            </p>
            {result.error && <p className="mt-1 text-sm text-red-300">{result.error}</p>}
            {(result.stdout || result.stderr) && (
              <div className="mt-3 text-xs text-slate-400 font-mono">
                {result.stdout && <pre className="whitespace-pre-wrap">{result.stdout}</pre>}
                {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      </section>
    </div>
  );
}
