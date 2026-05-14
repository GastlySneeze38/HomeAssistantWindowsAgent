import { useMemo, useState } from 'react';
import { HistoryEntry } from '../../types';

type HistorySectionProps = {
  history: HistoryEntry[];
};

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(dateStr: string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (same(d, today)) return "Aujourd'hui";
  if (same(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function dayKey(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  launch: { label: 'Lancement', icon: '▶', color: 'text-cyan-400' },
  close:  { label: 'Fermeture', icon: '✕', color: 'text-red-400' },
};

function actionMeta(type: string) {
  return ACTION_LABELS[type.toLowerCase()] ?? { label: type, icon: '⚙️', color: 'text-slate-400' };
}

export default function HistorySection({ history }: HistorySectionProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'launch' | 'close' | 'success' | 'fail'>('all');
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return history.filter((e) => {
      if (filter === 'launch' && e.action_type.toLowerCase() !== 'launch') return false;
      if (filter === 'close'  && e.action_type.toLowerCase() !== 'close')  return false;
      if (filter === 'success' && !e.success) return false;
      if (filter === 'fail'    && e.success)  return false;
      if (search && !e.command.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [history, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of filtered) {
      const k = dayKey(e.timestamp);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const toggleDay = (key: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all',     label: 'Tout' },
    { key: 'launch',  label: '▶ Lancements' },
    { key: 'close',   label: '✕ Fermetures' },
    { key: 'success', label: '✓ Succès' },
    { key: 'fail',    label: '✗ Échecs' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Historique</h2>
        <p className="text-sm text-slate-400 mt-1">{history.length} action{history.length !== 1 ? 's' : ''} enregistrée{history.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full sm:w-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une commande..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs">✕</button>
          )}
        </div>
      </div>

      {/* Empty */}
      {history.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-400">Aucune action enregistrée.</p>
        </div>
      )}

      {history.length > 0 && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-400">Aucun résultat pour ces filtres.</p>
        </div>
      )}

      {/* Groups by day */}
      <div className="space-y-4">
        {grouped.map(([key, entries]) => {
          const collapsed = collapsedDays.has(key);
          const label = formatDayLabel(key);
          const successCount = entries.filter((e) => e.success).length;

          return (
            <div key={key} className="rounded-3xl border border-slate-700 bg-slate-900/80 overflow-hidden">
              {/* Day header */}
              <button
                onClick={() => toggleDay(key)}
                className="flex w-full items-center justify-between px-5 py-3 hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-3">
                  <span className={`transition-transform duration-200 text-xs text-slate-400 ${collapsed ? '' : 'rotate-90'}`}>▶</span>
                  <span className="font-semibold text-slate-200 capitalize">{label}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{entries.length}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-green-400">{successCount} ✓</span>
                  {entries.length - successCount > 0 && (
                    <span className="text-red-400">{entries.length - successCount} ✗</span>
                  )}
                </div>
              </button>

              {/* Entries */}
              {!collapsed && (
                <ul className="divide-y divide-slate-800 border-t border-slate-800">
                  {entries.map((entry) => {
                    const meta = actionMeta(entry.action_type);
                    return (
                      <li key={entry.id} className="flex items-center gap-4 px-5 py-3">
                        {/* Action icon */}
                        <span className={`shrink-0 text-sm font-bold ${meta.color}`}>{meta.icon}</span>

                        {/* Command */}
                        <span className="flex-1 font-medium text-slate-100 truncate capitalize">{entry.command}</span>

                        {/* Status badge */}
                        <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                          entry.success
                            ? 'bg-green-950/60 text-green-300 border border-green-800'
                            : 'bg-red-950/60 text-red-300 border border-red-800'
                        }`}>
                          {entry.success ? '✓' : '✗'}
                        </span>

                        {/* Error */}
                        {entry.error && (
                          <span className="shrink-0 text-xs text-red-400 truncate max-w-[180px]" title={entry.error}>
                            {entry.error}
                          </span>
                        )}

                        {/* Time */}
                        <span className="shrink-0 text-xs text-slate-500">{formatTime(entry.timestamp)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
