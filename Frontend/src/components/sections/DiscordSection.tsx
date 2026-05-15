import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api';

type Props = { token: string; onUnauthorized: () => void };

type DiscordRole   = { id: number; guild_id: string; role_id: string; name: string };
type DiscordMember = { id: number; user_id: string; name: string };
type Tab = 'message' | 'voice' | 'roles' | 'members';

const API = 'http://127.0.0.1:3000';

function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return ok
    ? <span className="ml-2 rounded-full bg-green-900/40 border border-green-700 px-2 py-0.5 text-xs text-green-300">✓ Configuré</span>
    : <span className="ml-2 rounded-full bg-yellow-900/40 border border-yellow-700 px-2 py-0.5 text-xs text-yellow-300">Non configuré</span>;
}

export default function DiscordSection({ token, onUnauthorized }: Props) {
  const api = (path: string, opts: RequestInit = {}) =>
    apiFetch(`${API}${path}`, opts, token).catch((e: Error) => {
      if (e.message === 'UNAUTHORIZED') onUnauthorized();
      throw e;
    });

  // ── Config ──────────────────────────────────────────────────────────────────
  const [botConfigured, setBotConfigured]       = useState<boolean | null>(null);
  const [appIdConfigured, setAppIdConfigured]   = useState<boolean | null>(null);
  const [secretConfigured, setSecretConfigured] = useState<boolean | null>(null);
  const [botToken, setBotToken]         = useState('');
  const [appId, setAppId]               = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved]   = useState(false);
  const [configOpen, setConfigOpen]     = useState(false);

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('message');

  // ── Message ─────────────────────────────────────────────────────────────────
  const [msgChannelId, setMsgChannelId] = useState('');
  const [msgText, setMsgText]           = useState('');
  const [msgResult, setMsgResult]       = useState<{ success: boolean; error?: string } | null>(null);
  const [sendingMsg, setSendingMsg]     = useState(false);

  // ── Voice ───────────────────────────────────────────────────────────────────
  const [voiceGuildId, setVoiceGuildId]     = useState('');
  const [voiceChannelId, setVoiceChannelId] = useState('');
  const [voiceResult, setVoiceResult]       = useState<{ success: boolean; error?: string } | null>(null);
  const [joiningVoice, setJoiningVoice]     = useState(false);

  // ── Roles ───────────────────────────────────────────────────────────────────
  const [roles, setRoles]                 = useState<DiscordRole[]>([]);
  const [fetchGuildId, setFetchGuildId]   = useState('');
  const [fetchingRoles, setFetchingRoles] = useState(false);
  const [roleStatus, setRoleStatus]       = useState('');
  const [newRoleGuild, setNewRoleGuild]   = useState('');
  const [newRoleId, setNewRoleId]         = useState('');
  const [newRoleName, setNewRoleName]     = useState('');

  // ── Members ─────────────────────────────────────────────────────────────────
  const [members, setMembers]                   = useState<DiscordMember[]>([]);
  const [fetchMemberGuildId, setFetchMemberGuildId] = useState('');
  const [fetchingMembers, setFetchingMembers]   = useState(false);
  const [memberStatus, setMemberStatus]         = useState('');
  const [newMemberId, setNewMemberId]           = useState('');
  const [newMemberName, setNewMemberName]       = useState('');

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    api('/discord/config').then(r => r.json()).then(d => {
      setBotConfigured(d.bot_configured);
      setAppIdConfigured(d.app_id_configured);
      setSecretConfigured(d.secret_configured);
    }).catch(() => {});
    api('/discord/roles').then(r => r.json()).then(setRoles).catch(() => {});
    api('/discord/members').then(r => r.json()).then(setMembers).catch(() => {});
  }, [token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Config save ─────────────────────────────────────────────────────────────
  const saveConfig = async () => {
    if (!botToken.trim() && !appId.trim() && !clientSecret.trim()) return;
    setSavingConfig(true); setConfigSaved(false);
    try {
      await api('/discord/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken.trim() || undefined,
          app_id: appId.trim() || undefined,
          client_secret: clientSecret.trim() || undefined,
        }),
      });
      if (botToken.trim()) setBotConfigured(true);
      if (appId.trim()) setAppIdConfigured(true);
      if (clientSecret.trim()) setSecretConfigured(true);
      setBotToken(''); setAppId(''); setClientSecret('');
      setConfigSaved(true);
    } catch {}
    finally { setSavingConfig(false); }
  };

  // ── Send message ─────────────────────────────────────────────────────────────
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
    } catch (e: unknown) {
      setMsgResult({ success: false, error: String(e) });
    } finally { setSendingMsg(false); }
  };

  // ── Join voice ───────────────────────────────────────────────────────────────
  const joinVoice = async () => {
    if (!voiceGuildId.trim() || !voiceChannelId.trim()) return;
    setJoiningVoice(true); setVoiceResult(null);
    try {
      const res = await api('/discord/join_voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild_id: voiceGuildId.trim(), channel_id: voiceChannelId.trim() }),
      });
      setVoiceResult(await res.json());
    } catch (e: unknown) {
      setVoiceResult({ success: false, error: String(e) });
    } finally { setJoiningVoice(false); }
  };

  // ── Roles CRUD ───────────────────────────────────────────────────────────────
  const fetchRoles = async () => {
    if (!fetchGuildId.trim()) return;
    setFetchingRoles(true); setRoleStatus('');
    try {
      const res = await api('/discord/roles/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild_id: fetchGuildId.trim() }),
      });
      const data = await res.json();
      setRoleStatus(data.success ? `✓ ${data.imported} rôle(s) importé(s)` : `✗ ${data.error}`);
      if (data.success) { const r = await api('/discord/roles'); setRoles(await r.json()); }
    } catch {} finally { setFetchingRoles(false); }
  };

  const addRole = async () => {
    if (!newRoleGuild.trim() || !newRoleId.trim() || !newRoleName.trim()) return;
    await api('/discord/roles/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guild_id: newRoleGuild.trim(), role_id: newRoleId.trim(), name: newRoleName.trim() }),
    });
    setNewRoleGuild(''); setNewRoleId(''); setNewRoleName('');
    const r = await api('/discord/roles'); setRoles(await r.json());
  };

  const deleteRole = async (role_id: string) => {
    await api('/discord/roles/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id }),
    });
    setRoles(prev => prev.filter(r => r.role_id !== role_id));
  };

  // ── Members CRUD ─────────────────────────────────────────────────────────────
  const fetchMembers = async () => {
    if (!fetchMemberGuildId.trim()) return;
    setFetchingMembers(true); setMemberStatus('');
    try {
      const res = await api('/discord/members/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild_id: fetchMemberGuildId.trim() }),
      });
      const data = await res.json();
      setMemberStatus(data.success ? `✓ ${data.imported} membre(s) importé(s)` : `✗ ${data.error}`);
      if (data.success) { const r = await api('/discord/members'); setMembers(await r.json()); }
    } catch {} finally { setFetchingMembers(false); }
  };

  const addMember = async () => {
    if (!newMemberId.trim() || !newMemberName.trim()) return;
    await api('/discord/members/add', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: newMemberId.trim(), name: newMemberName.trim() }),
    });
    setNewMemberId(''); setNewMemberName('');
    const r = await api('/discord/members'); setMembers(await r.json());
  };

  const deleteMember = async (user_id: string) => {
    await api('/discord/members/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    });
    setMembers(prev => prev.filter(m => m.user_id !== user_id));
  };

  // ── Tabs style ────────────────────────────────────────────────────────────────
  const tabClass = (t: Tab) =>
    `rounded-xl px-5 py-2 text-sm font-semibold transition ${
      tab === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">💬</span>
        <div>
          <h1 className="text-2xl font-bold text-indigo-300">Contrôle Discord</h1>
          <p className="text-sm text-slate-400">Messages, vocal, rôles et membres</p>
        </div>
      </div>

      {/* Config */}
      <section className="rounded-3xl border border-indigo-800/50 bg-indigo-950/10 overflow-hidden">
        {/* Header — always visible */}
        <button
          onClick={() => setConfigOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-indigo-950/20 transition"
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm transition-transform duration-200 ${configOpen ? 'rotate-90' : ''}`}>▶</span>
            <span className="text-indigo-300 font-semibold">⚙️ Configuration</span>
          </div>
          {/* Status dots — visibles même replié */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${botConfigured ? 'bg-green-400' : botConfigured === false ? 'bg-yellow-400' : 'bg-slate-600'}`} />
              <span className="text-slate-400">Token bot</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${appIdConfigured ? 'bg-green-400' : appIdConfigured === false ? 'bg-yellow-400' : 'bg-slate-600'}`} />
              <span className="text-slate-400">App ID</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${secretConfigured ? 'bg-green-400' : secretConfigured === false ? 'bg-yellow-400' : 'bg-slate-600'}`} />
              <span className="text-slate-400">Secret</span>
            </span>
          </div>
        </button>

        {/* Expandable body */}
        {configOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-indigo-800/40">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-1.5">
                <div className="flex items-center"><span className="text-sm text-slate-300">🤖 Token bot</span><StatusBadge ok={botConfigured} /></div>
                <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)}
                  placeholder={botConfigured ? 'Nouveau token…' : 'MTxx…'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center"><span className="text-sm text-slate-300">🔑 Application ID</span><StatusBadge ok={appIdConfigured} /></div>
                <input value={appId} onChange={e => setAppId(e.target.value)}
                  placeholder={appIdConfigured ? 'Nouvel ID…' : '12345…'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center"><span className="text-sm text-slate-300">🔒 Client Secret</span><StatusBadge ok={secretConfigured} /></div>
                <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                  placeholder={secretConfigured ? 'Nouveau secret…' : 'aBcD…'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveConfig} disabled={savingConfig || (!botToken.trim() && !appId.trim() && !clientSecret.trim())}
                className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition">
                {savingConfig ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              {configSaved && <span className="text-sm text-green-400">✓ Sauvegardé</span>}
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1 w-fit gap-1">
        <button onClick={() => setTab('message')} className={tabClass('message')}>📨 Message</button>
        <button onClick={() => setTab('voice')} className={tabClass('voice')}>🔊 Vocal</button>
        <button onClick={() => setTab('roles')} className={tabClass('roles')}>🏷️ Rôles <span className="ml-1 text-xs opacity-60">({roles.length})</span></button>
        <button onClick={() => setTab('members')} className={tabClass('members')}>👥 Membres <span className="ml-1 text-xs opacity-60">({members.length})</span></button>
      </div>

      {/* ── MESSAGE ────────────────────────────────────────────────────────────── */}
      {tab === 'message' && (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">📨 Envoyer un message</h2>

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du salon texte</span>
            <input value={msgChannelId} onChange={e => setMsgChannelId(e.target.value)}
              placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
          </label>

          {/* Mention pickers */}
          {(roles.length > 0 || members.length > 0) && (
            <div className="space-y-2">
              {roles.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Mentionner un rôle :</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.map(r => (
                      <button key={r.role_id} onClick={() => insertMention(`<@&${r.role_id}>`)}
                        className="rounded-lg border border-indigo-700 bg-indigo-900/30 px-2.5 py-1 text-xs text-indigo-200 hover:bg-indigo-800/50 transition">
                        @{r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {members.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Mentionner un membre :</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => (
                      <button key={m.user_id} onClick={() => insertMention(`<@${m.user_id}>`)}
                        className="rounded-lg border border-cyan-700 bg-cyan-900/30 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-800/50 transition">
                        @{m.name}
                      </button>
                    ))}
                    <button onClick={() => insertMention('@everyone')}
                      className="rounded-lg border border-red-700 bg-red-900/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-800/50 transition">
                      @everyone
                    </button>
                    <button onClick={() => insertMention('@here')}
                      className="rounded-lg border border-orange-700 bg-orange-900/30 px-2.5 py-1 text-xs text-orange-300 hover:bg-orange-800/50 transition">
                      @here
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Message</span>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Votre message…" rows={3}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition resize-none" />
          </label>

          <button onClick={sendMessage} disabled={sendingMsg || !msgChannelId.trim() || !msgText.trim() || !botConfigured}
            className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition">
            {sendingMsg ? 'Envoi…' : '📨 Envoyer'}
          </button>

          {!botConfigured && <p className="text-xs text-yellow-400">⚠️ Configurez le token du bot d'abord</p>}
          {msgResult && (
            <div className={`rounded-2xl border p-3 text-sm ${msgResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
              {msgResult.success ? '✓ Message envoyé' : `✗ ${msgResult.error}`}
            </div>
          )}
        </section>
      )}

      {/* ── VOCAL ──────────────────────────────────────────────────────────────── */}
      {tab === 'voice' && (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">🔊 Rejoindre un salon vocal</h2>
          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du serveur</span>
            <input value={voiceGuildId} onChange={e => setVoiceGuildId(e.target.value)} placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du salon vocal</span>
            <input value={voiceChannelId} onChange={e => setVoiceChannelId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinVoice()} placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
          </label>
          <button onClick={joinVoice} disabled={joiningVoice || !voiceGuildId.trim() || !voiceChannelId.trim() || !appIdConfigured}
            className="w-full rounded-2xl bg-green-700 py-2.5 font-semibold text-white hover:bg-green-600 disabled:opacity-40 transition">
            {joiningVoice ? 'Connexion…' : '🔊 Rejoindre'}
          </button>
          {!appIdConfigured && <p className="text-xs text-yellow-400">⚠️ Configurez l'Application ID d'abord</p>}
          {voiceResult && (
            <div className={`rounded-2xl border p-3 text-sm ${voiceResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
              {voiceResult.success ? '✓ Connecté au salon vocal' : `✗ ${voiceResult.error}`}
            </div>
          )}
          <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">💡 Trouver les IDs</p>
            <p>Discord → Paramètres → Avancés → Activer le mode développeur → clic droit → "Copier l'identifiant"</p>
          </div>
        </section>
      )}

      {/* ── RÔLES ──────────────────────────────────────────────────────────────── */}
      {tab === 'roles' && (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-200">🏷️ Rôles sauvegardés</h2>

          {/* Import depuis Discord */}
          <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/10 p-4 space-y-3">
            <p className="text-sm font-semibold text-indigo-300">Importer depuis Discord</p>
            <div className="flex gap-2">
              <input value={fetchGuildId} onChange={e => setFetchGuildId(e.target.value)}
                placeholder="ID du serveur" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              <button onClick={fetchRoles} disabled={fetchingRoles || !fetchGuildId.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition">
                {fetchingRoles ? '…' : 'Importer'}
              </button>
            </div>
            {roleStatus && <p className={`text-xs ${roleStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{roleStatus}</p>}
          </div>

          {/* Ajout manuel */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-300">Ajouter manuellement</p>
            <div className="grid grid-cols-3 gap-2">
              <input value={newRoleGuild} onChange={e => setNewRoleGuild(e.target.value)} placeholder="ID serveur"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              <input value={newRoleId} onChange={e => setNewRoleId(e.target.value)} placeholder="ID du rôle"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Nom du rôle"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition" />
            </div>
            <button onClick={addRole} disabled={!newRoleGuild.trim() || !newRoleId.trim() || !newRoleName.trim()}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-40 transition">
              + Ajouter
            </button>
          </div>

          {/* Liste */}
          {roles.length === 0
            ? <p className="text-sm text-slate-500 italic">Aucun rôle sauvegardé.</p>
            : (
              <div className="space-y-2">
                {roles.map(r => (
                  <div key={r.role_id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5">
                    <div>
                      <span className="font-semibold text-indigo-200">@{r.name}</span>
                      <span className="ml-3 font-mono text-xs text-slate-500">{r.role_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => insertMention(`<@&${r.role_id}>`)}
                        className="rounded-lg border border-indigo-700 px-2.5 py-1 text-xs text-indigo-300 hover:bg-indigo-900/40 transition"
                        title="Insérer dans le message">
                        @ Insérer
                      </button>
                      <button onClick={() => deleteRole(r.role_id)}
                        className="rounded-lg border border-red-800 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 transition">
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>
      )}

      {/* ── MEMBRES ────────────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-slate-200">👥 Membres sauvegardés</h2>

          {/* Import */}
          <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/10 p-4 space-y-3">
            <p className="text-sm font-semibold text-indigo-300">Importer depuis Discord</p>
            <p className="text-xs text-slate-500">Requiert l'intent <span className="text-indigo-300">Server Members</span> activé sur le bot.</p>
            <div className="flex gap-2">
              <input value={fetchMemberGuildId} onChange={e => setFetchMemberGuildId(e.target.value)}
                placeholder="ID du serveur" className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              <button onClick={fetchMembers} disabled={fetchingMembers || !fetchMemberGuildId.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition">
                {fetchingMembers ? '…' : 'Importer'}
              </button>
            </div>
            {memberStatus && <p className={`text-xs ${memberStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{memberStatus}</p>}
          </div>

          {/* Ajout manuel */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-300">Ajouter manuellement</p>
            <div className="flex gap-2">
              <input value={newMemberId} onChange={e => setNewMemberId(e.target.value)} placeholder="ID utilisateur"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono" />
              <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Pseudo"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition" />
              <button onClick={addMember} disabled={!newMemberId.trim() || !newMemberName.trim()}
                className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-40 transition">
                + Ajouter
              </button>
            </div>
          </div>

          {/* Liste */}
          {members.length === 0
            ? <p className="text-sm text-slate-500 italic">Aucun membre sauvegardé.</p>
            : (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5">
                    <div>
                      <span className="font-semibold text-cyan-200">@{m.name}</span>
                      <span className="ml-3 font-mono text-xs text-slate-500">{m.user_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { insertMention(`<@${m.user_id}>`); setTab('message'); }}
                        className="rounded-lg border border-cyan-700 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-900/40 transition"
                        title="Insérer dans le message">
                        @ Insérer
                      </button>
                      <button onClick={() => deleteMember(m.user_id)}
                        className="rounded-lg border border-red-800 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 transition">
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>
      )}
    </div>
  );
}
