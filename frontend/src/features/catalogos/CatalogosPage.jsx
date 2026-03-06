import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { CATEGORIAS, ROLES, getApiError } from '../../lib/utils';
import Modal from '../../components/Modal';

export default function CatalogosPage() {
  const [tab, setTab] = useState('insumos');
  const TABS = [
    { key: 'insumos',    label: 'Insumos' },
    { key: 'malls',      label: 'Malls & OIs' },
    { key: 'tipos',      label: 'Tipos Actividad' },
    { key: 'usuarios',   label: 'Usuarios' },
    { key: 'proveedores',label: 'Proveedores' },
    { key: 'cambio',     label: 'Tipo de Cambio' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Administración de Catálogos</h1>
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'insumos'    && <TabInsumos />}
      {tab === 'malls'      && <TabMalls />}
      {tab === 'tipos'      && <TabTipos />}
      {tab === 'usuarios'   && <TabUsuarios />}
      {tab === 'proveedores'&& <TabProveedores />}
      {tab === 'cambio'     && <TabCambio />}
    </div>
  );
}

/* ── INSUMOS ── */
function TabInsumos() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: CATEGORIAS[0], costGtq: 0, billingMode: 'MULTIPLICABLE', unitType: 'UNIDAD', description: '' });
  const fileRef = useRef();

  const load = async () => setItems((await api.get('/catalogs/insumos')).data);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', category: CATEGORIAS[0], costGtq: 0, billingMode: 'MULTIPLICABLE', unitType: 'UNIDAD', description: '' }); setShowModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ name: item.name, category: item.category, costGtq: item.costGtq, billingMode: item.billingMode, unitType: item.unitType, description: item.description || '' }); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/catalogs/insumos/${editing.id}`, form);
      else await api.post('/catalogs/insumos', form);
      toast.success(editing ? 'Actualizado' : 'Creado');
      setShowModal(false);
      load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este insumo?')) return;
    try { await api.delete(`/catalogs/insumos/${id}`); toast.success('Eliminado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const bulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/catalogs/insumos/bulk', fd);
      toast.success(`${data.created} creados, ${data.skipped} omitidos`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button className="btn-primary" onClick={openNew}>+ Nuevo Insumo</button>
        <label className="btn-secondary cursor-pointer">
          📤 Carga CSV/Excel
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={bulkUpload} />
        </label>
      </div>
      <CatalogTable
        headers={['Nombre', 'Categoría', 'Costo Q', 'Modo', 'Unidad', 'Activo']}
        rows={items.map(i => [i.name, i.category, `Q${i.costGtq}`, i.billingMode, i.unitType, i.isActive ? '✅' : '❌'])}
        onEdit={(_, idx) => openEdit(items[idx])}
        onDelete={(_, idx) => remove(items[idx].id)}
      />
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Insumo' : 'Nuevo Insumo'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nombre *" required><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoría">
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Costo GTQ"><input type="number" min="0" step="0.01" className="input" value={form.costGtq} onChange={e => setForm(f => ({ ...f, costGtq: Number(e.target.value) }))} /></Field>
            <Field label="Modo de Cobro">
              <select className="input" value={form.billingMode} onChange={e => setForm(f => ({ ...f, billingMode: e.target.value }))}>
                <option value="MULTIPLICABLE">MULTIPLICABLE</option>
                <option value="FIJO">FIJO</option>
              </select>
            </Field>
            <Field label="Unidad">
              <select className="input" value={form.unitType} onChange={e => setForm(f => ({ ...f, unitType: e.target.value }))}>
                {['HORA','DIA','UNIDAD','GLOBAL'].map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descripción (opcional)"><textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <ModalFooter onClose={() => setShowModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

/* ── MALLS & OIs ── */
function TabMalls() {
  const [malls, setMalls] = useState([]);
  const [ois, setOis] = useState([]);
  const [mallForm, setMallForm] = useState({ name: '' });
  const [editMall, setEditMall] = useState(null);
  const [showMallModal, setShowMallModal] = useState(false);
  const [oiForm, setOiForm] = useState({ mallId: '', oiCode: '', oiName: '', annualBudgetUsd: 0 });
  const [editOi, setEditOi] = useState(null);
  const [showOiModal, setShowOiModal] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    const [m, o] = await Promise.all([api.get('/catalogs/malls'), api.get('/catalogs/ois')]);
    setMalls(m.data);
    setOis(o.data);
    if (m.data.length) setOiForm(f => ({ ...f, mallId: m.data[0].id }));
  };
  useEffect(() => { load(); }, []);

  const createMall = async e => {
    e.preventDefault();
    try { await api.post('/catalogs/malls', mallForm); toast.success('Mall creado'); setMallForm({ name: '' }); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const openEditMall = mall => { setEditMall(mall); setShowMallModal(true); };

  const saveMall = async e => {
    e.preventDefault();
    try { await api.put(`/catalogs/malls/${editMall.id}`, { name: editMall.name }); toast.success('Mall actualizado'); setShowMallModal(false); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const deleteMall = async id => {
    if (!confirm('¿Eliminar este mall? Se eliminarán también sus OIs asociadas.')) return;
    try { await api.delete(`/catalogs/malls/${id}`); toast.success('Mall eliminado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const openNewOi = () => { setEditOi(null); setOiForm({ mallId: malls[0]?.id || '', oiCode: '', oiName: '', annualBudgetUsd: 0 }); setShowOiModal(true); };
  const openEditOi = oi => { setEditOi(oi); setOiForm({ mallId: oi.mallId, oiCode: oi.oiCode, oiName: oi.oiName, annualBudgetUsd: oi.annualBudgetUsd }); setShowOiModal(true); };

  const saveOi = async e => {
    e.preventDefault();
    try {
      if (editOi) await api.put(`/catalogs/ois/${editOi.id}`, oiForm);
      else await api.post('/catalogs/ois', oiForm);
      toast.success(editOi ? 'OI actualizada' : 'OI creada');
      setShowOiModal(false); load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const deleteOi = async id => {
    if (!confirm('¿Eliminar esta OI?')) return;
    try { await api.delete(`/catalogs/ois/${id}`); toast.success('Eliminada'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const bulkOis = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/catalogs/ois/bulk', fd);
      toast.success(`${data.created} creadas, ${data.updated} actualizadas`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-8">
      {/* Malls */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Malls</h2>
        <form onSubmit={createMall} className="flex gap-2 max-w-sm">
          <input className="input flex-1" placeholder="Nombre del Mall" value={mallForm.name} onChange={e => setMallForm({ name: e.target.value })} required />
          <button type="submit" className="btn-primary">+ Crear</button>
        </form>
        <CatalogTable
          headers={['Nombre']}
          rows={malls.map(m => [m.name])}
          onEdit={(_, idx) => openEditMall(malls[idx])}
          onDelete={(_, idx) => deleteMall(malls[idx].id)}
        />
      </div>

      {/* OIs */}
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Órdenes Internas (OIs)</h2>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={openNewOi}>+ Nueva OI</button>
          <label className="btn-secondary cursor-pointer">
            📤 Carga Excel/CSV
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={bulkOis} />
          </label>
        </div>
        <CatalogTable
          headers={['Mall', 'Código', 'Nombre', 'Presupuesto']}
          rows={ois.map(o => [o.mall?.name || '—', o.oiCode, o.oiName, `$${o.annualBudgetUsd}`])}
          onEdit={(_, idx) => openEditOi(ois[idx])}
          onDelete={(_, idx) => deleteOi(ois[idx].id)}
        />
      </div>

      {/* Modales */}
      <Modal open={showMallModal} onClose={() => setShowMallModal(false)} title="Editar Mall">
        <form onSubmit={saveMall} className="space-y-4">
          <Field label="Nombre *">
            <input className="input" required value={editMall?.name || ''} onChange={e => setEditMall(m => ({ ...m, name: e.target.value }))} />
          </Field>
          <ModalFooter onClose={() => setShowMallModal(false)} />
        </form>
      </Modal>

      <Modal open={showOiModal} onClose={() => setShowOiModal(false)} title={editOi ? 'Editar OI' : 'Nueva OI'}>
        <form onSubmit={saveOi} className="space-y-4">
          <Field label="Mall">
            <select className="input" value={oiForm.mallId} onChange={e => setOiForm(f => ({ ...f, mallId: Number(e.target.value) }))}>
              {malls.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Código OI *"><input className="input" required value={oiForm.oiCode} onChange={e => setOiForm(f => ({ ...f, oiCode: e.target.value }))} /></Field>
          <Field label="Nombre OI *"><input className="input" required value={oiForm.oiName} onChange={e => setOiForm(f => ({ ...f, oiName: e.target.value }))} /></Field>
          <Field label="Presupuesto Anual (USD)"><input type="number" min="0" step="0.01" className="input" value={oiForm.annualBudgetUsd} onChange={e => setOiForm(f => ({ ...f, annualBudgetUsd: Number(e.target.value) }))} /></Field>
          <ModalFooter onClose={() => setShowOiModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

/* ── TIPOS ACTIVIDAD ── */
function TabTipos() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const fileRef = useRef();

  const load = async () => setItems((await api.get('/catalogs/activity-types')).data);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = item => { setEditing(item); setForm({ name: item.name, description: item.description || '' }); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/catalogs/activity-types/${editing.id}`, form);
      else await api.post('/catalogs/activity-types', form);
      toast.success(editing ? 'Actualizado' : 'Creado');
      setShowModal(false); load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const remove = async id => {
    if (!confirm('¿Eliminar?')) return;
    try { await api.delete(`/catalogs/activity-types/${id}`); toast.success('Eliminado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const bulkUpload = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/catalogs/activity-types/bulk', fd);
      toast.success(`${data.created} creados, ${data.skipped} omitidos`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button className="btn-primary" onClick={openNew}>+ Nuevo Tipo</button>
        <label className="btn-secondary cursor-pointer">
          📤 Carga CSV/Excel
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={bulkUpload} />
        </label>
      </div>
      <CatalogTable
        headers={['Nombre', 'Descripción']}
        rows={items.map(i => [i.name, i.description || '—'])}
        onEdit={(_, idx) => openEdit(items[idx])}
        onDelete={(_, idx) => remove(items[idx].id)}
      />
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Tipo' : 'Nuevo Tipo'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nombre *"><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Descripción"><textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
          <ModalFooter onClose={() => setShowModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

/* ── USUARIOS ── */
function TabUsuarios() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', role: 'VENDEDOR', password: '' });

  const load = async () => setItems((await api.get('/catalogs/users')).data);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ username: '', role: 'VENDEDOR', password: '' }); setShowModal(true); };
  const openEdit = item => { setEditing(item); setForm({ username: item.username, role: item.role, password: '' }); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/catalogs/users/${editing.id}`, form);
      else await api.post('/catalogs/users', form);
      toast.success(editing ? 'Usuario actualizado' : 'Usuario creado');
      setShowModal(false); load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const remove = async id => {
    if (!confirm('¿Eliminar usuario?')) return;
    try { await api.delete(`/catalogs/users/${id}`); toast.success('Eliminado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Dejá la contraseña vacía al editar para no modificarla.</p>
      <button className="btn-primary" onClick={openNew}>+ Nuevo Usuario</button>
      <CatalogTable
        headers={['Usuario', 'Rol', 'Activo', 'Creado']}
        rows={items.map(i => [i.username, i.role, i.isActive ? '✅' : '❌', new Date(i.createdAt).toLocaleDateString('es-GT')])}
        onEdit={(_, idx) => openEdit(items[idx])}
        onDelete={(_, idx) => remove(items[idx].id)}
      />
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Usuario *"><input className="input" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></Field>
          <Field label="Rol">
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={editing ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}>
            <input type="password" className="input" required={!editing} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          <ModalFooter onClose={() => setShowModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

/* ── PROVEEDORES ── */
function TabProveedores() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', legalName: '', providerType: 'Certificado', nit: '', cui: '', bankName: '', accountNumber: '' });
  const fileRef = useRef();

  const load = async () => setItems((await api.get('/catalogs/proveedores')).data);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', legalName: '', providerType: 'Certificado', nit: '', cui: '', bankName: '', accountNumber: '' }); setShowModal(true); };
  const openEdit = item => { setEditing(item); setForm({ name: item.name, legalName: item.legalName || '', providerType: item.providerType || 'Certificado', nit: item.nit || '', cui: item.cui || '', bankName: item.bankName || '', accountNumber: item.accountNumber || '' }); setShowModal(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/catalogs/proveedores/${editing.id}`, form);
      else await api.post('/catalogs/proveedores', form);
      toast.success(editing ? 'Actualizado' : 'Creado');
      setShowModal(false); load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const remove = async id => {
    if (!confirm('¿Eliminar proveedor?')) return;
    try { await api.delete(`/catalogs/proveedores/${id}`); toast.success('Eliminado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  const bulkUpload = async e => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post('/catalogs/proveedores/bulk', fd);
      toast.success(`${data.created} creados, ${data.skipped} omitidos`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button className="btn-primary" onClick={openNew}>+ Nuevo Proveedor</button>
        <label className="btn-secondary cursor-pointer">
          📤 Carga Excel/CSV
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={bulkUpload} />
        </label>
      </div>
      <CatalogTable
        headers={['Nombre', 'Razón Social', 'Tipo', 'NIT', 'CUI', 'Banco']}
        rows={items.map(i => [i.name, i.legalName || '—', i.providerType, i.nit || '—', i.cui || '—', i.bankName || '—'])}
        onEdit={(_, idx) => openEdit(items[idx])}
        onDelete={(_, idx) => remove(items[idx].id)}
      />
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="lg">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre Comercial *"><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Razón Social"><input className="input" value={form.legalName} onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))} /></Field>
            <Field label="Tipo">
              <select className="input" value={form.providerType} onChange={e => setForm(f => ({ ...f, providerType: e.target.value }))}>
                <option>Certificado</option><option>Directo</option>
              </select>
            </Field>
            <Field label="NIT"><input className="input" value={form.nit} onChange={e => setForm(f => ({ ...f, nit: e.target.value }))} /></Field>
            <Field label="CUI (DPI)"><input className="input" value={form.cui} onChange={e => setForm(f => ({ ...f, cui: e.target.value }))} /></Field>
            <Field label="Banco"><input className="input" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></Field>
            <Field label="No. de Cuenta" className="col-span-2"><input className="input" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} /></Field>
          </div>
          <ModalFooter onClose={() => setShowModal(false)} />
        </form>
      </Modal>
    </div>
  );
}

/* ── TIPO DE CAMBIO ── */
function TabCambio() {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ gtqPerUsd: 7.8, effectiveDate: new Date().toISOString().split('T')[0] });

  const load = async () => setRates((await api.get('/catalogs/exchange-rates')).data);
  useEffect(() => { load(); }, []);

  const createRate = async e => {
    e.preventDefault();
    try {
      await api.post('/catalogs/exchange-rates', form);
      toast.success(`Tipo de cambio Q${form.gtqPerUsd}/USD activado`);
      load();
    } catch (err) { toast.error(getApiError(err)); }
  };

  const activate = async id => {
    try { await api.put(`/catalogs/exchange-rates/${id}/activate`); toast.success('Tipo de cambio activado'); load(); }
    catch (err) { toast.error(getApiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Agregar Nuevo Tipo de Cambio</h2>
        <form onSubmit={createRate} className="flex gap-4 items-end">
          <Field label="Quetzales por 1 USD">
            <input type="number" min="0" step="0.01" className="input w-36" value={form.gtqPerUsd} onChange={e => setForm(f => ({ ...f, gtqPerUsd: Number(e.target.value) }))} required />
          </Field>
          <Field label="Fecha efectiva">
            <input type="date" className="input" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
          </Field>
          <button type="submit" className="btn-primary">Guardar y Activar</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">GTQ / USD</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rates.map(r => (
              <tr key={r.id} className={r.isActive ? 'bg-green-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 font-semibold">Q{r.gtqPerUsd}</td>
                <td className="px-4 py-3 text-gray-500">{r.effectiveDate}</td>
                <td className="px-4 py-3 text-center">
                  {r.isActive ? <span className="badge bg-green-100 text-green-700">Activo</span> : <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.isActive && <button className="text-xs text-brand-600 hover:underline" onClick={() => activate(r.id)}>Activar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── COMPONENTES COMPARTIDOS ── */
function CatalogTable({ headers, rows, onEdit, onDelete }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={headers.length + 1} className="px-4 py-8 text-center text-gray-400">Sin registros</td></tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {row.map((cell, ci) => <td key={ci} className="px-4 py-2.5 max-w-xs truncate">{cell}</td>)}
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button className="text-brand-600 text-xs hover:underline mr-3" onClick={() => onEdit(row, idx)}>Editar</button>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => onDelete(row, idx)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ModalFooter({ onClose }) {
  return (
    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
      <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="submit" className="btn-primary">Guardar</button>
    </div>
  );
}
