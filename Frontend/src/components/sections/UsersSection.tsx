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
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
      <h2 className="text-2xl font-semibold text-slate-100">Création d’utilisateur</h2>

      <div className="mt-4 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-slate-300">Nouvel Identifiant</span>
            <input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>

          <label className="block">
            <span className="text-slate-300">Mot de passe</span>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <button
          onClick={onCreateUser}
          className="rounded-2xl bg-green-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-green-400"
        >
          Ajouter Utilisateur
        </button>

        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-xl font-semibold text-slate-100">Supprimer un utilisateur</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-slate-300">Identifiant à supprimer</span>
              <input
                value={deleteUserId}
                onChange={(e) => setDeleteUserId(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block">
              <span className="text-slate-300">Mot de passe</span>
              <input
                type="password"
                value={deleteUserPassword}
                onChange={(e) => setDeleteUserPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <button
            onClick={onDeleteUser}
            className="mt-4 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-slate-950 transition hover:bg-red-500"
          >
            Supprimer Utilisateur
          </button>
        </div>
      </div>
    </section>
  );
}