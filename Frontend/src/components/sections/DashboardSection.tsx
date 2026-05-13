import { DashboardData } from '../../types';

type Props = { data: DashboardData | null };

function UsageBar({ value }: { value: number }) {
  const color =
    value > 85 ? 'bg-red-500' : value > 60 ? 'bg-yellow-400' : 'bg-cyan-400';
  return (
    <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function DashboardSection({ data }: Props) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        En attente des données système…
      </div>
    );
  }

  const { cpu, ram, gpu, network, active_windows, uptime_seconds } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard système</h1>

      {/* Ligne 1 — CPU / RAM / GPU */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {/* CPU */}
        <Card title="CPU">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-cyan-300">{cpu.usage_percent.toFixed(1)}%</span>
            <span className="text-slate-500 text-sm">{cpu.core_count} cœurs · {cpu.frequency_mhz} MHz</span>
          </div>
          <UsageBar value={cpu.usage_percent} />
          {cpu.temperature_celsius !== null && (
            <Stat label="Température" value={`${cpu.temperature_celsius?.toFixed(0)} °C`} />
          )}
          <Stat label="Uptime" value={formatUptime(uptime_seconds)} />
        </Card>

        {/* RAM */}
        <Card title="Mémoire RAM">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-cyan-300">{ram.usage_percent.toFixed(1)}%</span>
            <span className="text-slate-500 text-sm">{ram.used_gb.toFixed(1)} / {ram.total_gb.toFixed(1)} Go</span>
          </div>
          <UsageBar value={ram.usage_percent} />
          <Stat label="Disponible" value={`${ram.available_gb.toFixed(1)} Go`} />
        </Card>

        {/* GPU */}
        {gpu ? (
          <Card title="GPU">
            <p className="text-xs text-slate-400 truncate">{gpu.name}</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-cyan-300">{gpu.usage_percent}%</span>
              <span className="text-slate-500 text-sm">{gpu.temperature_celsius} °C</span>
            </div>
            <UsageBar value={gpu.usage_percent} />
            <Stat label="VRAM" value={`${gpu.vram_used_mb} / ${gpu.vram_total_mb} Mo`} />
          </Card>
        ) : (
          <Card title="GPU">
            <p className="text-slate-500 text-sm">Aucun GPU NVIDIA détecté</p>
          </Card>
        )}
      </div>

      {/* Réseau */}
      <Card title="Réseau">
        <div className="divide-y divide-slate-800">
          {network.map((n) => (
            <div key={n.name} className="flex justify-between items-center py-2 text-sm">
              <span className="text-slate-300 font-medium truncate max-w-[40%]">{n.name}</span>
              <div className="flex gap-4 text-slate-400">
                <span>↓ {n.received_kb.toFixed(0)} Ko</span>
                <span>↑ {n.transmitted_kb.toFixed(0)} Ko</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fenêtres actives */}
      {active_windows.length > 0 && (
        <Card title={`Fenêtres actives (${active_windows.length})`}>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {active_windows.map((w, i) => (
              <li key={i} className="text-sm text-slate-300 truncate py-0.5 border-b border-slate-800 last:border-0">
                {w.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
