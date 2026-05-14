import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import { RgbDevice } from '../../types';

type Props = {
  token: string;
  onUnauthorized: () => void;
};

type RgbStatus = 'idle' | 'loading' | 'success' | 'error';

const PRESETS: { label: string; color: string }[] = [
  { label: 'Rouge',   color: '#ff0000' },
  { label: 'Vert',    color: '#00ff00' },
  { label: 'Bleu',    color: '#0000ff' },
  { label: 'Cyan',    color: '#00ffff' },
  { label: 'Violet',  color: '#a855f7' },
  { label: 'Orange',  color: '#ff6600' },
  { label: 'Rose',    color: '#ff00aa' },
  { label: 'Blanc',   color: '#ffffff' },
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export default function RgbSection({ token, onUnauthorized }: Props) {
  const [devices, setDevices]       = useState<RgbDevice[]>([]);
  const [devStatus, setDevStatus]   = useState<'loading' | 'ok' | 'error'>('loading');
  const [devError, setDevError]     = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [color, setColor]           = useState('#ff0000');
  const [status, setStatus]         = useState<RgbStatus>('idle');
  const [statusMsg, setStatusMsg]   = useState('');

  const fetchDevices = useCallback(async () => {
    setDevStatus('loading');
    setDevError('');
    try {
      const res = await apiFetch('http://127.0.0.1:3000/rgb/devices', {}, token);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDevError(json.error ?? `Erreur HTTP ${res.status}`);
        setDevStatus('error');
        return;
      }
      const json = await res.json();
      setDevices(json.devices ?? []);
      setDevStatus('ok');
    } catch (e) {
      if (e instanceof Error && e.message === 'UNAUTHORIZED') { onUnauthorized(); return; }
      setDevStatus('error');
    }
  }, [token]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const applyColor = async (hex: string) => {
    setColor(hex);
    await sendColor(hex);
  };

  const sendColor = async (hex: string) => {
    setStatus('loading');
    const { r, g, b } = hexToRgb(hex);
    try {
      const res = await apiFetch('http://127.0.0.1:3000/rgb/color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r, g, b, device_id: selectedDevice }),
      }, token);
      const json = await res.json();
      if (json.success) { setStatus('success'); setStatusMsg('Couleur appliquée'); }
      else { setStatus('error'); setStatusMsg(json.error ?? 'Erreur inconnue'); }
    } catch (e) {
      if (e instanceof Error && e.message === 'UNAUTHORIZED') { onUnauthorized(); return; }
      setStatus('error');
      setStatusMsg('Impossible de contacter OpenRGB');
    }
  };

  const turnOff = async () => {
    setStatus('loading');
    try {
      const res = await apiFetch('http://127.0.0.1:3000/rgb/off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: selectedDevice }),
      }, token);
      const json = await res.json();
      if (json.success) { setStatus('success'); setStatusMsg('RGB éteint'); }
      else { setStatus('error'); setStatusMsg(json.error ?? 'Erreur inconnue'); }
    } catch (e) {
      if (e instanceof Error && e.message === 'UNAUTHORIZED') { onUnauthorized(); return; }
      setStatus('error');
      setStatusMsg('Impossible de contacter OpenRGB');
    }
  };

  const deviceLabel = selectedDevice === null
    ? 'Tous les appareils'
    : devices.find((d) => d.id === selectedDevice)?.name ?? `Device ${selectedDevice}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-300">Contrôle RGB</h2>
        <button
          onClick={fetchDevices}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition"
        >
          ↻ Rafraîchir
        </button>
      </div>

      {/* OpenRGB status */}
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
        devStatus === 'ok' ? 'border-green-800/50 bg-green-950/20' :
        devStatus === 'error' ? 'border-red-800/50 bg-red-950/20' :
        'border-slate-700 bg-slate-900/40'
      }`}>
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          devStatus === 'ok' ? 'bg-green-400' :
          devStatus === 'error' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'
        }`} />
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {devStatus === 'loading' && 'Connexion à OpenRGB...'}
            {devStatus === 'ok' && `OpenRGB connecté — ${devices.length} appareil${devices.length !== 1 ? 's' : ''} détecté${devices.length !== 1 ? 's' : ''}`}
            {devStatus === 'error' && 'OpenRGB inaccessible'}
          </p>
          {devStatus === 'error' && (
            <p className="text-xs text-red-400 mt-0.5">
              {devError || 'OpenRGB doit être lancé avec le SDK server activé (port 6742).'}
            </p>
          )}
        </div>
      </div>

      {devStatus === 'ok' && (
        <>
          {/* Device selector */}
          {devices.length > 0 && (
            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Appareils</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedDevice(null)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                    selectedDevice === null
                      ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Tous ({devices.length})
                </button>
                {devices.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDevice(d.id === selectedDevice ? null : d.id)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                      selectedDevice === d.id
                        ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {d.name}
                    <span className="ml-1.5 text-xs opacity-50">{d.led_count} LEDs</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Cible : <span className="text-slate-300">{deviceLabel}</span></p>
            </div>
          )}

          {/* Color picker + presets */}
          <div className="rounded-3xl border border-purple-800/40 bg-purple-950/10 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-purple-300">Couleur</h3>

            {/* Native color picker */}
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <div
                  className="h-14 w-14 rounded-2xl border-2 border-slate-600 shadow-lg transition hover:scale-105"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  onBlur={(e) => sendColor(e.target.value)}
                  className="sr-only"
                />
              </label>
              <div>
                <p className="text-slate-300 text-sm font-mono">{color.toUpperCase()}</p>
                <p className="text-slate-500 text-xs mt-0.5">Cliquez pour choisir</p>
              </div>
              <button
                onClick={() => sendColor(color)}
                disabled={status === 'loading'}
                className="ml-auto rounded-2xl bg-purple-600 px-6 py-2.5 font-semibold text-slate-100 hover:bg-purple-500 disabled:opacity-40 transition"
              >
                Appliquer
              </button>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Couleurs rapides</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.color}
                    onClick={() => applyColor(p.color)}
                    title={p.label}
                    className="group flex flex-col items-center gap-1"
                  >
                    <div
                      className={`h-9 w-9 rounded-xl border-2 transition hover:scale-110 ${
                        color === p.color ? 'border-white scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Turn off */}
            <button
              onClick={turnOff}
              disabled={status === 'loading'}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-3 font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              ⬛ Éteindre le RGB
            </button>
          </div>

          {/* Feedback */}
          {status !== 'idle' && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              status === 'loading' ? 'border-slate-700 text-slate-400' :
              status === 'success' ? 'border-green-700 bg-green-950/40 text-green-300' :
              'border-red-700 bg-red-950/40 text-red-300'
            }`}>
              {status === 'loading' && '⏳ Application en cours...'}
              {status === 'success' && `✓ ${statusMsg}`}
              {status === 'error' && `✗ ${statusMsg}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
