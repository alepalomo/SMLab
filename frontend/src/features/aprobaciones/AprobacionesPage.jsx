import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtUSD, fmtGTQ, getApiError } from '../../lib/utils';

function Lightbox({ src, onClose }) {
  const handleKey = useCallback(e => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300 transition-colors"
        onClick={onClose}
      >×</button>
      <img
        src={src}
        alt="Render"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function RenderPanel({ quoteId, renderImagePath, onUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const imgUrl = renderImagePath ? `/renders/${renderImagePath}` : null;

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/quotes/${quoteId}/render`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated(quoteId, data.renderImagePath);
      toast.success('Render actualizado');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-500 mb-2">🖼️ Render</p>
      {imgUrl ? (
        <div className="space-y-2">
          <img
            src={imgUrl}
            alt="Render"
            className="max-h-48 rounded object-contain w-full bg-white border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={() => setLightbox(true)}
            title="Clic para ver en pantalla completa"
          />
          <div className="flex gap-2">
            <button className="btn-ghost text-xs py-1 px-2" onClick={() => setLightbox(true)}>🔍 Ver en pantalla completa</button>
            <label className="btn-secondary text-xs cursor-pointer">
              {uploading ? 'Subiendo...' : '🔄 Actualizar render'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
          </div>
          {lightbox && <Lightbox src={imgUrl} onClose={() => setLightbox(false)} />}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded p-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <span className="text-xl mb-1">📷</span>
          <span className="text-xs text-gray-500">{uploading ? 'Subiendo...' : 'Subir render'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

const fmtMonth = m => {
  const [y, mo] = m.split('-');
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][parseInt(mo) - 1] + ' ' + y;
};

export default function AprobacionesPage() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [closed, setClosed] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [malls, setMalls] = useState([]);
  const [prices, setPrices] = useState({});           // { [quoteId]: finalPrice }
  const [addForms, setAddForms] = useState({});       // { [quoteId]: { insumoId, qtyPersonas, unitsValue } }
  const [renders, setRenders] = useState({});         // { [quoteId]: renderImagePath }
  const [billingMaps, setBillingMaps] = useState({}); // { [quoteId]: { 'YYYY-MM': { mallIdStr: amount } } }
  const [newMonths, setNewMonths] = useState({});     // { [quoteId]: '' }
  const [savingBillings, setSavingBillings] = useState({});
  const [loading, setLoading] = useState(false);

  const updateRender = (quoteId, path) => setRenders(prev => ({ ...prev, [quoteId]: path }));

  const load = async () => {
    const [pend, act, cl, ins, mallList] = await Promise.all([
      api.get('/quotes?status=ENVIADA'),
      api.get('/quotes?status=APROBADA'),
      api.get('/quotes?status=LIQUIDADA'),
      api.get('/catalogs/insumos?active=true'),
      api.get('/catalogs/malls'),
    ]);
    setPending(pend.data);
    setActive(act.data);
    setClosed(cl.data);
    setInsumos(ins.data);
    setMalls(mallList.data);
    // Inicializar precios sugeridos
    const p = {};
    [...pend.data, ...act.data].forEach(q => {
      p[q.id] = q.finalSalePriceUsd ?? (q.totalCostUsd > 0 ? q.totalCostUsd / 0.30 : 0);
    });
    setPrices(p);
    // Inicializar forms de agregar insumo
    const af = {};
    pend.data.forEach(q => { af[q.id] = { insumoId: '', qtyPersonas: 1, unitsValue: 1 }; });
    setAddForms(af);
    // Inicializar renders
    const r = {};
    [...pend.data, ...act.data].forEach(q => { r[q.id] = q.renderImagePath ?? null; });
    setRenders(r);
    // Inicializar billing maps
    const bm = {};
    const nm = {};
    [...pend.data, ...act.data].forEach(q => {
      const map = {};
      for (const { month, mallId, amount } of (q.billingSchedule || [])) {
        if (!map[month]) map[month] = {};
        map[month][String(mallId ?? '_')] = amount;
      }
      bm[q.id] = map;
      nm[q.id] = '';
    });
    setBillingMaps(bm);
    setNewMonths(nm);
  };

  const addBillingMonth = (q, month) => {
    if (!month || billingMaps[q.id]?.[month]) return;
    const keys = q.mallIds?.length > 0 ? q.mallIds.map(String) : ['_'];
    setBillingMaps(bm => ({ ...bm, [q.id]: { ...bm[q.id], [month]: Object.fromEntries(keys.map(k => [k, 0])) } }));
    setNewMonths(nm => ({ ...nm, [q.id]: '' }));
  };

  const saveBilling = async (q) => {
    setSavingBillings(sb => ({ ...sb, [q.id]: true }));
    try {
      const flat = Object.entries(billingMaps[q.id] || {}).flatMap(([month, entries]) =>
        Object.entries(entries).map(([mid, amount]) => ({
          month,
          mallId: mid === '_' ? null : Number(mid),
          amount: Number(amount) || 0,
        }))
      );
      await api.put(`/quotes/${q.id}/billing`, { billingSchedule: flat });
      toast.success('Facturación guardada');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setSavingBillings(sb => ({ ...sb, [q.id]: false })); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (q) => {
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/approve`, { finalSalePriceUsd: prices[q.id] });
      toast.success(`Aprobada. Venta: ${fmtUSD(prices[q.id])}`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const reject = async (q) => {
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/reject`);
      toast('Devuelta a borrador');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const liquidate = async (q) => {
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/liquidate`);
      toast.success('Actividad liquidada');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const reactivate = async (q) => {
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/reactivate`);
      toast.success('Actividad reactivada');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const addLineAdmin = async (q) => {
    const f = addForms[q.id];
    if (!f?.insumoId) return toast.error('Seleccioná un insumo');
    setLoading(true);
    try {
      await api.post(`/quotes/${q.id}/lines-admin`, f);
      toast.success('Elemento agregado');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const TABS = [
    { key: 'pending', label: '⏳ Pendientes', count: pending.length },
    { key: 'active',  label: '🚀 Activas',    count: active.length },
    { key: 'closed',  label: '🏁 Liquidadas', count: closed.length },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de Aprobaciones</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
            {count > 0 && <span className="bg-brand-100 text-brand-700 text-xs rounded-full px-2 py-0.5">{count}</span>}
          </button>
        ))}
      </div>

      {/* TAB: PENDIENTES */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {pending.length === 0 && <EmptyState msg="Todo al día. No hay aprobaciones pendientes." />}
          {pending.map(q => {
            const costoUsd = q.totalCostUsd;
            const precioSugerido = costoUsd > 0 ? costoUsd / 0.30 : 0;
            const precioFinal = prices[q.id] ?? precioSugerido;
            const utilidad = precioFinal - costoUsd;
            const margen = precioFinal > 0 ? (utilidad / precioFinal) * 100 : 0;
            const af = addForms[q.id] || {};

            return (
              <details key={q.id} className="card overflow-hidden group">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 list-none">
                  <div>
                    <p className="font-semibold">📌 {q.activityName}</p>
                    <p className="text-xs text-gray-400">Por: {q.creator?.username} · {new Date(q.createdAt).toLocaleDateString('es-GT')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-600">{fmtUSD(costoUsd)}</p>
                    <p className="text-xs text-gray-400">costo total</p>
                  </div>
                </summary>
                <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                  {/* Info */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">Actividad:</span> <strong>{q.activityName}</strong></div>
                    <div><span className="text-gray-500">Mall:</span> <strong>{q.mall?.name || '—'}</strong></div>
                    <div><span className="text-gray-500">Notas:</span> {q.notes || '—'}</div>
                  </div>

                  {/* Líneas */}
                  <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Insumo</th>
                        <th className="px-3 py-2 text-right">Personas</th>
                        <th className="px-3 py-2 text-right">Unidades</th>
                        <th className="px-3 py-2 text-right">Costo Q</th>
                        <th className="px-3 py-2 text-right">Costo $</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {q.lines?.map(l => (
                        <tr key={l.id}>
                          <td className="px-3 py-2">{l.insumo?.name}</td>
                          <td className="px-3 py-2 text-right">{l.qtyPersonas}</td>
                          <td className="px-3 py-2 text-right">{l.unitsValue}</td>
                          <td className="px-3 py-2 text-right">{fmtGTQ(l.lineCostGtq)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmtUSD(l.lineCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Agregar elemento extra */}
                  <details className="border border-dashed border-gray-300 rounded-lg p-3">
                    <summary className="text-sm font-medium text-gray-600 cursor-pointer">➕ Agregar elemento extra</summary>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <select className="input col-span-2" value={af.insumoId || ''}
                        onChange={e => setAddForms(prev => ({ ...prev, [q.id]: { ...af, insumoId: e.target.value } }))}>
                        <option value="">Seleccionar insumo...</option>
                        {insumos.map(i => <option key={i.id} value={i.id}>{i.name} (Q{i.costGtq})</option>)}
                      </select>
                      <input type="number" min="1" placeholder="Personas" className="input" value={af.qtyPersonas || 1}
                        onChange={e => setAddForms(prev => ({ ...prev, [q.id]: { ...af, qtyPersonas: Number(e.target.value) } }))} />
                      <input type="number" min="1" placeholder="Días/Unid" className="input" value={af.unitsValue || 1}
                        onChange={e => setAddForms(prev => ({ ...prev, [q.id]: { ...af, unitsValue: Number(e.target.value) } }))} />
                    </div>
                    <button className="btn-secondary mt-2 text-xs" onClick={() => addLineAdmin(q)} disabled={loading}>Agregar</button>
                  </details>

                  {/* Render */}
                  <RenderPanel quoteId={q.id} renderImagePath={renders[q.id]} onUpdated={updateRender} />

                  {/* Facturación Mensual */}
                  <BillingPanel
                    q={q}
                    malls={malls}
                    billingMaps={billingMaps}
                    newMonths={newMonths}
                    savingBillings={savingBillings}
                    setBillingMaps={setBillingMaps}
                    setNewMonths={setNewMonths}
                    addBillingMonth={addBillingMonth}
                    saveBilling={saveBilling}
                  />

                  {/* Precio de venta */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Costo Base:</span><strong>{fmtUSD(costoUsd)}</strong></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Sugerido 70%:</span><strong className="text-brand-600">{fmtUSD(precioSugerido)}</strong></div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">💰 Precio Final de Venta (USD)</label>
                      <input type="number" min="0" step="10" className="input"
                        value={prices[q.id] ?? precioSugerido}
                        onChange={e => setPrices(p => ({ ...p, [q.id]: Number(e.target.value) }))} />
                      <p className={`text-xs mt-1 font-medium ${margen < 30 ? 'text-red-500' : 'text-green-600'}`}>
                        {margen < 30 ? '⚠️' : '✅'} Margen: {margen.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-3 justify-end pt-2">
                    <button className="btn-danger" onClick={() => reject(q)} disabled={loading}>❌ Rechazar</button>
                    <button className="btn-primary" onClick={() => approve(q)} disabled={loading}>✅ Aprobar con este Precio</button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* TAB: ACTIVAS */}
      {tab === 'active' && (
        <div className="space-y-4">
          {active.length === 0 && <EmptyState msg="No hay actividades activas actualmente." />}
          {active.map(q => (
            <details key={q.id} className="card overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 list-none">
                <div>
                  <p className="font-semibold">🚀 {q.activityName}</p>
                  <p className="text-xs text-gray-400">#{q.id} · {q.mall?.name || 'Sin mall'} · {new Date(q.createdAt).toLocaleDateString('es-GT')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {renders[q.id] && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🖼️ Render</span>}
                  <p className="font-bold text-brand-600">{fmtUSD(q.totalCostUsd)}</p>
                </div>
              </summary>
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                <RenderPanel quoteId={q.id} renderImagePath={renders[q.id]} onUpdated={updateRender} />
                <BillingPanel
                  q={q}
                  malls={malls}
                  billingMaps={billingMaps}
                  newMonths={newMonths}
                  savingBillings={savingBillings}
                  setBillingMaps={setBillingMaps}
                  setNewMonths={setNewMonths}
                  addBillingMonth={addBillingMonth}
                  saveBilling={saveBilling}
                />
                <div className="flex justify-end gap-3">
                  <button className="btn-secondary text-sm" onClick={() => liquidate(q)} disabled={loading}>🏁 Liquidar actividad</button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* TAB: LIQUIDADAS */}
      {tab === 'closed' && (
        <div className="space-y-4">
          {closed.length === 0 && <EmptyState msg="No hay actividades liquidadas aún." />}
          {closed.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Actividad</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closed.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">#{q.id}</td>
                      <td className="px-4 py-3 font-medium">{q.activityName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtUSD(q.totalCostUsd)}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn-ghost text-xs" onClick={() => reactivate(q)} disabled={loading}>🔄 Reactivar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="card p-10 text-center text-gray-400">
      <p className="text-3xl mb-2">✅</p>
      <p>{msg}</p>
    </div>
  );
}

function BillingPanel({ q, malls, billingMaps, newMonths, savingBillings, setBillingMaps, setNewMonths, addBillingMonth, saveBilling }) {
  const map = billingMaps[q.id] || {};
  const months = Object.keys(map).sort();

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-500 mb-3">📅 Facturación Mensual</p>
      <div className="flex gap-2 mb-3">
        <input
          type="month"
          className="input text-sm flex-1"
          value={newMonths[q.id] || ''}
          onChange={e => setNewMonths(nm => ({ ...nm, [q.id]: e.target.value }))}
        />
        <button
          className="btn-secondary text-xs"
          onClick={() => addBillingMonth(q, newMonths[q.id])}
          disabled={!newMonths[q.id] || !!map[newMonths[q.id]]}
        >
          + Agregar Mes
        </button>
      </div>
      {months.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">Sin meses de facturación.</p>
      ) : (
        <div className="space-y-2">
          {months.map(month => {
            const entries = map[month];
            const total = Object.values(entries).reduce((s, v) => s + (Number(v) || 0), 0);
            return (
              <div key={month} className="border border-gray-200 rounded overflow-hidden bg-white">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-medium">{fmtMonth(month)}</span>
                  <button
                    className="text-red-400 hover:text-red-600 text-xs"
                    onClick={() => setBillingMaps(bm => { const n = { ...bm, [q.id]: { ...bm[q.id] } }; delete n[q.id][month]; return n; })}
                  >
                    × Eliminar
                  </button>
                </div>
                {Object.entries(entries).map(([mid, amt]) => (
                  <div key={mid} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600">
                      {mid === '_' ? 'General' : (malls.find(m => m.id === Number(mid))?.name || `Mall #${mid}`)}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="number" min="0" className="input py-0.5 text-right text-xs w-24"
                        value={amt}
                        onChange={e => setBillingMaps(bm => ({
                          ...bm,
                          [q.id]: { ...bm[q.id], [month]: { ...bm[q.id][month], [mid]: e.target.value } }
                        }))}
                      />
                    </div>
                  </div>
                ))}
                {Object.keys(entries).length > 1 && (
                  <div className="flex justify-between px-3 py-1.5 bg-gray-50 text-xs font-medium border-t border-gray-100">
                    <span>Total mes</span><span>${total.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-end pt-1">
            <button
              className="btn-primary text-xs py-1.5"
              onClick={() => saveBilling(q)}
              disabled={savingBillings[q.id]}
            >
              {savingBillings[q.id] ? 'Guardando...' : '💾 Guardar Facturación'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
