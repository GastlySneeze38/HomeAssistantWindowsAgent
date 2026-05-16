import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../api';
import { GameProfile, AppEntry } from '../../types';

type Props = { token: string; onUnauthorized: () => void };
type YoutubePlaylist = { id: number; name: string; playlist_id: string };
type DiscordRole     = { id: number; guild_id: string; role_id: string; name: string };
type DiscordMember   = { id: number; user_id: string; name: string };

const API = 'http://127.0.0.1:3000';

const EMPTY_PROFILE: GameProfile = {
  id: 0, name: '', process_name: '', enabled: true,
  rgb_enabled: false, rgb_color: '#00ffff',
  discord_guild_id: null, discord_voice_channel_id: null,
  discord_message_channel_id: null, discord_message: null,
  youtube_playlist_id: null,
};

function getProcessName(app: AppEntry): string {
  if (app.close_processes) {
    const first = app.close_processes.split(',')[0].trim();
    if (first) return first;
  }
  return app.path.split('\\').pop() ?? app.path.split('/').pop() ?? '';
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, color = 'orange' }: { value: boolean; onChange: () => void; color?: string }) {
  const bg = value
    ? color === 'purple' ? 'bg-purple-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-orange-500'
    : 'bg-slate-700';
  return (
    <button onClick={onChange} className={`w-10 h-6 rounded-full transition-colors shrink-0 ${bg}`}>
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

// ── TextInput ─────────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500 ${mono ? 'font-mono' : ''}`}
    />
  );
}

// ── CollapsibleBlock ──────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; heading: string; chevron: string }> = {
  purple: { border: 'border-purple-900 bg-purple-950/20', heading: 'text-purple-300', chevron: 'text-purple-400' },
  red:    { border: 'border-red-900 bg-red-950/20',       heading: 'text-red-300',    chevron: 'text-red-400' },
  indigo: { border: 'border-indigo-900 bg-indigo-950/20', heading: 'text-indigo-300', chevron: 'text-indigo-400' },
};

function CollapsibleBlock({ icon, title, color, badge, children, defaultOpen = false }: {
  icon: string; title: string; color: string; badge?: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = COLOR_MAP[color];
  return (
    <div className={`rounded-2xl border ${s.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <span className={`font-semibold text-sm flex items-center gap-2 ${s.heading}`}>
          {icon} {title} {badge}
        </span>
        <span className={`text-xs transition-transform duration-200 ${s.chevron} ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">{children}</div>}
    </div>
  );
}

// ── ProfileBadges ─────────────────────────────────────────────────────────────

function ProfileBadges({ p }: { p: GameProfile }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {p.rgb_enabled && p.rgb_color && (
        <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700/60 rounded-full px-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.rgb_color }} />RGB
        </span>
      )}
      {p.youtube_playlist_id && <span className="text-xs text-red-300 bg-red-900/20 border border-red-900 rounded-full px-2 py-0.5">🎵</span>}
      {p.discord_voice_channel_id && <span className="text-xs text-indigo-300 bg-indigo-900/20 border border-indigo-900 rounded-full px-2 py-0.5">🎙</span>}
      {p.discord_message && <span className="text-xs text-indigo-300 bg-indigo-900/20 border border-indigo-900 rounded-full px-2 py-0.5">💬</span>}
    </div>
  );
}

// ── GamePicker modal ──────────────────────────────────────────────────────────

