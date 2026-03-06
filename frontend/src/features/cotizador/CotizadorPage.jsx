import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtUSD, fmtGTQ, STATUS_LABELS, STATUS_COLORS, getApiError } from '../../lib/utils';
import Modal from '../../components/Modal';

export default function CotizadorPage() {
  const [quotes, setQuotes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [malls, setMalls] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [activeQuote, setActiveQuote] = useState(null);
  const [tab, setTab] = useState('scratch'); // scratch | template | list
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form nuevo borrador
  const [form, setForm] = useState({ activityName: '', activityTypeId: '', mallIds: [], notes: '' });
  // Agregar insumo
  const [addForm, setAddForm] = useState({ insumoId: '', qtyPersonas: 1, unitsValue: 1 });
  const [filterCat, setFilterCat] = useState('Todas');
  // Template
  const [selTemplate, setSelTemplate] = useState('');
  const [newNameTpl, setNewNameTpl] = useState('');
  // Plantilla guardar
  const [plantillaNombre, setPlantillaNombre] = useState('');
  const [showPlantillaModal, setShowPlantillaModal] = useState(false);
  // Facturación mensual
  const [billingMap, setBillingMap] = useState({}); // { 'YYYY-MM': { mallIdStr|'_': amount } }
  const [newMonth, setNewMonth] = useState('');
  const [savingBilling, setSavingBilling] = useState(false);

  const load = useCallback(async () => {
    const [q, t, at, m, ins] = await Promise.all([
      api.get('/quotes?status=BORRADOR'),
      api.get('/quotes/templates'),
      api.get('/catalogs/activity-types'),
      api.get('/catalogs/malls'),
      api.get('/catalogs/insumos?active=true'),
    ]);
    setQuotes(q.data);
    setTemplates(t.data);
    setActivityTypes(at.data);
    setMalls(m.data);
    setInsumos(ins.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Inicializar billingMap cuando se navega a una cotización diferente
  useEffect(() => {
    const map = {};
    for (const { month, mallId, amount } of (activeQuote?.billingSchedule || [])) {
      if (!map[month]) map[month] = {};
      map[month][String(mallId ?? '_')] = amount;
    }
    setBillingMap(map);
  }, [activeQuote?.id]);

  // Si hay una cotización activa, recargarla
  const reloadActive = async id => {
    const { data } = await api.get(`/quotes/${id}`);
    setActiveQuote(data);
  };

  const createQuote = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/quotes', {
        activityName: form.activityName,
        activityTypeId: form.activityTypeId || null,
        mallIds: form.mallIds,
        notes: form.notes,
      });
      setActiveQuote(data);
      setShowNewModal(false);
      setForm({ activityName: '', activityTypeId: '', mallIds: [], notes: '' });
      toast.success('Cotización creada');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const loadFromTemplate = async () => {
    if (!selTemplate) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/quotes/${selTemplate}/clone`, {
        activityName: newNameTpl,
        asTemplate: false,
      });
      setActiveQuote(data);
      toast.success('Plantilla cargada');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const addLine = async () => {
    if (!addForm.insumoId) return toast.error('Seleccioná un insumo');
    setLoading(true);
    try {
      const { data } = await api.post(`/quotes/${activeQuote.id}/lines`, addForm);
      setActiveQuote(data.quote);
      setAddForm({ insumoId: '', qtyPersonas: 1, unitsValue: 1 });
      toast.success('Insumo agregado');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const removeLine = async lineId => {
    try {
      const { data } = await api.delete(`/quotes/${activeQuote.id}/lines/${lineId}`);
      setActiveQuote(data.quote);
    } catch (err) { toast.error(getApiError(err)); }
  };

  const submitQuote = async () => {
    setLoading(true);
    try {
      await api.post(`/quotes/${activeQuote.id}/submit`);
      toast.success('Cotización enviada a aprobación');
      setActiveQuote(null);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const saveAsTemplate = async () => {
    setLoading(true);
    try {
      await api.post(`/quotes/${activeQuote.id}/clone`, {
        activityName: plantillaNombre || activeQuote.activityName,
        asTemplate: true,
      });
      toast.success('Plantilla guardada');
      setShowPlantillaModal(false);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const addBillingMonth = () => {
    if (!newMonth || billingMap[newMonth]) return;
    const keys = activeQuote?.mallIds?.length > 0 ? activeQuote.mallIds.map(String) : ['_'];
    setBillingMap(m => ({ ...m, [newMonth]: Object.fromEntries(keys.map(k => [k, 0])) }));
    setNewMonth('');
  };

  const saveBilling = async () => {
    setSavingBilling(true);
    try {
      const flat = Object.entries(billingMap).flatMap(([month, entries]) =>
        Object.entries(entries).map(([mid, amount]) => ({
          month,
          mallId: mid === '_' ? null : Number(mid),
          amount: Number(amount) || 0,
        }))
      );
      await api.put(`/quotes/${activeQuote.id}/billing`, { billingSchedule: flat });
      toast.success('Facturación guardada');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setSavingBilling(false); }
  };

  const fmtMonth = m => {
    const [y, mo] = m.split('-');
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][parseInt(mo) - 1] + ' ' + y;
  };

  const cats = ['Todas', ...new Set(insumos.map(i => i.category).filter(Boolean))];
  const insumosFiltrados = filterCat === 'Todas' ? insumos : insumos.filter(i => i.category === filterCat);
  const selInsumo = insumos.find(i => i.id === Number(addForm.insumoId));

  // ── VISTA: Edición de cotización activa ──
  if (activeQuote) {
    const q = activeQuote;
    const editable = q.status === 'BORRADOR';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{editable ? '🛠️' : '👁️'} {q.activityName} <span className="text-gray-400 text-base font-normal">#{q.id}</span></h1>
            <span className={`badge mt-1 ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span>
          </div>
          <button className="btn-secondary" onClick={() => setActiveQuote(null)}>← Volver</button>
        </div>

        {editable && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">➕ Agregar Insumo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Categoría</label>
                <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Insumo</label>
                <select className="input" value={addForm.insumoId} onChange={e => setAddForm(f => ({ ...f, insumoId: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {insumosFiltrados.map(i => <option key={i.id} value={i.id}>{i.name} (Q{i.costGtq})</option>)}
                </select>
              </div>
            </div>
            {selInsumo?.description && (
              <p className="text-xs bg-blue-50 text-blue-700 rounded p-2">ℹ️ {selInsumo.description}</p>
            )}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Personas</label>
                <input type="number" min="1" className="input" value={addForm.qtyPersonas}
                  onChange={e => setAddForm(f => ({ ...f, qtyPersonas: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {selInsumo?.billingMode === 'MULTIPLICABLE' ? `Cant. (${selInsumo?.unitType})` : `Cobro fijo (${selInsumo?.unitType || '—'})`}
                </label>
                <input type="number" min="1" className="input" value={addForm.unitsValue}
                  disabled={selInsumo?.billingMode !== 'MULTIPLICABLE'}
                  onChange={e => setAddForm(f => ({ ...f, unitsValue: Number(e.target.value) }))} />
              </div>
              <button className="btn-primary" onClick={addLine} disabled={loading}>➕ Agregar</button>
            </div>
          </div>
        )}

        {/* Líneas */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">📋 Elementos de la Cotización</h2>
          </div>
          {q.lines?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-right">Personas</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Costo Q</th>
                  <th className="px-4 py-3 text-right">Costo $</th>
                  {editable && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {q.lines.map((l, i) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{l.insumo?.name}</td>
                    <td className="px-4 py-3 text-right">{l.qtyPersonas}</td>
                    <td className="px-4 py-3 text-right">{l.unitsValue}</td>
                    <td className="px-4 py-3 text-right">{fmtGTQ(l.lineCostGtq)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtUSD(l.lineCostUsd)}</td>
                    {editable && (
                      <td className="px-4 py-3 text-right">
                        <button className="text-red-500 hover:text-red-700 text-xs" onClick={() => removeLine(l.id)}>Borrar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-8 text-center text-gray-400">Sin insumos. Agregá uno arriba.</p>
          )}
        </div>

        {/* Totales */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">💰 Totales y Precios Sugeridos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Costo Total" value={fmtUSD(q.totalCostUsd)} />
            <Metric label="Sugerido (70% margen)" value={fmtUSD(q.suggestedPriceUsdM70)} highlight />
            <Metric label="Sugerido (60% margen)" value={fmtUSD(q.suggestedPriceUsdM60)} />
            <Metric label="Sugerido (50% margen)" value={fmtUSD(q.suggestedPriceUsdM50)} />
          </div>
        </div>

        {/* Facturación Mensual */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">📅 Facturación Mensual</h2>
          <div className="flex gap-3 mb-4">
            <input type="month" className="input flex-1" value={newMonth} onChange={e => setNewMonth(e.target.value)} />
            <button className="btn-secondary" onClick={addBillingMonth} disabled={!newMonth || !!billingMap[newMonth]}>
              + Agregar Mes
            </button>
          </div>
          {Object.keys(billingMap).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin meses de facturación. Agregá uno arriba.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(billingMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, entries]) => {
                const monthTotal = Object.values(entries).reduce((s, v) => s + (Number(v) || 0), 0);
                return (
                  <div key={month} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="font-medium text-sm">{fmtMonth(month)}</span>
                      <button className="text-red-400 hover:text-red-600 text-xs"
                        onClick={() => setBillingMap(m => { const n = { ...m }; delete n[month]; return n; })}>
                        × Eliminar
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(entries).map(([mid, amt]) => (
                          <tr key={mid} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-600">
                              {mid === '_' ? 'General' : (malls.find(m => m.id === Number(mid))?.name || `Mall #${mid}`)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-400 text-xs">$</span>
                                <input type="number" min="0" step="0.01" className="input py-1 text-right w-32"
                                  value={amt}
                                  onChange={e => setBillingMap(m => ({ ...m, [month]: { ...m[month], [mid]: e.target.value } }))} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {Object.keys(entries).length > 1 && (
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-700">Total mes</td>
                            <td className="px-4 py-2 text-right font-semibold pr-4">{fmtUSD(monthTotal)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(billingMap).length > 0 && (
            <div className="flex justify-end mt-4">
              <button className="btn-primary" onClick={saveBilling} disabled={savingBilling}>
                {savingBilling ? 'Guardando...' : '💾 Guardar Facturación'}
              </button>
            </div>
          )}
        </div>

        {/* Render / Imagen de visualización */}
        <RenderUploader quote={q} onUpdated={updated => setActiveQuote(prev => ({ ...prev, renderImagePath: updated }))} />

        {/* Acciones */}
        {editable && (
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setShowPlantillaModal(true)}>💾 Guardar como Plantilla</button>
            <button className="btn-primary" onClick={submitQuote} disabled={loading || !q.lines?.length}>
              📤 Enviar a Aprobación
            </button>
          </div>
        )}

        {/* Modal: Guardar plantilla */}
        <Modal open={showPlantillaModal} onClose={() => setShowPlantillaModal(false)} title="Guardar como Plantilla">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de la plantilla</label>
              <input className="input" value={plantillaNombre || q.activityName}
                onChange={e => setPlantillaNombre(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowPlantillaModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveAsTemplate} disabled={loading}>Guardar Plantilla</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── VISTA: Lista de borradores + crear ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Generador de Cotizaciones</h1>
        <button className="btn-primary" onClick={() => setShowNewModal(true)}>+ Nueva Cotización</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['list', '📋 Mis Borradores'], ['template', '📂 Desde Plantilla']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          {quotes.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p>No tenés borradores. Creá una cotización nueva.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {quotes.map(q => (
                <div key={q.id} className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setActiveQuote(q)}>
                  <div>
                    <p className="font-medium">{q.activityName}</p>
                    <p className="text-xs text-gray-400">{q.activityType?.name} · {q.mallIds?.length > 0 ? q.mallIds.map(id => malls.find(m => m.id === id)?.name).filter(Boolean).join(', ') : (q.mall?.name || 'Sin mall')} · {new Date(q.createdAt).toLocaleDateString('es-GT')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brand-600">{fmtUSD(q.totalCostUsd)}</p>
                    <span className={`badge ${STATUS_COLORS[q.status]}`}>{STATUS_LABELS[q.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'template' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Cargar desde Plantilla</h2>
          {templates.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay plantillas guardadas. Creá una desde una cotización existente.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Elegir Plantilla</label>
                  <select className="input" value={selTemplate} onChange={e => {
                    setSelTemplate(e.target.value);
                    const tpl = templates.find(t => t.id === Number(e.target.value));
                    setNewNameTpl(tpl ? `Copia de ${tpl.activityName}` : '');
                  }}>
                    <option value="">Seleccionar...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.activityName} — {fmtUSD(t.totalCostUsd)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre para la nueva cotización</label>
                  <input className="input" value={newNameTpl} onChange={e => setNewNameTpl(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" onClick={loadFromTemplate} disabled={!selTemplate || loading}>
                ⚡ Crear desde esta Plantilla
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal: Nueva cotización */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nueva Cotización">
        <form onSubmit={createQuote} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de la Actividad *</label>
              <input className="input" required value={form.activityName}
                onChange={e => setForm(f => ({ ...f, activityName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo de Actividad</label>
              <select className="input" value={form.activityTypeId} onChange={e => setForm(f => ({ ...f, activityTypeId: e.target.value }))}>
                <option value="">Sin tipo</option>
                {activityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Malls (Opcional)</label>
              <div className="border border-gray-300 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1 bg-white">
                {malls.length === 0 && <p className="text-xs text-gray-400 p-1">Sin malls registrados</p>}
                {malls.map(m => {
                  const checked = form.mallIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                      <input type="checkbox" className="accent-brand-600" checked={checked}
                        onChange={() => setForm(f => ({
                          ...f,
                          mallIds: checked ? f.mallIds.filter(id => id !== m.id) : [...f.mallIds, m.id],
                        }))} />
                      {m.name}
                    </label>
                  );
                })}
              </div>
              {form.mallIds.length > 0 && (
                <p className="text-xs text-brand-600 mt-1">{form.mallIds.length} mall{form.mallIds.length > 1 ? 's' : ''} seleccionado{form.mallIds.length > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notas</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>🚀 Crear Borrador</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-brand-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function RenderUploader({ quote, onUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const imgUrl = quote.renderImagePath ? `/renders/${quote.renderImagePath}` : null;

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/quotes/${quote.id}/render`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated(data.renderImagePath);
      toast.success('Render subido');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar imagen de render?')) return;
    setDeleting(true);
    try {
      await api.delete(`/quotes/${quote.id}/render`);
      onUpdated(null);
      toast.success('Render eliminado');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setDeleting(false); }
  };

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-800 mb-3">🖼️ Imagen de Render (Opcional)</h2>
      {imgUrl ? (
        <div className="space-y-3">
          <img src={imgUrl} alt="Render" className="max-h-72 rounded-lg border border-gray-200 object-contain w-full bg-gray-50" />
          <div className="flex gap-3">
            <label className="btn-secondary cursor-pointer">
              {uploading ? 'Subiendo...' : '🔄 Cambiar imagen'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : '🗑️ Eliminar'}
            </button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <span className="text-3xl mb-2">📷</span>
          <span className="text-sm text-gray-600 font-medium">{uploading ? 'Subiendo...' : 'Hacer clic para subir imagen del render'}</span>
          <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP hasta 10MB</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}
    </div>
  );
}
