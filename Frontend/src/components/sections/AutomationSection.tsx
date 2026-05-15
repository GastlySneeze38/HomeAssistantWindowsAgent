import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api';
import { GameProfile } from '../../types';

type Props = { token: string; onUnauthorized: () => void };

const API = 'http://127.0.0.1:3000';

const EMPTY_PROFILE: Omit<GameProfile, 'id'> = {
  name: '',
  process_name: '',
  enabled: true,
  rgb_enabled: false,
  rgb_color: '#00ffff',
  discord_guild_id: null,
  discord_voice_channel_id: null,
  youtube_playlist_id: null,
};

type YoutubePlaylist = { id: number; name: string; playlist_id: string };

function Card({ title, children, color = 'cyan' }: { title: string; children: React.ReactNode; color?: string }) {
  const border = color === 'orange' ? 'border-orange-800' : 'border-slate-800';
  const heading = color === 'orange' ? 'text-orange-300' : 'text-cyan-300';
  return (
    <div className={`rounded-3xl border ${border} bg-slate-900/80 p-6 shadow-xl shadow-slate-900/40`}>
      <h2 className={`text-xl font-bold ${heading} mb-4`}>{title}</h2>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500"
      />
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
  const [editing, setEditing] = useState<GameProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const loadProfiles = useCallback(async () => {
    try {
      const r = await api('/automation/profiles');
      setProfiles(await r.json());
    } catch {}
  }, [api]);

  const loadPlaylists = useCallback(async () => {
    try {
      const r = await api('/youtube/playlists');
      setPlaylists(await r.json());
    } catch {}
  }, [api]);

  useEffect(() => {
    loadProfiles();
    loadPlaylists();
  }, [loadProfiles, loadPlaylists]);

  const startNew = () => {
    setEditing({ id: 0, ...EMPTY_PROFILE });
    setIsNew(true);
    setStatus('');
  };

  const startEdit = (p: GameProfile) => {
    setEditing({ ...p });
    setIsNew(false);
    setStatus('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setStatus('');
  };

  const saveProfile = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.process_name.trim()) {
      setStatus('Le nom et le nom du processus sont obligatoires.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      const endpoint = isNew ? '/automation/profiles/add' : '/automation/profiles/update';
      await api(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      await loadProfiles();
      setEditing(null);
      setStatus('');
    } catch {
      setStatus('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (id: number) => {
    if (!confirm('Supprimer ce profil ?')) return;
    try {
      await api('/automation/profiles/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await loadProfiles();
    } catch {}
  };

  const toggleEnabled = async (p: GameProfile) => {
    const updated = { ...p, enabled: !p.enabled };
    try {
      await api('/automation/profiles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      await loadProfiles();
    } catch {}
  };

  const set = <K extends keyof GameProfile>(key: K, value: GameProfile[K]) => {
    setEditing(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-900/40">
        <h1 className="text-2xl font-bold text-orange-300">Automatisation par jeu</h1>
        <p className="mt-2 text-slate-400 text-sm">
          Crée des profils par jeu. Quand le processus du jeu est détecté, le RGB, la musique et Discord se configurent automatiquement.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-slate-700 bg-slate-800/60 px-6 py-4 flex gap-4 items-start">
        <span className="text-2xl">⚡</span>
        <div className="text-sm text-slate-300 space-y-1">
          <p className="font-semibold text-slate-100">Comment ça marche</p>
          <p>Le backend surveille les processus Windows toutes les 3 secondes. Dès que le processus d'un jeu activé est détecté, les actions configurées se déclenchent : couleur RGB, playlist YouTube Music, et rejoindre un salon vocal Discord.</p>
        </div>
      </div>

      {/* Profile list */}
      <Card title={`Profils (${profiles.length})`} color="orange">
        {profiles.length === 0 && !editing && (
          <p className="text-slate-500 text-sm mb-4">Aucun profil configuré. Crée-en un pour commencer.</p>
        )}

        <div className="space-y-3 mb-4">
          {profiles.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 flex items-center gap-3">
              {/* Toggle enabled */}
              <button
                onClick={() => toggleEnabled(p)}
                className={`w-10 h-6 rounded-full transition-colors shrink-0 ${p.enabled ? 'bg-orange-500' : 'bg-slate-700'}`}
                title={p.enabled ? 'Activé' : 'Désactivé'}
              >
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${p.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 truncate">{p.process_name}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {p.rgb_enabled && p.rgb_color && (
                    <span className="flex items-center gap-1 text-xs text-slate-300 bg-slate-700/60 rounded-full px-2 py-0.5">
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-500" style={{ backgroundColor: p.rgb_color }} />
                      RGB
                    </span>
                  )}
                  {p.youtube_playlist_id && (
                    <span className="text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-full px-2 py-0.5">🎵 Music</span>
                  )}
                  {p.discord_voice_channel_id && (
                    <span className="text-xs text-indigo-300 bg-indigo-900/30 border border-indigo-800 rounded-full px-2 py-0.5">🎙 Discord</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-xl bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
                >
                  Modifier
                </button>
                <button
                  onClick={() => deleteProfile(p.id)}
                  className="rounded-xl bg-red-900/40 hover:bg-red-800/60 border border-red-800 px-3 py-1.5 text-xs font-medium text-red-300 transition"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {!editing && (
          <button
            onClick={startNew}
            className="w-full rounded-2xl bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold py-2.5 transition"
          >
            + Nouveau profil
          </button>
        )}
      </Card>

      {/* Editor */}
      {editing && (
        <Card title={isNew ? 'Nouveau profil' : `Modifier — ${editing.name}`} color="orange">
          <div className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nom du profil"
                value={editing.name}
                onChange={v => set('name', v)}
                placeholder="Ex: Fortnite, Minecraft…"
              />
              <Input
                label="Nom du processus"
                value={editing.process_name}
                onChange={v => set('process_name', v)}
                placeholder="Ex: FortniteClient-Win64-Shipping.exe"
              />
            </div>
            <p className="text-xs text-slate-500">
              Le nom du processus peut être partiel (case insensitive). Trouve-le dans le Gestionnaire des tâches → onglet Détails.
            </p>

            {/* RGB */}
            <div className="rounded-2xl border border-purple-900 bg-purple-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-300">🌈 RGB</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-slate-400">Activer le RGB</span>
                  <button
                    onClick={() => set('rgb_enabled', !editing.rgb_enabled)}
                    className={`w-10 h-6 rounded-full transition-colors ${editing.rgb_enabled ? 'bg-purple-500' : 'bg-slate-700'}`}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${editing.rgb_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </label>
              </div>
              {editing.rgb_enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300">Couleur</label>
                  <input
                    type="color"
                    value={editing.rgb_color ?? '#00ffff'}
                    onChange={e => set('rgb_color', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-600 bg-transparent"
                  />
                  <span className="text-sm text-slate-400 font-mono">{editing.rgb_color}</span>
                </div>
              )}
            </div>

            {/* YouTube Music */}
            <div className="rounded-2xl border border-red-900 bg-red-950/20 p-4 space-y-3">
              <span className="font-semibold text-red-300">🎵 YouTube Music</span>
              {playlists.length > 0 ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">Playlist à lancer</label>
                  <select
                    value={editing.youtube_playlist_id ?? ''}
                    onChange={e => set('youtube_playlist_id', e.target.value || null)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-red-500"
                  >
                    <option value="">— Aucune —</option>
                    {playlists.map(pl => (
                      <option key={pl.id} value={pl.playlist_id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Aucune playlist sauvegardée. Ajoute-en une dans la section Contrôle.</p>
              )}
            </div>

            {/* Discord */}
            <div className="rounded-2xl border border-indigo-900 bg-indigo-950/20 p-4 space-y-3">
              <span className="font-semibold text-indigo-300">🎙 Discord — Rejoindre un salon vocal</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Guild ID (serveur)"
                  value={editing.discord_guild_id ?? ''}
                  onChange={v => set('discord_guild_id', v || null)}
                  placeholder="123456789012345678"
                />
                <Input
                  label="Channel ID (salon vocal)"
                  value={editing.discord_voice_channel_id ?? ''}
                  onChange={v => set('discord_voice_channel_id', v || null)}
                  placeholder="123456789012345678"
                />
              </div>
              <p className="text-xs text-slate-500">
                Clic droit sur le serveur/salon dans Discord → Copier l'identifiant (mode développeur requis).
              </p>
            </div>

            {status && (
              <p className="text-sm text-red-400 rounded-xl bg-red-950/40 border border-red-800 px-3 py-2">{status}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 transition"
              >
                {saving ? 'Sauvegarde…' : 'Sauvegarder le profil'}
              </button>
              <button
                onClick={cancelEdit}
                className="rounded-2xl bg-slate-700 hover:bg-slate-600 px-6 py-2.5 font-medium text-slate-200 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
