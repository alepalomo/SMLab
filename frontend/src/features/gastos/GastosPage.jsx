import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtGTQ, getApiError } from '../../lib/utils';
import useAuthStore from '../auth/authStore';

const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

export default function GastosPage() {
  const user = useAuthStore(s => s.user);
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'AUTORIZADO';

  const [tab, setTab] = useState('odc');
  const [activeQuotes, setActiveQuotes] = useState([]);
  const [ois, setOis] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);

  // Historial
  const [historial, setHistorial] = useState([]);
  const [histFilter, setHistFilter] = useState({ category: '', from: firstOfMonth(), to: today() });
  const [editingExpense, setEditingExpense] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Descarga reportes
  const [rango, setRango] = useState({ from: firstOfMonth(), to: today() });
  const [ccReportOiId, setCcReportOiId] = useState('');

  // Forms
  const [odcForm, setOdcForm] = useState({ odcNumber: '', date: today(), oiId: '', companyId: '', amountGtq: '', description: '', quoteId: '' });
  const [ccForm, setCcForm] = useState({ date: today(), oiId: '', companyId: '', amountGtq: '', docNumber: '', textAdditional: '', payTo: '', quoteId: '' });
  const [ccReceiptFile, setCcReceiptFile] = useState(null);
  const ccReceiptRef = { current: null };

  // HOST
  const [hostProv, setHostProv] = useState('');
  const [hostDate, setHostDate] = useState(today());
  const [hostQuote, setHostQuote] = useState('');
  const [hostDesc, setHostDesc] = useState('');
  const [hostRows, setHostRows] = useState([{ desc: '', rate: 0, days: 1 }]);

  useEffect(() => {
    const load = async () => {
      const [q, o, p] = await Promise.all([
        api.get('/quotes?status=APROBADA'),
        api.get('/catalogs/ois?active=true'),
        api.get('/catalogs/proveedores?active=true'),
      ]);
      setActiveQuotes(q.data);
      setOis(o.data);
      setProveedores(p.data);
      if (q.data.length) {
        setOdcForm(f => ({ ...f, quoteId: q.data[0].id }));
        setCcForm(f => ({ ...f, quoteId: q.data[0].id }));
        setHostQuote(String(q.data[0].id));
      }
      if (o.data.length) {
        setOdcForm(f => ({ ...f, oiId: o.data[0].id }));
        setCcForm(f => ({ ...f, oiId: o.data[0].id }));
      }
      if (p.data.length) {
        setOdcForm(f => ({ ...f, companyId: p.data[0].id }));
        setCcForm(f => ({ ...f, companyId: p.data[0].id }));
        setHostProv(String(p.data[0].id));
      }
    };
    load();
  }, []);

  // Si no hay actividades activas, mostrar aviso pero igual permitir ver el historial
  const noActiveQuotes = activeQuotes.length === 0;

  const submitOdc = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/expenses/odc', { ...odcForm, amountGtq: Number(odcForm.amountGtq) });
      toast.success('ODC guardada');
      setOdcForm(f => ({ ...f, odcNumber: '', amountGtq: '', description: '' }));
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const submitCc = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: expense } = await api.post('/expenses/caja-chica', { ...ccForm, amountGtq: Number(ccForm.amountGtq) });
      if (ccReceiptFile) {
        const fd = new FormData();
        fd.append('image', ccReceiptFile);
        await api.post(`/expenses/${expense.id}/receipt`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success('Caja Chica guardada');
      setCcForm(f => ({ ...f, amountGtq: '', docNumber: '', textAdditional: '', payTo: '' }));
      setCcReceiptFile(null);
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const submitHost = async () => {
    const totalHost = hostRows.reduce((s, r) => s + (Number(r.rate) * Number(r.days)), 0);
    if (!hostProv) return toast.error('Seleccioná un talento');
    if (!hostDesc) return toast.error('Descripción legal requerida');
    if (totalHost <= 0) return toast.error('Monto total es 0');
    setLoading(true);
    try {
      const res = await api.post('/expenses/host', {
        date: hostDate,
        quoteId: Number(hostQuote),
        companyId: Number(hostProv),
        contractDesc: hostDesc,
        rows: hostRows.map(r => ({ ...r, rate: Number(r.rate), days: Number(r.days) })),
      }, { responseType: 'blob' });

      // Descargar el ZIP automáticamente
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      const prov = proveedores.find(p => p.id === Number(hostProv));
      link.download = `Pack_Legal_${prov?.name || 'host'}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Gasto registrado. Documentos descargados.');
      setHostRows([{ desc: '', rate: 0, days: 1 }]);
      setHostDesc('');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const loadHistorial = async () => {
    try {
      const params = new URLSearchParams();
      if (histFilter.category) params.set('category', histFilter.category);
      if (histFilter.from) params.set('from', histFilter.from);
      if (histFilter.to) params.set('to', histFilter.to);
      const { data } = await api.get(`/expenses?${params}`);
      setHistorial(data);
    } catch (err) { toast.error(getApiError(err)); }
  };

  const startEdit = (exp) => {
    setEditingExpense(exp);
    setEditForm({
      date: exp.date,
      amountGtq: exp.amountGtq,
      description: exp.description || '',
      odcNumber: exp.odcNumber || '',
      docNumber: exp.docNumber || '',
      textAdditional: exp.textAdditional || '',
      payTo: exp.payTo || '',
    });
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      await api.put(`/expenses/${editingExpense.id}`, { ...editForm, amountGtq: Number(editForm.amountGtq) });
      toast.success('Gasto actualizado');
      setEditingExpense(null);
      loadHistorial();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Gasto eliminado');
      loadHistorial();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  };

  const downloadReport = async (type, format = 'csv') => {
    try {
      let endpoint, filename;
      if (type === 'odc') {
        endpoint = '/expenses/report/odc';
        filename = 'reporte_odc.csv';
      } else if (format === 'pdf') {
        endpoint = '/expenses/report/caja-chica-pdf';
        filename = `facturas_caja_chica_${rango.from}_${rango.to}.pdf`;
      } else {
        endpoint = '/expenses/report/caja-chica';
        filename = 'caja_chica_contable.csv';
      }
      const params = new URLSearchParams({ from: rango.from, to: rango.to });
      if (format === 'pdf' && ccReportOiId) params.set('oiId', ccReportOiId);
      const res = await api.get(`${endpoint}?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(getApiError(err)); }
  };

  const TABS = [
    { key: 'odc',      label: '📝 ODC' },
    { key: 'caja',     label: '📦 Caja Chica' },
    { key: 'host',     label: '🎤 Host / Talento' },
    { key: 'historial', label: '📋 Historial' },
  ];

  const totalHost = hostRows.reduce((s, r) => s + (Number(r.rate) * Number(r.days)), 0);
  const provHost = proveedores.find(p => p.id === Number(hostProv));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Registro de Gastos Reales</h1>

      {noActiveQuotes && tab !== 'historial' && (
        <div className="card p-5 text-amber-700 bg-amber-50 border border-amber-200 flex gap-3 items-start">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium">No hay actividades activas (Aprobadas) para cargar gastos.</p>
            <p className="text-sm text-amber-600 mt-0.5">Pedí al administrador que apruebe una cotización. Podés ver el historial en la última pestaña.</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ODC ── */}
      {tab === 'odc' && !noActiveQuotes && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Registro por Orden de Compra</h2>
            <form onSubmit={submitOdc} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Número de ODC</label>
                  <input className="input" value={odcForm.odcNumber} onChange={e => setOdcForm(f => ({ ...f, odcNumber: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Fecha de Ingreso</label>
                  <input type="date" className="input" value={odcForm.date} onChange={e => setOdcForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">OI que registra el gasto</label>
                  <select className="input" value={odcForm.oiId} onChange={e => setOdcForm(f => ({ ...f, oiId: e.target.value }))} required>
                    {ois.map(o => <option key={o.id} value={o.id}>{o.oiCode} — {o.oiName} ({o.mall?.name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <select className="input" value={odcForm.companyId} onChange={e => setOdcForm(f => ({ ...f, companyId: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Monto (Q)</label>
                  <input type="number" min="0" step="0.01" className="input" value={odcForm.amountGtq} onChange={e => setOdcForm(f => ({ ...f, amountGtq: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Actividad</label>
                  <select className="input" value={odcForm.quoteId} onChange={e => setOdcForm(f => ({ ...f, quoteId: e.target.value }))} required>
                    {activeQuotes.map(q => <option key={q.id} value={q.id}>{q.activityName} ({q.mall?.name || 'Global'})</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="label">Descripción</label>
                  <input className="input" value={odcForm.description} onChange={e => setOdcForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={loading}>💾 Guardar ODC</button>
              </div>
            </form>
          </div>

          {/* Descarga CSV ODC */}
          <ReportDownloader rango={rango} setRango={setRango} onDownload={() => downloadReport('odc')} label="Reporte ODC" />
        </div>
      )}

      {/* ── CAJA CHICA ── */}
      {tab === 'caja' && !noActiveQuotes && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Registro de Caja Chica</h2>
            <form onSubmit={submitCc} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Monto (Q)</label>
                  <input type="number" min="0" step="0.01" className="input" value={ccForm.amountGtq} onChange={e => setCcForm(f => ({ ...f, amountGtq: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={ccForm.date} onChange={e => setCcForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label"># Factura</label>
                  <input className="input" value={ccForm.docNumber} onChange={e => setCcForm(f => ({ ...f, docNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Proveedor</label>
                  <select className="input" value={ccForm.companyId} onChange={e => setCcForm(f => ({ ...f, companyId: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.name} (NIT: {p.nit})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">OI (Cuenta)</label>
                  <select className="input" value={ccForm.oiId} onChange={e => setCcForm(f => ({ ...f, oiId: e.target.value }))} required>
                    {ois.map(o => <option key={o.id} value={o.id}>{o.oiCode} — {o.oiName} ({o.mall?.name})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Actividad</label>
                  <select className="input" value={ccForm.quoteId} onChange={e => setCcForm(f => ({ ...f, quoteId: e.target.value }))} required>
                    {activeQuotes.map(q => <option key={q.id} value={q.id}>{q.activityName} ({q.mall?.name || 'Global'})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pagar a:</label>
                  <input className="input" value={ccForm.payTo} onChange={e => setCcForm(f => ({ ...f, payTo: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Texto Adicional</label>
                  <input className="input" value={ccForm.textAdditional} onChange={e => setCcForm(f => ({ ...f, textAdditional: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="label">📎 Imagen de Factura (opcional)</label>
                  {ccReceiptFile ? (
                    <div className="flex items-center gap-3 mt-1">
                      <img src={URL.createObjectURL(ccReceiptFile)} alt="Factura" className="h-16 w-16 object-cover rounded border border-gray-200" />
                      <span className="text-sm text-gray-600">{ccReceiptFile.name}</span>
                      <button type="button" className="text-red-500 text-xs hover:text-red-700" onClick={() => setCcReceiptFile(null)}>× Quitar</button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors mt-1 w-fit">
                      <span className="text-lg">🧾</span>
                      <span className="text-sm text-gray-500">Adjuntar factura (JPG, PNG, WEBP)</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => setCcReceiptFile(e.target.files?.[0] || null)} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={loading}>💾 Guardar Caja Chica</button>
              </div>
            </form>
          </div>

          <ReportDownloader rango={rango} setRango={setRango} onDownload={() => downloadReport('caja')} onDownloadPdf={() => downloadReport('caja', 'pdf')} label="Reporte Contable Caja Chica" ois={ois} oiId={ccReportOiId} setOiId={setCcReportOiId} />
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="card p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={histFilter.category} onChange={e => setHistFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="">Todos</option>
                <option value="ODC">ODC</option>
                <option value="CAJA_CHICA">Caja Chica</option>
                <option value="HOST">Host</option>
              </select>
            </div>
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input" value={histFilter.from} onChange={e => setHistFilter(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input" value={histFilter.to} onChange={e => setHistFilter(f => ({ ...f, to: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={loadHistorial}>Buscar</button>
          </div>

          {/* Tabla */}
          {historial.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p>Aplicá un filtro y hacé clic en Buscar.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left">Fecha</th>
                    <th className="px-3 py-3 text-left">Tipo</th>
                    <th className="px-3 py-3 text-left">Actividad</th>
                    <th className="px-3 py-3 text-left">Descripción</th>
                    <th className="px-3 py-3 text-right">Monto Q</th>
                    {isPrivileged && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historial.map(exp => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-500">{exp.date}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${exp.category === 'ODC' ? 'bg-blue-100 text-blue-700' : exp.category === 'CAJA_CHICA' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>
                          {exp.category === 'CAJA_CHICA' ? 'Caja Chica' : exp.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{exp.quote?.activityName || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{exp.description || '—'}</td>
                      <td className="px-3 py-3 text-right font-semibold">{fmtGTQ(exp.amountGtq)}</td>
                      {isPrivileged && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button className="btn-secondary text-xs py-1 px-2" onClick={() => startEdit(exp)}>✏️ Editar</button>
                            <button className="btn-danger text-xs py-1 px-2" onClick={() => deleteExpense(exp.id)}>🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de edición */}
          {editingExpense && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800">✏️ Editar Gasto #{editingExpense.id}</h3>
                  <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={() => setEditingExpense(null)}>×</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Fecha</label>
                    <input type="date" className="input" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Monto (Q)</label>
                    <input type="number" min="0" step="0.01" className="input" value={editForm.amountGtq} onChange={e => setEditForm(f => ({ ...f, amountGtq: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <input className="input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  {editingExpense.category === 'ODC' && (
                    <div>
                      <label className="label">Número de ODC</label>
                      <input className="input" value={editForm.odcNumber} onChange={e => setEditForm(f => ({ ...f, odcNumber: e.target.value }))} />
                    </div>
                  )}
                  {editingExpense.category === 'CAJA_CHICA' && (
                    <>
                      <div>
                        <label className="label"># Factura</label>
                        <input className="input" value={editForm.docNumber} onChange={e => setEditForm(f => ({ ...f, docNumber: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Pagar a</label>
                        <input className="input" value={editForm.payTo} onChange={e => setEditForm(f => ({ ...f, payTo: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Texto Adicional</label>
                        <input className="input" value={editForm.textAdditional} onChange={e => setEditForm(f => ({ ...f, textAdditional: e.target.value }))} />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button className="btn-secondary" onClick={() => setEditingExpense(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={saveEdit} disabled={loading}>Guardar Cambios</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HOST ── */}
      {tab === 'host' && !noActiveQuotes && (
        <div className="card p-6 space-y-6">
          <h2 className="font-semibold text-gray-800">Gestión de Talentos (Host)</h2>

          {/* Paso 1: Datos del talento */}
          <section>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">1️⃣ Datos del Servicio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Seleccionar Talento (Proveedor)</label>
                <select className="input" value={hostProv} onChange={e => setHostProv(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {provHost && !provHost.cui && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Este talento no tiene CUI registrado. Ir a Catálogos.</p>
                )}
                {provHost && provHost.cui && (
                  <p className="text-xs text-green-600 mt-1">✅ CUI: {provHost.cui}</p>
                )}
              </div>
              <div>
                <label className="label">Fecha de los Documentos</label>
                <input type="date" className="input" value={hostDate} onChange={e => setHostDate(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Descripción Legal para el Contrato</label>
                <input className="input" placeholder="Ej: promoción de marca, conducción de evento..." value={hostDesc} onChange={e => setHostDesc(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Paso 2: Filas de cobro */}
          <section>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Detalle de Cobros</h3>
            <div className="space-y-2">
              {hostRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_100px_40px] gap-2 items-center">
                  <input className="input" placeholder={`Servicio ${idx + 1}`} value={row.desc}
                    onChange={e => setHostRows(r => r.map((x, i) => i === idx ? { ...x, desc: e.target.value } : x))} />
                  <input type="number" min="0" step="50" className="input" placeholder="Tarifa Q"
                    value={row.rate}
                    onChange={e => setHostRows(r => r.map((x, i) => i === idx ? { ...x, rate: e.target.value } : x))} />
                  <input type="number" min="0" step="1" className="input" placeholder="Días"
                    value={row.days}
                    onChange={e => setHostRows(r => r.map((x, i) => i === idx ? { ...x, days: e.target.value } : x))} />
                  <button className="btn-ghost text-red-400 hover:text-red-600 px-2"
                    disabled={hostRows.length === 1}
                    onClick={() => setHostRows(r => r.filter((_, i) => i !== idx))}>🗑</button>
                </div>
              ))}
            </div>
            <button className="btn-secondary mt-2 text-sm" onClick={() => setHostRows(r => [...r, { desc: '', rate: 0, days: 1 }])}>
              ➕ Agregar fila
            </button>
            <p className="mt-3 text-sm font-semibold text-brand-600">Total a Pagar: {fmtGTQ(totalHost)}</p>
          </section>

          {/* Paso 3: Vincular actividad */}
          <section>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">2️⃣ Registrar en Actividad</h3>
            <select className="input max-w-sm" value={hostQuote} onChange={e => setHostQuote(e.target.value)}>
              {activeQuotes.map(q => <option key={q.id} value={q.id}>{q.activityName} | {q.mall?.name || 'Global'}</option>)}
            </select>
          </section>

          {/* Paso 4: Generar */}
          <section>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">3️⃣ Generar y Descargar</h3>
            <button className="btn-primary w-full py-3 text-base" onClick={submitHost} disabled={loading || !hostProv || !hostDesc || totalHost <= 0}>
              {loading ? 'Generando...' : '💾 Registrar Gasto y Descargar ZIP (Recibo + Contrato)'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function ReportDownloader({ rango, setRango, onDownload, onDownloadPdf, label, ois, oiId, setOiId }) {
  return (
    <div className="card p-5">
      <h3 className="font-medium text-gray-700 mb-3">⬇️ {label}</h3>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Desde</label>
          <input type="date" className="input" value={rango.from} onChange={e => setRango(r => ({ ...r, from: e.target.value }))} />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" className="input" value={rango.to} onChange={e => setRango(r => ({ ...r, to: e.target.value }))} />
        </div>
        {ois && setOiId && (
          <div>
            <label className="label">OI (solo para PDF)</label>
            <select className="input" value={oiId} onChange={e => setOiId(e.target.value)}>
              <option value="">Todas las OIs</option>
              {ois.map(o => <option key={o.id} value={o.id}>{o.oiCode} — {o.oiName}</option>)}
            </select>
          </div>
        )}
        <button className="btn-secondary" onClick={onDownload}>Descargar CSV</button>
        {onDownloadPdf && (
          <button className="btn-secondary" onClick={onDownloadPdf}>📄 Descargar PDF de Facturas</button>
        )}
      </div>
    </div>
  );
}
