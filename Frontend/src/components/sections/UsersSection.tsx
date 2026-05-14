import { useState } from 'react';

type UsersSectionProps = {
  newUserId: string;
  setNewUserId: (value: string) => void;
  newUserPassword: string;
  setNewUserPassword: (value: string) => void;
  deleteUserId: string;
  setDeleteUserId: (value: string) => void;
  deleteUserPassword: string;
  setDeleteUserPassword: (value: string) => void;
  onCreateUser: () => void;
  onDeleteUser: () => void;
};

type Tab = 'create' | 'delete';

export default function UsersSection({
  newUserId,
  setNewUserId,
  newUserPassword,
  setNewUserPassword,
  deleteUserId,
  setDeleteUserId,
  deleteUserPassword,
  setDeleteUserPassword,
  onCreateUser,
  onDeleteUser,
}: UsersSectionProps) {
  const [tab, setTab] = useState<Tab>('create');
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [showDeletePwd, setShowDeletePwd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCreate = tab === 'create';

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDeleteUser();
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Utilisateurs</h2>
        <p className="text-sm text-slate-400 mt-1">Gérer les comptes autorisés à accéder à l'agent</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl border border-slate-700 bg-slate-900/60 p-1 w-fit gap-1">
        <button
          onClick={() => { setTab('create'); setConfirmDelete(false); }}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
            isCreate ? 'bg-green-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          + Créer
        </button>
        <button
          onClick={() => { setTab('delete'); setConfirmDelete(false); }}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
            !isCreate ? 'bg-red-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🗑 Supprimer
        </button>
      </div>

      {/* Create panel */}
      {isCreate && (
        <section className="rounded-3xl border border-green-800/50 bg-green-950/10 p-6">
          <h3 className="text-lg font-semibold text-green-300 mb-1">Nouvel utilisateur</h3>
          <p className="text-xs text-slate-500 mb-5">Le compte créé pourra se connecter et contrôler l'agent.</p>

          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <label className="block">
              <span className="text-slate-300 text-sm">Identifiant</span>
              <input
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onCreateUser()}
                placeholder="alice"
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-green-400 transition"
              />
            </label>

            <label className="block">
              <span className="text-slate-300 text-sm">Mot de passe</span>
              <div className="relative mt-2">
                <input
                  type={showCreatePwd ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onCreateUser()}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 pr-11 text-slate-100 outline-none focus:border-green-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showCreatePwd ? '🙈' : '👁'}
                </button>
              </div>
            </label>
          </div>

          <button
            onClick={onCreateUser}
            disabled={!newUserId.trim() || !newUserPassword.trim()}
            className="mt-5 rounded-2xl bg-green-600 px-8 py-3 font-semibold text-slate-100 transition hover:bg-green-500 disabled:opacity-40"
          >
            + Créer le compte
          </button>
        </section>
      )}

      {/* Delete panel */}
      {!isCreate && (
        <section className="rounded-3xl border border-red-800/50 bg-red-950/10 p-6">
          <h3 className="text-lg font-semibold text-red-300 mb-1">Supprimer un utilisateur</h3>
          <p className="text-xs text-slate-500 mb-5">Le compte sera définitivement supprimé. Son mot de passe est requis pour confirmer.</p>

          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <label className="block">
              <span className="text-slate-300 text-sm">Identifiant</span>
              <input
                value={deleteUserId}
                onChange={(e) => { setDeleteUserId(e.target.value); setConfirmDelete(false); }}
                placeholder="alice"
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-red-400 transition"
              />
            </label>

            <label className="block">
              <span className="text-slate-300 text-sm">Mot de passe du compte</span>
              <div className="relative mt-2">
                <input
                  type={showDeletePwd ? 'text' : 'password'}
                  value={deleteUserPassword}
                  onChange={(e) => { setDeleteUserPassword(e.target.value); setConfirmDelete(false); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 pr-11 text-slate-100 outline-none focus:border-red-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showDeletePwd ? '🙈' : '👁'}
                </button>
              </div>
            </label>
          </div>

          {confirmDelete && (
            <div className="mt-4 max-w-xl rounded-2xl border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              ⚠️ Supprimer définitivement <span className="font-semibold text-red-200">"{deleteUserId}"</span> ? Cette action est irréversible.
            </div>
          )}

          <button
            onClick={handleDelete}
            disabled={!deleteUserId.trim() || !deleteUserPassword.trim()}
            className={`mt-4 rounded-2xl px-8 py-3 font-semibold transition disabled:opacity-40 ${
              confirmDelete
                ? 'bg-red-500 text-slate-100 hover:bg-red-400 animate-pulse'
                : 'bg-red-700 text-slate-100 hover:bg-red-600'
            }`}
          >
            {confirmDelete ? '⚠️ Confirmer la suppression' : '🗑 Supprimer le compte'}
          </button>

          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="mt-2 ml-3 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              Annuler
            </button>
          )}
        </section>
      )}
    </div>
  );
}
