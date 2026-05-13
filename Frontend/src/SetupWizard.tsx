import { useState } from 'react';

type Step = 'welcome' | 'create' | 'done';

type Props = {
  onSetupComplete: () => void;
};

function SetupWizard({ onSetupComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError("Le nom d'utilisateur doit faire au moins 3 caractères.");
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // 1. Connexion avec le compte admin par défaut
      const loginRes = await fetch('http://127.0.0.1:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success || !loginData.token) {
        setError("Impossible de contacter le backend. Vérifiez qu'il est démarré.");
        setLoading(false);
        return;
      }
      const adminToken: string = loginData.token;

      // 2. Créer le nouvel utilisateur
      const createRes = await fetch('http://127.0.0.1:3000/create_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ username, password }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        setError("Erreur lors de la création du compte. Ce nom d'utilisateur existe peut-être déjà.");
        setLoading(false);
        return;
      }

      // 3. Supprimer le compte admin par défaut
      const deleteRes = await fetch('http://127.0.0.1:3000/setup/finalize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const deleteData = await deleteRes.json();
      if (!deleteData.success) {
        setError(`Erreur lors de la suppression du compte admin : ${deleteData.error ?? deleteRes.status}`);
        setLoading(false);
        return;
      }

      // 4. Déconnexion du token admin
      await fetch('http://127.0.0.1:3000/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      setStep('done');
    } catch {
      setError('Erreur réseau. Vérifiez que le backend est démarré.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl">
            🚀
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Bienvenue !</h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            C'est votre première connexion. Avant de commencer, vous devez créer votre compte administrateur personnel.
          </p>
        </div>

        <div className="text-left bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ce que vous allez faire</p>
          <ol className="flex flex-col gap-2">
            {[
              'Choisir un nom d\'utilisateur et un mot de passe',
              'Votre compte sera créé automatiquement',
              'Le compte admin par défaut sera supprimé',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={() => setStep('create')}
          className="bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] transition text-white font-semibold rounded-xl py-3 shadow-lg shadow-cyan-500/20"
        >
          Créer mon compte
        </button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-6 text-center items-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-3xl">
          ✅
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-100">Compte créé !</h2>
          <p className="text-slate-400 text-sm">
            Votre compte <span className="text-slate-200 font-medium">@{username}</span> est prêt.
            Vous pouvez maintenant vous connecter.
          </p>
        </div>
        <button
          onClick={onSetupComplete}
          className="bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] transition text-white font-semibold rounded-xl py-3 px-8 shadow-lg shadow-cyan-500/20"
        >
          Se connecter
        </button>
      </div>
    );
  }

  // step === 'create'
  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-100">Créer votre compte</h2>
        <p className="text-slate-400 text-sm">Ce sera le seul compte administrateur.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-400 font-medium">Nom d'utilisateur</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex: john"
          autoFocus
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-400 font-medium">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6 caractères minimum"
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-400 font-medium">Confirmer le mot de passe</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Répétez le mot de passe"
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep('welcome')}
          className="flex-1 bg-slate-800 hover:bg-slate-700 transition text-slate-300 font-semibold rounded-xl py-3"
        >
          Retour
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition text-white font-semibold rounded-xl py-3 shadow-lg shadow-cyan-500/20"
        >
          {loading ? 'Création...' : 'Créer le compte'}
        </button>
      </div>
    </form>
  );
}

export default SetupWizard;
