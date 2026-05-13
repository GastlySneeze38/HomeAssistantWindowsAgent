import { View } from '../types';

type SidebarProps = {
  activeView: View;
  onChangeView: (view: View) => void;
  isOnline: boolean;
  onLogout: () => void;
};

export default function Sidebar({
  activeView,
  onChangeView,
  isOnline,
  onLogout,
}: SidebarProps) {
  const navButtonClass = (view: View) =>
    `w-full rounded-2xl px-4 py-3 text-left font-medium transition ${
      activeView === view
        ? 'bg-cyan-500 text-slate-950'
        : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
    }`;

  return (
    <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-950 px-4 py-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-900/40">
        <h1 className="text-2xl font-bold text-cyan-300">Windows Agent</h1>
        <div className="mt-4 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-sm font-semibold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            {isOnline ? 'PC en ligne' : 'PC hors ligne'}
          </span>
        </div>
      </div>

      <nav className="mt-6 space-y-3">
        <button onClick={() => onChangeView('control')} className={navButtonClass('control')}>
          Contrôle de l’appareil
        </button>
        <button onClick={() => onChangeView('history')} className={navButtonClass('history')}>
          Historique des actions
        </button>
        <button onClick={() => onChangeView('users')} className={navButtonClass('users')}>
          Création d’utilisateur
        </button>
      </nav>

      <button
        onClick={onLogout}
        className="mt-6 w-full rounded-2xl bg-slate-800 px-4 py-3 font-medium text-slate-100 transition hover:bg-slate-700"
      >
        Déconnexion
      </button>
    </aside>
  );
}