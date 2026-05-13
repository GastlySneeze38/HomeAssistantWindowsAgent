import { HistoryEntry } from '../../types';

type HistorySectionProps = {
  history: HistoryEntry[];
};

export default function HistorySection({ history }: HistorySectionProps) {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
      <h2 className="text-2xl font-semibold text-slate-100">Historique des actions</h2>

      <div className="mt-4 overflow-x-auto">
        {history.length > 0 ? (
          <table className="w-full text-slate-300">
            <thead>
              <tr>
                <th className="border-b border-slate-700 p-2 text-left">ID</th>
                <th className="border-b border-slate-700 p-2 text-left">Action</th>
                <th className="border-b border-slate-700 p-2 text-left">Commande</th>
                <th className="border-b border-slate-700 p-2 text-left">Succès</th>
                <th className="border-b border-slate-700 p-2 text-left">Erreur</th>
                <th className="border-b border-slate-700 p-2 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="border-b border-slate-800 p-2">{entry.id}</td>
                  <td className="border-b border-slate-800 p-2">{entry.action_type}</td>
                  <td className="border-b border-slate-800 p-2">{entry.command}</td>
                  <td className="border-b border-slate-800 p-2">{entry.success ? 'Oui' : 'Non'}</td>
                  <td className="border-b border-slate-800 p-2">{entry.error || 'Aucune'}</td>
                  <td className="border-b border-slate-800 p-2">{entry.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-400">Aucune action enregistrée.</p>
        )}
      </div>
    </section>
  );
}