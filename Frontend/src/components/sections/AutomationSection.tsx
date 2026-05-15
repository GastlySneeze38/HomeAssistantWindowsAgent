import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api';
import { GameProfile } from '../../types';

type Props = { token: string; onUnauthorized: () => void };
type YoutubePlaylist = { id: number; name: string; playlist_id: string };

const API = 'http://127.0.0.1:3000';

const EMPTY_PROFILE: GameProfile = {
  id: 0,
  name: '',
  process_name: '',
  enabled: true,
  rgb_enabled: false,
  rgb_color: '#00ffff',
  discord_guild_id: null,
  discord_voice_channel_id: null,
  discord_message_channel_id: null,
  discord_message: null,
  youtube_playlist_id: null,
};

function Toggle({ value, onChange, color = 'orange' }: { value: boolean; onChange: () => void; color?: string }) {
  const bg = value
    ? color === 'purple' ? 'bg-purple-500' : color === 'indigo' ? 'bg-indigo-500' : 'bg-orange-500'
    : 'bg-slate-700';
  return (
    <button
      onClick={onChange}
      className={`w-10 h-6 rounded-full transition-colors shrink-0 ${bg}`}
    >
      <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500 ${mono ? 'font-mono' : ''}`}
    />
  );
}

function ActionBlock({ icon, title, color, children }: {
  icon: string; title: string; color: string; children: React.ReactNode;
}) {
  const borders: Record<string, string> = {
    purple: 'border-purple-900 bg-purple-950/20',
    red: 'border-red-900 bg-red-950/20',
    indigo: 'border-indigo-900 bg-indigo-950/20',
  };
  const texts: Record<string, string> = {
    purple: 'text-purple-300',
    red: 'text-red-300',
    indigo: 'text-indigo-300',
  };
  return (
    <div className={`rounded-2xl border ${borders[color]} p-4 space-y-3`}>
      <p className={`font-semibold ${texts[color]}`}>{icon} {title}</p>
      {children}
    </div>
  );
}

function ProfileBadges({ p }: { p: GameProfile }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {p.rgb_enabled && p.rgb_color && (
        <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700/60 rounded-full px-2 py-0.5">
          <span className="w-2 h-2 rounded-full border border-slate-500" style={{ backgroundColor: p.rgb_color }} />
          RGB
        </span>
      )}
      {p.youtube_playlist_id && (
        <span className="text-xs text-red-300 bg-red-900/20 border border-red-900 rounded-full px-2 py-0.5">🎵</span>
      )}
      {p.discord_voice_channel_id && (
        <span className="text-xs text-indigo-300 bg-indigo-900/20 border border-indigo-900 rounded-full px-2 py-0.5">🎙</span>
      )}
      {p.discord_message && (
        <span className="text-xs text-indigo-300 bg-indigo-900/20 border border-indigo-900 rounded-full px-2 py-0.5">💬</span>
      )}
    </div>
  );
}

export default function AutomationSection({ token, onUnauthorized }: Props) {
  const api = useCallback((path: string, opts: RequestInit = {}) =>
    apiFetch(`${API}${path}`, opts, token).catch((e: Error) => {
      if (e.message === 'UNAUTHORIZED') onUnauthorized();
      throw e;
    }), [token]);

  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [playlists, setPlaylists] = useState<YoutubePlaylist[]>([]);
  const [selected, setSelected] = useState<GameProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      const r = await api('/automation/profiles');
      const data: GameProfile[] = await r.json();
      setProfiles(data);
      // sync selected if editing existing
      setSelected(prev => {
        if (!prev || prev.id === 0) return prev;
        return data.find(p => p.id === prev.id) ?? prev;
      });
    } catch {}
  }, [api]);

  useEffect(() => {
    loadProfiles();
    api('/youtube/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
  }, [api, loadProfiles]);

  const selectProfile = (p: GameProfile) => {
    setSelected({ ...p });
    setIsNew(false);
    setSaveError('');
    setSaveOk(false);
  };

  const createNew = () => {
    setSelected({ ...EMPTY_PROFILE });
    setIsNew(true);
    setSaveError('');
    setSaveOk(false);
  };

  const set = <K extends keyof GameProfile>(key: K, value: GameProfile[K]) =>
    setSelected(prev => prev ? { ...prev, [key]: value } : prev);

  const save = async () => {
    if (!selected) return;
    if (!selected.name.trim() || !selected.process_name.trim()) {
      setSaveError('Le nom et le processus sont obligatoires.');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      const res = await api(isNew ? '/automation/profiles/add' : '/automation/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const json = await res.json();
      if (isNew && json.id) {
        setSelected(prev => prev ? { ...prev, id: json.id } : prev);
        setIsNew(false);
      }
      await loadProfiles();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {
      setSaveError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      await loadProfiles();
      if (selected?.id === p.id) setSelected(updated);
    } catch {}
  };

  const str = (v: string | null) => v ?? '';
  const nullable = (v: string) => v.trim() || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-900/40">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-orange-300">Automatisation par jeu</h1>
            <p className="mt-1 text-slate-400 text-sm">
              Détection automatique du processus → RGB · Musique · Discord voice · Message
            </p>
          </div>
          <button
            onClick={createNew}
            className="rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold px-5 py-2.5 transition shrink-0"
          >
            + Nouveau profil
          </button>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex gap-5 items-start">

        {/* Left — profile list */}
        <div className="w-64 shrink-0 space-y-2">
          {profiles.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-slate-500 text-sm">
              Aucun profil.<br />Clique sur + Nouveau.
            </div>
          )}
          {profiles.map(p => {
            const isActive = selected?.id === p.id && !isNew;
            return (
              <div
                key={p.id}
                onClick={() => selectProfile(p)}
                className={`w-full text-left rounded-2xl border px-4 py-3 transition cursor-pointer ${
                  isActive
                    ? 'border-orange-500 bg-orange-950/30'
                    : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-100 truncate">{p.name}</span>
                  <span onClick={e => toggleEnabled(p, e)}>
                    <Toggle value={p.enabled} onChange={() => {}} color="orange" />
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{p.process_name}</p>
                <ProfileBadges p={p} />
              </div>
            );
          })}
        </div>

        {/* Right — editor */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 flex items-center justify-center py-20">
              <div className="text-center text-slate-500">
                <p className="text-4xl mb-3">⚡</p>
                <p className="text-sm">Sélectionne un profil ou crée-en un nouveau.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-900/40 space-y-5">
              {/* Editor title */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-lg font-bold text-orange-300">
                  {isNew ? 'Nouveau profil' : `Modifier — ${selected.name}`}
                </h2>
                {!isNew && (
                  <button
                    onClick={deleteProfile}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded-xl px-3 py-1.5 transition hover:bg-red-950/40"
                  >
                    Supprimer
                  </button>
                )}
              </div>

              {/* Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom du profil">
                  <TextInput
                    value={selected.name}
                    onChange={v => set('name', v)}
                    placeholder="Fortnite, Minecraft…"
                  />
                </Field>
                <Field label="Nom du processus">
                  <TextInput
                    value={selected.process_name}
                    onChange={v => set('process_name', v)}
                    placeholder="FortniteClient-Win64-Shipping.exe"
                    mono
                  />
                </Field>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Partiel accepté (insensible à la casse). Gestionnaire des tâches → onglet Détails pour trouver le nom.
              </p>

              {/* Enable */}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                <Toggle value={selected.enabled} onChange={() => set('enabled', !selected.enabled)} />
                <span className="text-sm font-medium text-slate-200">
                  {selected.enabled ? 'Profil activé' : 'Profil désactivé'}
                </span>
                <span className="text-xs text-slate-500 ml-1">
                  {selected.enabled ? '— Détection active' : '— Aucun déclenchement'}
                </span>
              </div>

              {/* ── RGB ── */}
              <ActionBlock icon="🌈" title="RGB" color="purple">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Changer la couleur au lancement</span>
                  <Toggle
                    value={selected.rgb_enabled}
                    onChange={() => set('rgb_enabled', !selected.rgb_enabled)}
                    color="purple"
                  />
                </div>
                {selected.rgb_enabled && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={selected.rgb_color ?? '#00ffff'}
                      onChange={e => set('rgb_color', e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border border-slate-600 bg-transparent"
                    />
                    <span className="font-mono text-sm text-slate-300">{selected.rgb_color}</span>
                    <div className="w-6 h-6 rounded-full border border-slate-600" style={{ backgroundColor: selected.rgb_color ?? '#00ffff' }} />
                  </div>
                )}
              </ActionBlock>

              {/* ── YouTube Music ── */}
              <ActionBlock icon="🎵" title="YouTube Music" color="red">
                <Field label="Playlist à lancer">
                  {playlists.length > 0 ? (
                    <select
                      value={selected.youtube_playlist_id ?? ''}
                      onChange={e => set('youtube_playlist_id', e.target.value || null)}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-red-500"
                    >
                      <option value="">— Aucune —</option>
                      {playlists.map(pl => (
                        <option key={pl.id} value={pl.playlist_id}>{pl.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500">Aucune playlist sauvegardée. Ajoute-en une dans Contrôle → YouTube Music.</p>
                  )}
                </Field>
              </ActionBlock>

              {/* ── Discord ── */}
              <ActionBlock icon="🎮" title="Discord" color="indigo">
                <p className="text-xs text-slate-500 -mt-1">
                  IDs disponibles via clic droit dans Discord (mode développeur activé).
                </p>

                {/* Voice */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Rejoindre un salon vocal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Guild ID (serveur)">
                      <TextInput
                        value={str(selected.discord_guild_id)}
                        onChange={v => set('discord_guild_id', nullable(v))}
                        placeholder="123456789012345678"
                        mono
                      />
                    </Field>
                    <Field label="Channel ID (salon vocal)">
                      <TextInput
                        value={str(selected.discord_voice_channel_id)}
                        onChange={v => set('discord_voice_channel_id', nullable(v))}
                        placeholder="123456789012345678"
                        mono
                      />
                    </Field>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-3 pt-1 border-t border-indigo-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Envoyer un message</p>
                  <Field label="Channel ID (texte)">
                    <TextInput
                      value={str(selected.discord_message_channel_id)}
                      onChange={v => set('discord_message_channel_id', nullable(v))}
                      placeholder="123456789012345678"
                      mono
                    />
                  </Field>
                  <Field label="Message">
                    <textarea
                      value={str(selected.discord_message)}
                      onChange={e => set('discord_message', nullable(e.target.value))}
                      placeholder="Ex: 🎮 Partie lancée sur Fortnite !"
                      rows={3}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </Field>
                </div>
              </ActionBlock>

              {/* Save / feedback */}
              {saveError && (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-xl px-3 py-2">{saveError}</p>
              )}
              {saveOk && (
                <p className="text-sm text-green-400 bg-green-950/40 border border-green-800 rounded-xl px-3 py-2">✓ Profil sauvegardé</p>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-bold py-3 transition"
              >
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-5 py-3 flex gap-3 items-center text-sm text-slate-400">
        <span className="text-lg">ℹ️</span>
        <span>Le backend détecte les processus toutes les 3 secondes. Les actions se déclenchent au lancement du jeu, pas à chaque détection.</span>
      </div>
    </div>
  );
}
