import { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

type DiscordSectionProps = {
  token: string;
  onUnauthorized: () => void;
};

export default function DiscordSection({ token, onUnauthorized }: DiscordSectionProps) {
  const [botConfigured, setBotConfigured] = useState<boolean | null>(null);
  const [appIdConfigured, setAppIdConfigured] = useState<boolean | null>(null);
  const [secretConfigured, setSecretConfigured] = useState<boolean | null>(null);

  const [botToken, setBotToken] = useState('');
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Send message state
  const [msgChannelId, setMsgChannelId] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgResult, setMsgResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Join voice state
  const [voiceGuildId, setVoiceGuildId] = useState('');
  const [voiceChannelId, setVoiceChannelId] = useState('');
  const [voiceResult, setVoiceResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [joiningVoice, setJoiningVoice] = useState(false);

  useEffect(() => {
    apiFetch('http://127.0.0.1:3000/discord/config', {}, token)
      .then((r) => r.json())
      .then((d) => {
        setBotConfigured(d.bot_configured);
        setAppIdConfigured(d.app_id_configured);
        setSecretConfigured(d.secret_configured);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'UNAUTHORIZED') onUnauthorized();
      });
  }, [token]);

  const saveConfig = async () => {
    if (!botToken.trim() && !appId.trim() && !clientSecret.trim()) return;
    setSavingConfig(true);
    setConfigSaved(false);
    try {
      await apiFetch('http://127.0.0.1:3000/discord/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: botToken.trim() || undefined,
          app_id: appId.trim() || undefined,
          client_secret: clientSecret.trim() || undefined,
        }),
      }, token);
      if (botToken.trim()) setBotConfigured(true);
      if (appId.trim()) setAppIdConfigured(true);
      if (clientSecret.trim()) setSecretConfigured(true);
      setBotToken('');
      setAppId('');
      setClientSecret('');
      setConfigSaved(true);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') onUnauthorized();
    } finally {
      setSavingConfig(false);
    }
  };

  const sendMessage = async () => {
    if (!msgChannelId.trim() || !msgText.trim()) return;
    setSendingMsg(true);
    setMsgResult(null);
    try {
      const res = await apiFetch('http://127.0.0.1:3000/discord/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: msgChannelId.trim(), message: msgText.trim() }),
      }, token);
      const data = await res.json();
      setMsgResult(data);
      if (data.success) setMsgText('');
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') onUnauthorized();
      else setMsgResult({ success: false, error: String(err) });
    } finally {
      setSendingMsg(false);
    }
  };

  const joinVoice = async () => {
    if (!voiceGuildId.trim() || !voiceChannelId.trim()) return;
    setJoiningVoice(true);
    setVoiceResult(null);
    try {
      const res = await apiFetch('http://127.0.0.1:3000/discord/join_voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild_id: voiceGuildId.trim(), channel_id: voiceChannelId.trim() }),
      }, token);
      const data = await res.json();
      setVoiceResult(data);
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') onUnauthorized();
      else setVoiceResult({ success: false, error: String(err) });
    } finally {
      setJoiningVoice(false);
    }
  };

  const StatusBadge = ({ ok }: { ok: boolean | null }) => {
    if (ok === null) return null;
    return ok
      ? <span className="ml-2 rounded-full bg-green-900/40 border border-green-700 px-2 py-0.5 text-xs text-green-300">✓ Configuré</span>
      : <span className="ml-2 rounded-full bg-yellow-900/40 border border-yellow-700 px-2 py-0.5 text-xs text-yellow-300">Non configuré</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">💬</span>
        <div>
          <h1 className="text-2xl font-bold text-indigo-300">Contrôle Discord</h1>
          <p className="text-sm text-slate-400">Envoyez des messages et rejoignez des salons vocaux</p>
        </div>
      </div>

      {/* Config section */}
      <section className="rounded-3xl border border-indigo-800/50 bg-indigo-950/10 p-6 space-y-5">
        <h2 className="text-indigo-300 font-semibold text-lg">⚙️ Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bot token */}
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-sm text-slate-300">🤖 Token du bot</span>
              <StatusBadge ok={botConfigured} />
            </div>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={botConfigured ? 'Nouveau token…' : 'MTxx…'}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition"
            />
            <p className="text-xs text-slate-500">Utilisé pour envoyer des messages via l'API Discord.</p>
          </div>

          {/* App ID */}
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-sm text-slate-300">🔑 Application ID</span>
              <StatusBadge ok={appIdConfigured} />
            </div>
            <input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder={appIdConfigured ? 'Nouvel App ID…' : '123456789012345678'}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono"
            />
            <p className="text-xs text-slate-500">
              Visible en haut de la page de ton app sur{' '}
              <span className="text-indigo-400">discord.com/developers/applications</span>.
            </p>
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-sm text-slate-300">🔒 Client Secret</span>
              <StatusBadge ok={secretConfigured} />
            </div>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={secretConfigured ? 'Nouveau secret…' : 'aBcDeFgH…'}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition"
            />
            <p className="text-xs text-slate-500">
              Developer Portal → ton app → <span className="text-indigo-300">OAuth2</span> → "Client Secret". Requis pour l'auth RPC vocal.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveConfig}
            disabled={savingConfig || (!botToken.trim() && !appId.trim())}
            className="rounded-2xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
          >
            {savingConfig ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          {configSaved && <span className="text-sm text-green-400">✓ Sauvegardé</span>}
        </div>

        {/* RPC setup hint */}
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">💡 Activer le RPC pour rejoindre un vocal</p>
          <p>Dans le Developer Portal → ton application → <span className="text-indigo-300">OAuth2</span> → activer <span className="text-indigo-300">Rich Presence</span> (RPC).</p>
          <p>Ajoute aussi <code className="bg-slate-700 px-1 rounded">127.0.0.1</code> dans les <span className="text-indigo-300">Redirects</span> si demandé.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send message */}
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">📨 Envoyer un message</h2>

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du salon texte</span>
            <input
              value={msgChannelId}
              onChange={(e) => setMsgChannelId(e.target.value)}
              placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Message</span>
            <textarea
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Votre message…"
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition resize-none"
            />
          </label>

          <button
            onClick={sendMessage}
            disabled={sendingMsg || !msgChannelId.trim() || !msgText.trim() || !botConfigured}
            className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
          >
            {sendingMsg ? 'Envoi…' : '📨 Envoyer'}
          </button>

          {!botConfigured && <p className="text-xs text-yellow-400">⚠️ Configurez le token du bot d'abord</p>}

          {msgResult && (
            <div className={`rounded-2xl border p-3 text-sm ${msgResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
              {msgResult.success ? '✓ Message envoyé' : `✗ ${msgResult.error}`}
            </div>
          )}
        </section>

        {/* Join voice */}
        <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">🔊 Rejoindre un salon vocal</h2>

          <p className="text-xs text-slate-400">
            Utilise le RPC local de Discord pour te faire rejoindre directement le salon vocal.
          </p>

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du serveur (Guild)</span>
            <input
              value={voiceGuildId}
              onChange={(e) => setVoiceGuildId(e.target.value)}
              placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400 uppercase tracking-wider">ID du salon vocal</span>
            <input
              value={voiceChannelId}
              onChange={(e) => setVoiceChannelId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinVoice()}
              placeholder="123456789012345678"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 transition font-mono"
            />
          </label>

          <button
            onClick={joinVoice}
            disabled={joiningVoice || !voiceGuildId.trim() || !voiceChannelId.trim() || !appIdConfigured}
            className="w-full rounded-2xl bg-green-700 py-2.5 font-semibold text-white hover:bg-green-600 disabled:opacity-40 transition"
          >
            {joiningVoice ? 'Connexion…' : '🔊 Rejoindre le vocal'}
          </button>

          {!appIdConfigured && <p className="text-xs text-yellow-400">⚠️ Configurez l'Application ID d'abord</p>}

          {voiceResult && (
            <div className={`rounded-2xl border p-3 text-sm ${voiceResult.success ? 'border-green-700 bg-green-950/40 text-green-300' : 'border-red-700 bg-red-950/40 text-red-300'}`}>
              {voiceResult.success ? '✓ Connecté au salon vocal' : `✗ ${voiceResult.error}`}
            </div>
          )}

          <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">💡 Comment trouver les IDs ?</p>
            <p>Discord → Paramètres → Avancés → Activer le mode développeur</p>
            <p>Clic droit sur le serveur / salon → "Copier l'identifiant"</p>
          </div>
        </section>
      </div>
    </div>
  );
}
