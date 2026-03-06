import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtUSD, getApiError } from '../../lib/utils';

export default function EjecucionPage() {
  const [quotes, setQuotes] = useState([]);
  const [ois, setOis] = useState([]);
  const [selectedOi, setSelectedOi] = useState({}); // { [quoteId]: oiId }
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [q, o] = await Promise.all([
      api.get('/quotes?status=APROBADA'),
      api.get('/catalogs/ois?active=true'),
    ]);
    setQuotes(q.data);
    setOis(o.data);
    const init = {};
    q.data.forEach(quote => {
      const filtered = o.data.filter(oi => !quote.mallId || oi.mallId === quote.mallId);
      if (filtered.length) init[quote.id] = filtered[0].id;
    });
    setSelectedOi(init);
  };

  useEffect(() => { load(); }, []);

  const execute = async (q) => {
    const oiId = selectedOi[q.id];
    if (!oiId) return toast.error('Seleccioná una OI');
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/execute`, { oiId });
      toast.success(`Actividad #${q.id} ejecutada`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asignación de OI y Ejecución</h1>
        <p className="text-gray-500 text-sm mt-1">Convertí una cotización aprobada en actividad ejecutada asignándole la cuenta (OI) que pagará.</p>
      </div>

      {quotes.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">🎉</p>
          <p>No hay cotizaciones pendientes de ejecución.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map(q => {
            const oisFiltradas = q.mallId
              ? ois.filter(o => o.mallId === q.mallId)
              : ois;

            return (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between gap-6">
                  {/* Info izquierda */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">#{q.id}</span>
                      <h2 className="font-semibold text-gray-900">{q.activityName}</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">Creado por:</span> {q.creator?.username}
                      {q.mall && <> · <span className="font-medium">Mall sugerido:</span> {q.mall.name}</>}
                    </p>
                    {q.notes && <p className="text-sm text-blue-600 bg-blue-50 rounded px-3 py-1.5">📝 {q.notes}</p>}
                    <p className="text-lg font-bold text-brand-600">{fmtUSD(q.totalCostUsd)}</p>
                  </div>

                  {/* Asignación OI */}
                  <div className="w-72 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Asignar Cuenta (OI)</h3>
                    {oisFiltradas.length === 0 ? (
                      <p className="text-sm text-red-500">No hay OIs disponibles para este mall.</p>
                    ) : (
                      <>
                        <select
                          className="input"
                          value={selectedOi[q.id] || ''}
                          onChange={e => setSelectedOi(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                        >
                          {oisFiltradas.map(o => (
                            <option key={o.id} value={o.id}>{o.oiCode} — {o.oiName}</option>
                          ))}
                        </select>
                        <button
                          className="btn-primary w-full"
                          onClick={() => execute(q)}
                          disabled={loading}
                        >
                          ✅ Confirmar Ejecución #{q.id}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
