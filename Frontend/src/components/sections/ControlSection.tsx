import { AppEntry, CloseResponse, LaunchResponse } from '../../types';

type ControlSectionProps = {
  isOnline: boolean;
  apps: AppEntry[];
  command: string;
  setCommand: (value: string) => void;
  closeCommand: string;
  setCloseCommand: (value: string) => void;
  launchResult: LaunchResponse | null;
  closeResult: CloseResponse | null;
  error: string | null;
  onLaunch: () => void;
  onClose: () => void;
};

export default function ControlSection({
  isOnline,
  apps,
  command,
  setCommand,
  closeCommand,
  setCloseCommand,
  launchResult,
  closeResult,
  error,
  onLaunch,
  onClose,
}: ControlSectionProps) {
  return (
    <>
      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-semibold text-slate-100">Lancer une application</h2>

        {/* Quick-launch buttons for registered apps */}
        {apps.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-2">Accès rapide</p>
            <div className="flex flex-wrap gap-2">
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setCommand(app.name)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                    command === app.name
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <label className="block max-w-xl">
            <span className="text-slate-300">Commande</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="notepad, valorant, chrome..."
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>

          <button
            onClick={onLaunch}
            disabled={!isOnline}
            className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
          >
            Lancer
          </button>
        </div>

        {launchResult && (
          <div className={`mt-6 rounded-2xl border p-4 ${launchResult.success ? 'border-green-700 bg-green-950/40' : 'border-red-700 bg-red-950/40'}`}>
            <p className={`font-semibold ${launchResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {launchResult.success ? '✓ Lancé avec succès' : '✗ Échec du lancement'}
            </p>
            {launchResult.error && <p className="mt-1 text-sm text-red-300">{launchResult.error}</p>}
            {(launchResult.stdout || launchResult.stderr) && (
              <div className="mt-3 text-xs text-slate-400">
                {launchResult.stdout && <pre className="whitespace-pre-wrap">{launchResult.stdout}</pre>}
                {launchResult.stderr && <pre className="whitespace-pre-wrap text-red-400">{launchResult.stderr}</pre>}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-red-400">{error}</p>}
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-semibold text-slate-100">Fermer une application</h2>

        {/* Quick-close buttons for registered apps */}
        {apps.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-2">Accès rapide</p>
            <div className="flex flex-wrap gap-2">
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setCloseCommand(app.name)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                    closeCommand === app.name
                      ? 'border-red-400 bg-red-500/20 text-red-300'
                      : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <label className="block max-w-xl">
            <span className="text-slate-300">Application</span>
            <input
              value={closeCommand}
              onChange={(e) => setCloseCommand(e.target.value)}
              placeholder="valorant, notepad, calc..."
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>

          <button
            onClick={onClose}
            disabled={!isOnline}
            className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-slate-100 transition hover:bg-red-500 disabled:opacity-40"
          >
            Fermer
          </button>
        </div>

        {closeResult && (
          <div className={`mt-6 rounded-2xl border p-4 ${closeResult.success ? 'border-green-700 bg-green-950/40' : 'border-red-700 bg-red-950/40'}`}>
            <p className={`font-semibold ${closeResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {closeResult.success ? '✓ Application fermée' : '✗ Échec de la fermeture'}
            </p>
            {closeResult.error && <p className="mt-1 text-sm text-red-300">{closeResult.error}</p>}
            {(closeResult.stdout || closeResult.stderr) && (
              <div className="mt-3 text-xs text-slate-400">
                {closeResult.stdout && <pre className="whitespace-pre-wrap">{closeResult.stdout}</pre>}
                {closeResult.stderr && <pre className="whitespace-pre-wrap text-red-400">{closeResult.stderr}</pre>}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-red-400">{error}</p>}
      </section>
    </>
  );
}
