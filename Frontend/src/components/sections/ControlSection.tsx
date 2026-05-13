import { CloseResponse, LaunchResponse } from '../../types';

type ControlSectionProps = {
  isOnline: boolean;
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
        <div className="mt-4 space-y-4">
          <label className="block max-w-xl">
            <span className="text-slate-300">Application</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>

          <button
            onClick={onLaunch}
            className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Lancer
          </button>
        </div>

        {launchResult && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
            <p className="text-slate-200">Succès : {launchResult.success ? 'oui' : 'non'}</p>
            {launchResult.error && <p className="mt-2 text-red-300">Erreur : {launchResult.error}</p>}
            <div className="mt-3 text-slate-300">
              <p className="font-semibold">stdout</p>
              <pre className="whitespace-pre-wrap">{launchResult.stdout || '—'}</pre>
              <p className="mt-3 font-semibold">stderr</p>
              <pre className="whitespace-pre-wrap">{launchResult.stderr || '—'}</pre>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-red-400">{error}</p>}
      </section>

      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-semibold text-slate-100">Fermer une application</h2>
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
            className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-slate-950 transition hover:bg-red-500"
          >
            Fermer
          </button>
        </div>

        {closeResult && (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
            <p className="text-slate-200">Succès : {closeResult.success ? 'oui' : 'non'}</p>
            {closeResult.error && <p className="mt-2 text-red-300">Erreur : {closeResult.error}</p>}
            <div className="mt-3 text-slate-300">
              <p className="font-semibold">stdout</p>
              <pre className="whitespace-pre-wrap">{closeResult.stdout || '—'}</pre>
              <p className="mt-3 font-semibold">stderr</p>
              <pre className="whitespace-pre-wrap">{closeResult.stderr || '—'}</pre>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-red-400">{error}</p>}
      </section>

    </>
  );
}