function GamePicker({ apps, onSelect, onClose }: {
  apps: AppEntry[]; onSelect: (app: AppEntry) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const filtered = apps.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg mx-4 rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-bold text-orange-300 text-lg">Choisir un jeu installé</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-slate-800">
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un jeu…"
            className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && <p className="text-center text-slate-500 text-sm py-10">Aucun résultat pour « {query} »</p>}
          {filtered.map(app => (
            <button key={app.id} onClick={() => onSelect(app)}
              className="w-full text-left px-5 py-3 hover:bg-slate-800 transition flex items-center justify-between gap-4 border-b border-slate-800/50 last:border-0">
              <span className="font-medium text-slate-100 text-sm">{app.name}</span>
              <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{getProcessName(app)}</span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
          {filtered.length} programme{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ── MentionPicker (inline) ────────────────────────────────────────────────────

function MentionPicker({ roles, members, onInsert }: {
  roles: DiscordRole[]; members: DiscordMember[];
  onInsert: (mention: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'roles' | 'members'>('roles');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const noData = roles.length === 0 && members.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={noData}
        className="rounded-xl bg-indigo-900/50 hover:bg-indigo-900/80 disabled:opacity-40 border border-indigo-800 px-3 py-1.5 text-xs font-medium text-indigo-300 transition"
      >
        @ Mention
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-30 w-64 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            {(['roles', 'members'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold transition ${tab === t ? 'text-indigo-300 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>
                {t === 'roles' ? `Rôles (${roles.length})` : `Membres (${members.length})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {tab === 'roles' && (
              roles.length === 0
                ? <p className="text-xs text-slate-500 text-center py-4">Aucun rôle. Configure Discord d'abord.</p>
                : roles.map(r => (
                  <button key={r.id} onClick={() => { onInsert(`<@&${r.role_id}>`); setOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition flex items-center gap-2 text-sm text-slate-200 border-b border-slate-800/40 last:border-0">
                    <span className="text-indigo-400 font-mono text-xs">@</span>
                    {r.name}
                  </button>
                ))
            )}
            {tab === 'members' && (
              members.length === 0
                ? <p className="text-xs text-slate-500 text-center py-4">Aucun membre. Configure Discord d'abord.</p>
                : members.map(m => (
                  <button key={m.id} onClick={() => { onInsert(`<@${m.user_id}>`); setOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition flex items-center gap-2 text-sm text-slate-200 border-b border-slate-800/40 last:border-0">
                    <span className="text-indigo-400 font-mono text-xs">@</span>
                    {m.name}
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function AutomationSection({ token, onUnauthorized }: Props) {
  const api = useCallback((path: string, opts: RequestInit = {}) =>
    apiFetch(`${API}${path}`, opts, token).catch((e: Error) => {
      if (e.message === 'UNAUTHORIZED') onUnauthorized();
      throw e;
    }), [token]);

  const [profiles, setProfiles]     = useState<GameProfile[]>([]);
  const [playlists, setPlaylists]   = useState<YoutubePlaylist[]>([]);
  const [apps, setApps]             = useState<AppEntry[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [roles, setRoles]           = useState<DiscordRole[]>([]);
  const [members, setMembers]       = useState<DiscordMember[]>([]);
  const [botConfigured, setBotConfigured] = useState<boolean | null>(null);
  const [selected, setSelected]     = useState<GameProfile | null>(null);
  const [isNew, setIsNew]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [saveOk, setSaveOk]         = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const data: GameProfile[] = await api('/automation/profiles').then(r => r.json());
      setProfiles(data);
      setSelected(prev => {
        if (!prev || prev.id === 0) return prev;
        return data.find(p => p.id === prev.id) ?? prev;
      });
    } catch {}
  }, [api]);

  useEffect(() => {
    loadProfiles();
    api('/youtube/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
    api('/apps').then(r => r.json()).then((d: AppEntry[]) => {
      setApps(d.sort((a, b) => a.name.localeCompare(b.name)));
      setAppsLoaded(true);
    }).catch(() => { setAppsLoaded(true); });
    api('/discord/config').then(r => r.json()).then(d => setBotConfigured(d.bot_configured)).catch(() => {});
    api('/discord/roles').then(r => r.json()).then(setRoles).catch(() => {});
    api('/discord/members').then(r => r.json()).then(setMembers).catch(() => {});
  }, [api, loadProfiles]);

  // Clic sur un profil : sélectionner ou désélectionner
  const handleProfileClick = (p: GameProfile) => {
    if (!isNew && selected?.id === p.id) {
      setSelected(null);
      setSaveError('');
      setSaveOk(false);
    } else {
      setSelected({ ...p });
      setIsNew(false);
      setSaveError('');
      setSaveOk(false);
    }
  };

  const createNew = () => {
    setSelected({ ...EMPTY_PROFILE });
    setIsNew(true);
    setSaveError('');
    setSaveOk(false);
  };

  const set = <K extends keyof GameProfile>(key: K, value: GameProfile[K]) =>
    setSelected(prev => prev ? { ...prev, [key]: value } : prev);

  const applyApp = (app: AppEntry) => {
    setSelected(prev => prev ? { ...prev, name: app.name, process_name: getProcessName(app) } : prev);
    setShowPicker(false);
  };

  // Insère une mention à la position du curseur dans la textarea
  const insertMention = (mention: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      set('discord_message', ((selected?.discord_message ?? '') + ' ' + mention).trimStart());
      return;
    }
    const start = ta.selectionStart ?? 0;
    const end   = ta.selectionEnd   ?? 0;
    const cur   = selected?.discord_message ?? '';
    const next  = cur.slice(0, start) + mention + cur.slice(end);
    set('discord_message', next);
    // Remet le curseur après la mention
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + mention.length, start + mention.length);
    }, 0);
  };

  const save = async () => {
    if (!selected) return;
    if (!selected.name.trim() || !selected.process_name.trim()) {
      setSaveError('Le nom et le processus sont obligatoires.');
      return;
    }
    setSaving(true); setSaveError(''); setSaveOk(false);
    try {
      const res  = await api(isNew ? '/automation/profiles/add' : '/automation/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const json = await res.json();
      if (isNew && json.id) { setSelected(prev => prev ? { ...prev, id: json.id } : prev); setIsNew(false); }
      await loadProfiles();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch { setSaveError('Erreur lors de la sauvegarde.'); }
    finally  { setSaving(false); }
  };

  const deleteProfile = async () => {
    if (!selected || selected.id === 0) return;
    if (!confirm(`Supprimer le profil "${selected.name}" ?`)) return;
    try {
      await api('/automation/profiles/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      });
      setSelected(null);
      await loadProfiles();
    } catch {}
  };

  const toggleEnabled = async (p: GameProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...p, enabled: !p.enabled };
    try {
      await api('/automation/profiles/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      await loadProfiles();
      if (selected?.id === p.id) setSelected(updated);
    } catch {}
  };

  const str      = (v: string | null) => v ?? '';
  const nullable = (v: string) => v.trim() || null;

  // Badges de résumé dans les en-têtes des blocs pliables
  const rgbBadge = selected?.rgb_enabled && selected.rgb_color
    ? <span className="w-3 h-3 rounded-full border border-purple-600 inline-block" style={{ backgroundColor: selected.rgb_color }} />
    : null;
  const musicBadge = selected?.youtube_playlist_id
    ? <span className="text-xs bg-red-900/40 border border-red-800 rounded-full px-1.5 py-0.5 text-red-300">ON</span>
    : null;
  const discordVoiceBadge = selected?.discord_voice_channel_id
    ? <span className="text-xs bg-indigo-900/40 border border-indigo-800 rounded-full px-1.5 py-0.5 text-indigo-300">🎙 ON</span>
    : null;
  const discordMsgBadge = selected?.discord_message
    ? <span className="text-xs bg-indigo-900/40 border border-indigo-800 rounded-full px-1.5 py-0.5 text-indigo-300">💬 ON</span>
    : null;

  return (
    <>
      {showPicker && <GamePicker apps={apps} onSelect={applyApp} onClose={() => setShowPicker(false)} />}

      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-900/40">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-orange-300">Automatisation par jeu</h1>
              <p className="mt-1 text-slate-400 text-sm">Détection du processus → RGB · Musique · Discord voice · Message</p>
            </div>
            <button onClick={createNew}
              className="rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold px-5 py-2.5 transition shrink-0">
              + Nouveau profil
            </button>
          </div>
        </div>

        {/* Split panel */}
        <div className="flex gap-5 items-start">

          {/* Gauche — liste */}
          <div className="w-64 shrink-0 space-y-2">
            {profiles.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-slate-500 text-sm">
                Aucun profil.<br />Clique sur + Nouveau.
              </div>
            )}
            {profiles.map(p => {
              const isActive = !isNew && selected?.id === p.id;
              return (
                <div key={p.id} onClick={() => handleProfileClick(p)}
                  className={`rounded-2xl border px-4 py-3 transition cursor-pointer select-none ${
                    isActive ? 'border-orange-500 bg-orange-950/30' : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-100 truncate">{p.name}</span>
                    <span onClick={e => toggleEnabled(p, e)}>
                      <Toggle value={p.enabled} onChange={() => {}} color="orange" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{p.process_name}</p>
                  <ProfileBadges p={p} />
                </div>
              );
            })}
          </div>

          {/* Droite — éditeur */}
          <div className="flex-1 min-w-0">
            {!selected ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 flex items-center justify-center py-20">
                <div className="text-center text-slate-500">
                  <p className="text-4xl mb-3">⚡</p>
                  <p className="text-sm">Sélectionne un profil ou crée-en un nouveau.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-900/40 space-y-4">

                {/* Titre */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="text-lg font-bold text-orange-300">
                    {isNew ? 'Nouveau profil' : `Modifier — ${selected.name}`}
                  </h2>
                  {!isNew && (
                    <button onClick={deleteProfile}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded-xl px-3 py-1.5 transition hover:bg-red-950/40">
                      Supprimer
                    </button>
                  )}
                </div>

                {/* Jeu associé */}
                <div className="rounded-2xl border border-orange-900/60 bg-orange-950/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-orange-300">🎮 Jeu associé</p>
                    {appsLoaded && apps.length === 0 ? (
                      <span className="text-xs text-yellow-400">⚠️ Aucune app — ajoutez-en dans la section <span className="font-semibold">Apps</span></span>
                    ) : (
                      <button onClick={() => setShowPicker(true)} disabled={!appsLoaded}
                        className="rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-semibold px-3 py-1.5 text-xs transition">
                        {appsLoaded ? 'Choisir un jeu installé' : 'Chargement…'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nom du profil">
                      <TextInput value={selected.name} onChange={v => set('name', v)} placeholder="Ex: Apex Legends" />
                    </Field>
                    <Field label="Processus détecté">
                      <TextInput value={selected.process_name} onChange={v => set('process_name', v)} placeholder="r5apex.exe" mono />
                    </Field>
                  </div>
                  <p className="text-xs text-slate-500">Le bouton remplit automatiquement le processus. Tu peux aussi le modifier manuellement.</p>
                </div>

                {/* Toggle actif */}
                <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                  <Toggle value={selected.enabled} onChange={() => set('enabled', !selected.enabled)} />
                  <span className="text-sm font-medium text-slate-200">
                    {selected.enabled ? 'Profil activé' : 'Profil désactivé'}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">{selected.enabled ? '— Détection active' : '— Suspendu'}</span>
                </div>

                {/* ── RGB ── */}
                <CollapsibleBlock icon="💡" title="RGB" color="purple" badge={rgbBadge}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Changer la couleur au lancement</span>
                    <Toggle value={selected.rgb_enabled} onChange={() => set('rgb_enabled', !selected.rgb_enabled)} color="purple" />
                  </div>
                  {selected.rgb_enabled && (
                    <div className="flex items-center gap-3 pt-1">
                      <input type="color" value={selected.rgb_color ?? '#00ffff'}
                        onChange={e => set('rgb_color', e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-slate-600 bg-transparent"
                      />
                      <span className="font-mono text-sm text-slate-300">{selected.rgb_color}</span>
                      <div className="w-6 h-6 rounded-full border border-slate-600" style={{ backgroundColor: selected.rgb_color ?? '#00ffff' }} />
                    </div>
                  )}
                </CollapsibleBlock>

                {/* ── YouTube Music ── */}
                <CollapsibleBlock icon="🎵" title="YouTube Music" color="red" badge={musicBadge}>
                  <Field label="Playlist à lancer">
                    {playlists.length > 0 ? (
                      <select value={selected.youtube_playlist_id ?? ''}
                        onChange={e => set('youtube_playlist_id', e.target.value || null)}
                        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-red-500">
                        <option value="">— Aucune —</option>
                        {playlists.map(pl => <option key={pl.id} value={pl.playlist_id}>{pl.name}</option>)}
                      </select>
                    ) : (
                      <p className="text-xs text-slate-500">Aucune playlist sauvegardée. Ajoute-en une dans Contrôle → YouTube Music.</p>
                    )}
                  </Field>
                </CollapsibleBlock>

                {/* ── Discord voice ── */}
                <CollapsibleBlock icon="🎙" title="Discord — Salon vocal" color="indigo" badge={discordVoiceBadge}>
                  {botConfigured === false ? (
                    <div className="rounded-xl border border-yellow-700/60 bg-yellow-950/20 px-4 py-3 flex items-start gap-3">
                      <span className="text-yellow-400 mt-0.5">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-yellow-300">Bot Discord non configuré</p>
                        <p className="text-xs text-yellow-500 mt-0.5">Veuillez configurer le token du bot dans la section <span className="font-medium text-yellow-300">💬 Discord</span>.</p>
                      </div>
                    </div>
                  ) : (
                  <>
                    <p className="text-xs text-slate-500">IDs via clic droit dans Discord (mode développeur requis).</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Guild ID (serveur)">
                        <TextInput value={str(selected.discord_guild_id)} onChange={v => set('discord_guild_id', nullable(v))} placeholder="123456789012345678" mono />
                      </Field>
                      <Field label="Channel ID (vocal)">
                        <TextInput value={str(selected.discord_voice_channel_id)} onChange={v => set('discord_voice_channel_id', nullable(v))} placeholder="123456789012345678" mono />
                      </Field>
                    </div>
                  </>
                  )}
                </CollapsibleBlock>

                {/* ── Discord message ── */}
                <CollapsibleBlock icon="💬" title="Discord — Message" color="indigo" badge={discordMsgBadge}>
                  {botConfigured === false ? (
                    <div className="rounded-xl border border-yellow-700/60 bg-yellow-950/20 px-4 py-3 flex items-start gap-3">
                      <span className="text-yellow-400 mt-0.5">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-yellow-300">Bot Discord non configuré</p>
                        <p className="text-xs text-yellow-500 mt-0.5">Veuillez configurer le token du bot dans la section <span className="font-medium text-yellow-300">💬 Discord</span>.</p>
                      </div>
                    </div>
                  ) : (
                  <>
                    <p className="text-xs text-slate-500">Envoie un message automatique dans un salon texte au lancement du jeu.</p>
                    <Field label="Channel ID (texte)">
                      <TextInput value={str(selected.discord_message_channel_id)} onChange={v => set('discord_message_channel_id', nullable(v))} placeholder="123456789012345678" mono />
                    </Field>
                    <Field label="Message">
                      <textarea
                        ref={textareaRef}
                        value={str(selected.discord_message)}
                        onChange={e => set('discord_message', nullable(e.target.value))}
                        placeholder="Ex: 🎮 Partie lancée sur Apex Legends !"
                        rows={3}
                        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </Field>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Insérer une mention :</span>
                      <MentionPicker roles={roles} members={members} onInsert={insertMention} />
                      {(roles.length === 0 && members.length === 0) && (
                        <span className="text-xs text-slate-600">— Configure d'abord les rôles/membres dans Configuration Discord</span>
                      )}
                    </div>
                  </>
                  )}
                </CollapsibleBlock>

                {/* Feedback */}
                {saveError && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-xl px-3 py-2">{saveError}</p>}
                {saveOk    && <p className="text-sm text-green-400 bg-green-950/40 border border-green-800 rounded-xl px-3 py-2">✓ Profil sauvegardé</p>}

                <button onClick={save} disabled={saving}
                  className="w-full rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 transition">
                  {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-5 py-3 flex gap-3 items-center text-sm text-slate-400">
          <span className="text-lg">ℹ️</span>
          <span>
            Détection toutes les 3s. Les actions se déclenchent une seule fois au lancement, pas à chaque tick.
            Pour mettre à jour la liste des jeux : <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">Scanner/scan_programs.ps1</code> puis <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">import_to_db.py</code>.
          </span>
        </div>
      </div>
    </>
  );
}
