import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppEntry, CloseResponse, LaunchResponse, RgbDevice } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';
import { apiFetch } from '../../api';

type DiscordRole   = { id: number; guild_id: string; role_id: string; name: string };
type DiscordMember = { id: number; user_id: string; name: string };

type ControlSectionProps = {
  isOnline: boolean;
  token: string;
  onUnauthorized: () => void;
  apps: AppEntry[];
  command: string;
  setCommand: (v: string) => void;
  closeCommand: string;
  setCloseCommand: (v: string) => void;
  launchResult: LaunchResponse | null;
  closeResult: CloseResponse | null;
  error: string | null;
  onLaunch: () => void;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const RGB_PRESETS = [
  { label: 'Rouge',  color: '#ff0000' },
  { label: 'Vert',   color: '#00ff00' },
  { label: 'Bleu',   color: '#0000ff' },
  { label: 'Cyan',   color: '#00ffff' },
  { label: 'Violet', color: '#a855f7' },
  { label: 'Orange', color: '#ff6600' },
  { label: 'Rose',   color: '#ff00aa' },
  { label: 'Blanc',  color: '#ffffff' },
];

// ── CollapsibleCard ───────────────────────────────────────────────────────────

type CardAccent = 'cyan' | 'red' | 'purple' | 'indigo' | 'green' | 'slate';

const ACCENT: Record<CardAccent, { border: string; bg: string; title: string; hover: string }> = {
  cyan:   { border: 'border-cyan-800/50',   bg: 'bg-cyan-950/10',   title: 'text-cyan-300',   hover: 'hover:bg-cyan-950/20' },
  red:    { border: 'border-red-800/50',    bg: 'bg-red-950/10',    title: 'text-red-300',    hover: 'hover:bg-red-950/20' },
  purple: { border: 'border-purple-800/50', bg: 'bg-purple-950/10', title: 'text-purple-300', hover: 'hover:bg-purple-950/20' },
  indigo: { border: 'border-indigo-800/50', bg: 'bg-indigo-950/10', title: 'text-indigo-300', hover: 'hover:bg-indigo-950/20' },
  green:  { border: 'border-green-800/50',  bg: 'bg-green-950/10',  title: 'text-green-300',  hover: 'hover:bg-green-950/20' },
  slate:  { border: 'border-slate-700',     bg: 'bg-slate-900/60',  title: 'text-slate-200',  hover: 'hover:bg-slate-800/40' },
};

function CollapsibleCard({ title, accent = 'slate', defaultOpen = true, badge, children }: {
  title: string; accent?: CardAccent; defaultOpen?: boolean;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const c = ACCENT[accent];
  return (
    <div className={`rounded-3xl border overflow-hidden ${c.border} ${c.bg}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-6 py-4 transition ${c.hover}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-90' : ''} ${c.title}`}>▶</span>
          <span className={`font-semibold ${c.title}`}>{title}</span>
        </div>
        {badge && <div className="flex items-center gap-2 text-xs">{badge}</div>}
      </button>
      {open && <div className="px-6 pb-6 border-t border-white/5 pt-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── ResultBanner ──────────────────────────────────────────────────────────────

function ResultBanner({ result, successMsg, failMsg }: {
  result: { success: boolean; error?: string | null; stdout?: string; stderr?: string } | null;
  successMsg: string; failMsg: string;
}) {
  if (!result) return null;
  return (
    <div className={`rounded-2xl border p-3 ${result.success ? 'border-green-700 bg-green-950/40' : 'border-red-700 bg-red-950/40'}`}>
      <p className={`font-semibold text-sm ${result.success ? 'text-green-300' : 'text-red-300'}`}>
        {result.success ? `✓ ${successMsg}` : `✗ ${failMsg}`}
      </p>
      {result.error && <p className="mt-1 text-xs text-red-300">{result.error}</p>}
      {(result.stdout || result.stderr) && (
        <div className="mt-2 text-xs font-mono text-slate-400 space-y-1">
          {result.stdout && <pre className="whitespace-pre-wrap">{result.stdout}</pre>}
          {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
        </div>
      )}
    </div>
  );
}

const API = 'http://127.0.0.1:3000';

export default function ControlSection({
  isOnline, token, onUnauthorized,
  apps, command, setCommand, closeCommand, setCloseCommand,
  launchResult, closeResult, error,
  onLaunch, onClose,
}: ControlSectionProps) {
  const api = useCallback((path: string, opts: RequestInit = {}) =>
    apiFetch(`${API}${path}`, opts, token).catch((e: Error) => {
      if (e.message === 'UNAUTHORIZED') onUnauthorized();
      throw e;
    }), [token]);

  const { favorites, toggle, isFavorite } = useFavorites();

  // ── Apps card : Lancer / Fermer tabs ─────────────────────────────────────────
  const [appTab, setAppTab] = useState<'launch' | 'close'>('launch');
  const [search, setSearch] = useState('');
  const [allOpen, setAllOpen] = useState(false);

  const isLaunch = appTab === 'launch';
  const activeValue = isLaunch ? command : closeCommand;
  const setActiveValue = isLaunch ? setCommand : setCloseCommand;

  const favApps = useMemo(() => apps.filter(a => isFavorite(a.name)), [apps, favorites]);
  const filtered = useMemo(
    () => apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase())),
    [apps, search]
  );

  // reset search when switching tab
  const switchAppTab = (t: 'launch' | 'close') => { setAppTab(t); setSearch(''); setAllOpen(false); };

  function AppChip({ app }: { app: AppEntry }) {
    const isSelected = activeValue === app.name;
    const sel = isLaunch
      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
      : 'border-red-400 bg-red-500/20 text-red-200';
    return (
      <div className="relative group/chip">
        <button
          onClick={() => setActiveValue(isSelected ? '' : app.name)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 pr-8 text-sm font-medium transition ${
            isSelected ? sel : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
          }`}
        >
          <span>{appIcon(app.name)}</span>
          <span className="capitalize">{app.name}</span>
          {isSelected && <span className="text-xs opacity-60">✓</span>}
        </button>
        <button
          onClick={e => { e.stopPropagation(); toggle(app.name); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-0 group-hover/chip:opacity-100 transition"
        >
          {isFavorite(app.name) ? '★' : '☆'}
        </button>
      </div>
    );
  }

  // ── RGB ──────────────────────────────────────────────────────────────────────
  const [rgbDevices, setRgbDevices]         = useState<RgbDevice[]>([]);
  const [rgbDevStatus, setRgbDevStatus]     = useState<'loading' | 'ok' | 'error'>('loading');
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [rgbColor, setRgbColor]             = useState('#ff0000');
  const [rgbStatus, setRgbStatus]           = useState('');
  const [rgbError, setRgbError]             = useState('');

  const fetchRgbDevices = useCallback(async () => {
    setRgbDevStatus('loading');
    try {
      const res = await api('/rgb/devices');
      const json = await res.json();
      setRgbDevices(json.devices ?? []);
      setRgbDevStatus('ok');
    } catch { setRgbDevStatus('error'); }
  }, [api]);

  useEffect(() => { fetchRgbDevices(); }, [fetchRgbDevices]);

  const applyRgbColor = async (hex: string) => {
    setRgbColor(hex); setRgbStatus(''); setRgbError('');
    const { r, g, b } = hexToRgb(hex);
    try {
      const res = await api('/rgb/color', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r, g, b, device_id: selectedDevice }),
      });
      const json = await res.json();
      json.success ? setRgbStatus('✓ Couleur appliquée') : setRgbError(`✗ ${json.error}`);
    } catch {}
  };

  const turnRgbOff = async () => {
    setRgbStatus(''); setRgbError('');
    try {
      const res = await api('/rgb/off', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: selectedDevice }),
      });
      const json = await res.json();
      json.success ? setRgbStatus('✓ RGB éteint') : setRgbError(`✗ ${json.error}`);
    } catch {}
  };

  // ── Discord ──────────────────────────────────────────────────────────────────
  const [discordBotOk, setDiscordBotOk]       = useState<boolean | null>(null);
  const [discordAppOk, setDiscordAppOk]       = useState<boolean | null>(null);
  const [discordRoles, setDiscordRoles]       = useState<DiscordRole[]>([]);
  const [discordMembers, setDiscordMembers]   = useState<DiscordMember[]>([]);
  const [discordTab, setDiscordTab]           = useState<'message' | 'voice'>('message');

  const [msgChannelId, setMsgChannelId] = useState('');
  const [msgText, setMsgText]           = useState('');
  const [msgResult, setMsgResult]       = useState<{ success: boolean; error?: string } | null>(null);
  const [sendingMsg, setSendingMsg]     = useState(false);

  const [voiceGuildId, setVoiceGuildId]     = useState('');
  const [voiceChannelId, setVoiceChannelId] = useState('');
  const [voiceResult, setVoiceResult]       = useState<{ success: boolean; error?: string } | null>(null);
  const [joiningVoice, setJoiningVoice]     = useState(false);

  useEffect(() => {
    api('/discord/config').then(r => r.json()).then(d => {
      setDiscordBotOk(d.bot_configured);
      setDiscordAppOk(d.app_id_configured);
    }).catch(() => {});
    api('/discord/roles').then(r => r.json()).then(setDiscordRoles).catch(() => {});
    api('/discord/members').then(r => r.json()).then(setDiscordMembers).catch(() => {});
  }, [token]);

  const insertMention = (mention: string) => setMsgText(t => t + mention + ' ');

  const sendMessage = async () => {
    if (!msgChannelId.trim() || !msgText.trim()) return;
    setSendingMsg(true); setMsgResult(null);
    try {
      const res = await api('/discord/send_message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: msgChannelId.trim(), message: msgText.trim() }),
      });
      const data = await res.json();
      setMsgResult(data);
      if (data.success) setMsgText('');
    } catch (e) { setMsgResult({ success: false, error: String(e) }); }
    finally { setSendingMsg(false); }
  };

  const joinVoice = async () => {
    if (!voiceGuildId.trim() || !voiceChannelId.trim()) return;
    setJoiningVoice(true); setVoiceResult(null);
    try {
      const res = await api('/discord/join_voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild_id: voiceGuildId.trim(), channel_id: voiceChannelId.trim() }),
      });
      setVoiceResult(await res.json());
    } catch (e) { setVoiceResult({ success: false, error: String(e) }); }
    finally { setJoiningVoice(false); }
  };

  // ── Tab button helper ─────────────────────────────────────────────────────
  function TabBtn({ active, onClick, children, accent }: {
    active: boolean; onClick: () => void; children: React.ReactNode; accent: string;
  }) {
    return (
      <button onClick={onClick}
        className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${active ? accent : 'text-slate-400 hover:text-slate-200'}`}>
        {children}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400">{isOnline ? 'Agent connecté' : 'Agent hors ligne'}</span>
      </div>

      {/* ── Applications ───────────────────────────────────────────────────────── */}
      <CollapsibleCard
        title="⚙️ Applications"
        accent={isLaunch ? 'cyan' : 'red'}
        badge={
          activeValue
            ? <span className={`rounded-full border px-2 py-0.5 ${isLaunch ? 'border-cyan-800 bg-cyan-900/40 text-cyan-300' : 'border-red-800 bg-red-900/40 text-red-300'}`}>
                {activeValue}
              </span>
            : undefined
        }
      >
        {/* Tab selector */}
        <div className="flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1 w-fit gap-1 -mt-1">
          <TabBtn active={appTab === 'launch'} onClick={() => switchAppTab('launch')} accent="bg-cyan-500 text-slate-950 shadow">
            ▶ Lancer
          </TabBtn>
          <TabBtn active={appTab === 'close'} onClick={() => switchAppTab('close')} accent="bg-red-600 text-slate-100 shadow">
            ✕ Fermer
          </TabBtn>
        </div>

        {/* Favorites */}
        {favApps.length > 0 && (
          <div>
            <p className="text-xs text-yellow-400 mb-2">★ Favoris</p>
            <div className="flex flex-wrap gap-2">
              {favApps.map(a => <AppChip key={a.id} app={a} />)}
            </div>
          </div>
        )}

        {/* All apps collapsible */}
        {apps.length > 0 && (
          <div>
            <button onClick={() => setAllOpen(v => !v)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition mb-2">
              <span className={`transition-transform duration-150 ${allOpen ? 'rotate-90' : ''}`}>▶</span>
              Toutes les applications
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">{apps.length}</span>
            </button>
            {allOpen && (
              <div className="pl-4 border-l border-slate-700 space-y-2">
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs">✕</button>}
                </div>
                {filtered.length === 0
                  ? <p className="text-xs text-slate-500 italic">Aucune correspondance.</p>
                  : <div className="flex flex-wrap gap-2">{filtered.map(a => <AppChip key={a.id} app={a} />)}</div>
                }
              </div>
            )}
          </div>
        )}

        {/* Input + action */}
        <div className="flex gap-3">
          <input
            value={activeValue} onChange={e => setActiveValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isLaunch ? onLaunch() : onClose())}
            placeholder={isLaunch ? 'notepad, valorant, chrome…' : 'valorant.exe, notepad…'}
            className={`flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition text-sm ${isLaunch ? 'focus:border-cyan-400' : 'focus:border-red-400'}`}
          />
          <button
            onClick={isLaunch ? onLaunch : onClose}
            disabled={!isOnline || !activeValue.trim()}
            className={`rounded-2xl px-6 py-2.5 font-semibold transition disabled:opacity-40 text-sm ${isLaunch ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-red-600 text-slate-100 hover:bg-red-500'}`}
          >
            {isLaunch ? '▶ Lancer' : '✕ Fermer'}
          </button>
        </div>

        <ResultBanner result={isLaunch ? launchResult : closeResult}
          successMsg={isLaunch ? 'Lancé avec succès' : 'Application fermée'}
          failMsg={isLaunch ? 'Échec du lancement' : 'Échec de la fermeture'} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </CollapsibleCard>

      {/* ── RGB ────────────────────────────────────────────────────────────────── */}
      <CollapsibleCard title="🎨 Contrôle RGB" accent="purple" defaultOpen={false}
        badge={
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${rgbDevStatus === 'ok' ? 'text-green-400' : rgbDevStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full shrink-0 ${rgbDevStatus === 'ok' ? 'bg-green-400' : rgbDevStatus === 'error' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'}`} />
            {rgbDevStatus === 'loading' ? 'OpenRGB…' : rgbDevStatus === 'ok' ? `OpenRGB lancé — ${rgbDevices.length} appareil${rgbDevices.length !== 1 ? 's' : ''}` : 'OpenRGB non lancé'}
          </span>
        }
      >
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold ${
          rgbDevStatus === 'ok'
            ? 'border-green-800 bg-green-950/30 text-green-300'
            : rgbDevStatus === 'error'
            ? 'border-red-800 bg-red-950/30 text-red-300'
            : 'border-slate-700 bg-slate-800/40 text-slate-400'
        }`}>
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${rgbDevStatus === 'ok' ? 'bg-green-400' : rgbDevStatus === 'error' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'}`} />
          {rgbDevStatus === 'loading' && 'Connexion à OpenRGB…'}
          {rgbDevStatus === 'ok'      && `OpenRGB lancé — ${rgbDevices.length} appareil${rgbDevices.length !== 1 ? 's' : ''} détecté${rgbDevices.length !== 1 ? 's' : ''}`}
          {rgbDevStatus === 'error'   && 'OpenRGB non lancé — démarrez-le avec le SDK server activé (port 6742)'}
        </div>

        {/* Device selector */}
        {rgbDevices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Appareil cible</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedDevice(null)}
                className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${selectedDevice === null ? 'border-purple-500 bg-purple-500/20 text-purple-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                Tous ({rgbDevices.length})
              </button>
              {rgbDevices.map(d => (
                <button key={d.id} onClick={() => setSelectedDevice(d.id === selectedDevice ? null : d.id)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${selectedDevice === d.id ? 'border-purple-500 bg-purple-500/20 text-purple-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                  {d.name} <span className="text-xs opacity-50 ml-1">{d.led_count} LEDs</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <label className="cursor-pointer">
            <div className="h-12 w-12 rounded-2xl border-2 border-slate-600 shadow-lg hover:scale-105 transition" style={{ backgroundColor: rgbColor }} />
            <input type="color" value={rgbColor} onChange={e => setRgbColor(e.target.value)}
              onBlur={e => applyRgbColor(e.target.value)} className="sr-only" />
          </label>
          <span className="font-mono text-sm text-slate-300">{rgbColor.toUpperCase()}</span>
          <button onClick={() => applyRgbColor(rgbColor)}
            className="rounded-2xl bg-purple-600 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-purple-500 transition">
            Appliquer
          </button>
          <button onClick={turnRgbOff}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition">
            ⬛ Éteindre
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {RGB_PRESETS.map(p => (
            <button key={p.color} onClick={() => applyRgbColor(p.color)} title={p.label} className="flex flex-col items-center gap-1 group">
              <div className={`h-8 w-8 rounded-xl border-2 transition hover:scale-110 ${rgbColor === p.color ? 'border-white scale-110' : 'border-slate-600'}`}
                style={{ backgroundColor: p.color }} />
              <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">{p.label}</span>
            </button>
          ))}
        </div>

        {rgbStatus && <p className="text-sm text-green-400">{rgbStatus}</p>}
        {rgbError  && <p className="text-sm text-red-400">{rgbError}</p>}
      </CollapsibleCard>

      {/* ── Discord ───────────────────────────────────────────────────────────── */}
      <CollapsibleCard title="💬 Discord" accent="indigo" defaultOpen={false}
        badge={
          <>
            <span className={`flex items-center gap-1 ${discordBotOk ? 'text-green-400' : 'text-yellow-400'}`}>
              <span className={`h-2 w-2 rounded-full ${discordBotOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
              Bot
            </span>
            <span className={`flex items-center gap-1 ${discordAppOk ? 'text-green-400' : 'text-yellow-400'}`}>
              <span className={`h-2 w-2 rounded-full ${discordAppOk ? 'bg-green-400' : 'bg-yellow-400'}`} />
              RPC
            </span>
          </>
        }
      >
        {/* Tab selector */}
        <div className="flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1 w-fit gap-1 -mt-1">
          <TabBtn active={discordTab === 'message'} onClick={() => setDiscordTab('message')} accent="bg-indigo-600 text-white shadow">
            📨 Message
          </TabBtn>
          <TabBtn active={discordTab === 'voice'} onClick={() => setDiscordTab('voice')} accent="bg-green-700 text-white shadow">
            🔊 Vocal
          </TabBtn>
        </div>

        {/* ── Message ── */}
        {discordTab === 'message' && (
          <div className="space-y-3">
            {!discordBotOk && <p className="text-xs text-yellow-400">⚠️ Configure le bot dans l'onglet Discord.</p>}

            <input value={msgChannelId} onChange={e => setMsgChannelId(e.target.value)}
              placeholder="ID du salon texte (123456789…)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />

            {/* Mention chips */}
            {discordRoles.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Rôles :</p>
                <div className="flex flex-wrap gap-1.5">
                  {discordRoles.map(r => (
                    <button key={r.role_id} onClick={() => insertMention(`<@&${r.role_id}>`)}
                      className="rounded-lg border border-indigo-700 bg-indigo-900/30 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-800/50 transition">
                      @{r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {discordMembers.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">Membres :</p>
                <div className="flex flex-wrap gap-1.5">
                  {discordMembers.map(m => (
                    <button key={m.user_id} onClick={() => insertMention(`<@${m.user_id}>`)}
                      className="rounded-lg border border-cyan-700 bg-cyan-900/30 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50 transition">
                      @{m.name}
                    </button>
                  ))}
                  <button onClick={() => insertMention('@everyone')}
                    className="rounded-lg border border-red-700 bg-red-900/30 px-2 py-1 text-xs text-red-300 hover:bg-red-800/50 transition">@everyone</button>
                  <button onClick={() => insertMention('@here')}
                    className="rounded-lg border border-orange-700 bg-orange-900/30 px-2 py-1 text-xs text-orange-300 hover:bg-orange-800/50 transition">@here</button>
                </div>
              </div>
            )}

            <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Votre message…" rows={3}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition resize-none" />

            <button onClick={sendMessage} disabled={sendingMsg || !msgChannelId.trim() || !msgText.trim() || !discordBotOk}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition text-sm">
              {sendingMsg ? 'Envoi…' : '📨 Envoyer'}
            </button>

            {msgResult && (
              <div className={`rounded-2xl border p-3 text-sm ${msgResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
                {msgResult.success ? '✓ Message envoyé' : `✗ ${msgResult.error}`}
              </div>
            )}
          </div>
        )}

        {/* ── Vocal ── */}
        {discordTab === 'voice' && (
          <div className="space-y-3">
            {!discordAppOk && <p className="text-xs text-yellow-400">⚠️ Configure l'Application ID dans l'onglet Discord.</p>}

            <input value={voiceGuildId} onChange={e => setVoiceGuildId(e.target.value)}
              placeholder="ID du serveur (123456789…)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-green-400 transition font-mono" />

            <input value={voiceChannelId} onChange={e => setVoiceChannelId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinVoice()}
              placeholder="ID du salon vocal (123456789…)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-green-400 transition font-mono" />

            <button onClick={joinVoice} disabled={joiningVoice || !voiceGuildId.trim() || !voiceChannelId.trim() || !discordAppOk}
              className="w-full rounded-2xl bg-green-700 py-2.5 font-semibold text-white hover:bg-green-600 disabled:opacity-40 transition text-sm">
              {joiningVoice ? 'Connexion…' : '🔊 Rejoindre'}
            </button>

            {voiceResult && (
              <div className={`rounded-2xl border p-3 text-sm ${voiceResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
                {voiceResult.success ? '✓ Connecté au salon vocal' : `✗ ${voiceResult.error}`}
              </div>
            )}
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}
