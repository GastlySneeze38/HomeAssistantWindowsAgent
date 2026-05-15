import { View } from '../types';

type SidebarProps = {
  activeView: View;
  onChangeView: (view: View) => void;
  isOnline: boolean;
  backendHealthy: boolean;
  onLogout: () => void;
};

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'dashboard',   label: 'Dashboard système' },
  { view: 'control',     label: "Contrôle de l'appareil" },
  { view: 'apps',        label: 'Applications' },
  { view: 'automation',  label: 'Automatisation' },
  { view: 'discord',     label: 'Configuration Discord' },
  { view: 'history',     label: 'Historique des actions' },
  { view: 'users',       label: "Gestion utilisateurs" },
];

export default function Sidebar({
  activeView,
  onChangeView,
  isOnline,
  backendHealthy,
  onLogout,
}: SidebarProps) {
  const navButtonClass = (view: View) =>
    `w-full rounded-2xl px-4 py-3 text-left font-medium transition ${
      activeView === view
        ? view === 'discord'
          ? 'bg-indigo-500 text-white'
          : view === 'automation'
          ? 'bg-orange-500 text-slate-950'
          : 'bg-cyan-500 text-slate-950'
        : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
    }`;

  return (
    <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-950 px-4 py-6 flex flex-col">
      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-900/40">
        <h1 className="text-2xl font-bold text-cyan-300">Windows Agent</h1>
        <div className="mt-4 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-sm font-semibold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isOnline ? 'PC en ligne' : 'PC hors ligne'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-6 space-y-3">
        {NAV_ITEMS.map(({ view, label }) => (
          <button key={view} onClick={() => onChangeView(view)} className={navButtonClass(view)}>
            {label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="mt-6 w-full rounded-2xl bg-slate-800 px-4 py-3 font-medium text-slate-100 transition hover:bg-slate-700"
      >
        Déconnexion
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backend health */}
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${backendHealthy ? 'bg-green-400' : 'bg-red-500'}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-300">Backend API</p>
          <p className={`text-xs ${backendHealthy ? 'text-green-400' : 'text-red-400'}`}>
            {backendHealthy ? 'http://127.0.0.1:3000 — OK' : 'Inaccessible'}
          </p>
        </div>
      </div>
    </aside>
  );
}
