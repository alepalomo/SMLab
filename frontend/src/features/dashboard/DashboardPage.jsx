import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { fmtUSD, fmtPct } from '../../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [malls, setMalls] = useState([]);
  const [types, setTypes] = useState([]);
  const [selMalls, setSelMalls] = useState([]);
  const [selTypes, setSelTypes] = useState([]);

  const [financials, setFinancials] = useState(null);
  const [oiData, setOiData] = useState([]);
  const [billingData, setBillingData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar opciones de filtro
  useEffect(() => {
    api.get('/dashboard/filters').then(({ data }) => {
      setMalls(data.malls);
      setTypes(data.types);
    });
  }, []);

  // Cargar datos del dashboard
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ year });
        if (selMalls.length) params.set('mallIds', selMalls.join(','));
        if (selTypes.length) params.set('typeIds', selTypes.join(','));

        const [fin, oi, billing] = await Promise.all([
          api.get(`/dashboard/financials?${params}`),
          api.get(`/dashboard/oi-execution?${params}`),
          api.get(`/dashboard/billing?${params}`),
        ]);
        setFinancials(fin.data);
        setOiData(oi.data);
        setBillingData(billing.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year, selMalls, selTypes]);

  const toggleFilter = (arr, setArr, id) => {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalBudget = oiData.reduce((s, o) => s + o.budgetUsd, 0);
  const totalReal = oiData.reduce((s, o) => s + o.realUsd, 0);
  const pctTotal = totalBudget > 0 ? (totalReal / totalBudget) * 100 : 0;

  const chartData = oiData.map(o => ({
    name: `${o.oiCode} (${o.mall})`,
    Presupuesto: Number(o.budgetUsd.toFixed(2)),
    Ejecutado: Number(o.realUsd.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Financiero</h1>

      {/* Filtros */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Filtros de Visualización</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Año Fiscal</label>
            <input type="number" className="input" value={year} onChange={e => setYear(Number(e.target.value))} step="1" />
          </div>
          <div>
            <label className="label">Malls</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {malls.map(m => (
                <button key={m.id} onClick={() => toggleFilter(selMalls, setSelMalls, m.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selMalls.includes(m.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'}`}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Tipos de Actividad</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {types.map(t => (
                <button key={t.id} onClick={() => toggleFilter(selTypes, setSelTypes, t.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selTypes.includes(t.id) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        {(selMalls.length > 0 || selTypes.length > 0) && (
          <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setSelMalls([]); setSelTypes([]); }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {loading && <p className="text-center text-gray-400 py-4">Cargando datos...</p>}

      {/* Sección 1: Rentabilidad Real */}
      {financials && (
        <>
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">💰 Rentabilidad Real (Ventas vs. Gastos Reales)</h2>
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Venta Total" value={fmtUSD(financials.totalVentaUsd)} sub="Precios de venta acordados" />
              <KpiCard label="Utilidad Real" value={fmtUSD(financials.utilidadRealUsd)}
                sub="Ganancia líquida"
                highlight={financials.utilidadRealUsd > 0 ? 'green' : 'red'} />
              <KpiCard label="Margen Real %" value={fmtPct(financials.margenRealPct)}
                sub="Sobre venta"
                highlight={financials.margenRealPct >= 30 ? 'green' : 'red'} />
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">📉 Control Presupuestario (Plan vs. Realidad)</h2>
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Presupuesto Costos" value={fmtUSD(financials.totalCostoPresupuestoUsd)} sub="Costo teórico cotizado" />
              <KpiCard label="Gasto Ejecutado" value={fmtUSD(financials.totalGastoRealUsd)} sub="Facturas y caja chica reales" />
              <KpiCard label="Ahorro / Desvío" value={fmtUSD(financials.variacionPresupuesto)}
                sub={financials.variacionPresupuesto >= 0 ? 'Ahorro' : 'Sobre costo'}
                highlight={financials.variacionPresupuesto >= 0 ? 'green' : 'red'} />
            </div>
          </div>
        </>
      )}

      {/* Sección 2: Ejecución OIs */}
      {oiData.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">📊 Ejecución de Cuentas (OIs)</h2>

          {/* KPIs globales */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Presupuesto Anual" value={fmtUSD(totalBudget)} />
            <KpiCard label="Gasto Real" value={fmtUSD(totalReal)} />
            <KpiCard label="% Ejecución" value={fmtPct(pctTotal)} highlight={pctTotal > 100 ? 'red' : 'green'} />
            <KpiCard label="Disponible" value={fmtUSD(totalBudget - totalReal)} />
          </div>

          {/* Barra de progreso global */}
          <div className="card px-5 py-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Ejecución global</span>
              <span>{fmtPct(pctTotal)}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctTotal > 100 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(pctTotal, 100)}%` }}
              />
            </div>
          </div>

          {/* Gráfica */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-700 mb-4">Comparativa por Cuenta (OI)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtUSD(v)} />
                <Legend />
                <Bar dataKey="Presupuesto" fill="#e0e0e0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ejecutado" fill="#ff4b4b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla detalle */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-gray-700">Detalle por OI</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Mall</th>
                    <th className="px-4 py-3 text-left">OI</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-right">Presupuesto</th>
                    <th className="px-4 py-3 text-right">Real</th>
                    <th className="px-4 py-3 text-right">% Ejec.</th>
                    <th className="px-4 py-3 text-right">Disponible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {oiData.map(o => (
                    <tr key={o.oiCode} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500">{o.mall}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{o.oiCode}</td>
                      <td className="px-4 py-2.5">{o.oiName}</td>
                      <td className="px-4 py-2.5 text-right">{fmtUSD(o.budgetUsd)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtUSD(o.realUsd)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-medium ${o.pctEjecucion > 100 ? 'text-red-600' : 'text-gray-700'}`}>
                          {fmtPct(o.pctEjecucion)}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${o.disponibleUsd < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmtUSD(o.disponibleUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && oiData.length === 0 && billingData.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">📊</p>
          <p>No hay datos para mostrar con los filtros actuales.</p>
        </div>
      )}

      {/* Sección 3: Facturación por Mes */}
      {billingData.length > 0 && (() => {
        const totalFact = billingData.reduce((s, m) => s + m.total, 0);
        const avgFact = totalFact / billingData.length;
        const chartFact = billingData.map(m => {
          const [y, mo] = m.month.split('-');
          const label = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(mo)-1] + ' ' + y.slice(2);
          return { name: label, Total: Number(m.total.toFixed(2)) };
        });
        return (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">📅 Facturación por Mes</h2>
            <div className="grid grid-cols-3 gap-4">
              <KpiCard label="Total Facturado" value={fmtUSD(totalFact)} sub={`${billingData.length} mes${billingData.length > 1 ? 'es' : ''} del año`} />
              <KpiCard label="Promedio Mensual" value={fmtUSD(avgFact)} sub="Por mes con facturación" />
              <KpiCard label="Mes Pico" value={fmtUSD(Math.max(...billingData.map(m => m.total)))} sub={billingData.find(m => m.total === Math.max(...billingData.map(x => x.total)))?.month || ''} />
            </div>
            <div className="card p-5">
              <h3 className="font-medium text-gray-700 mb-4">Facturación Mensual ($)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartFact} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmtUSD(v)} />
                  <Bar dataKey="Total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-gray-700">Detalle por Mes</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Mes</th>
                    <th className="px-4 py-3 text-left">Desglose por Mall</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {billingData.map(m => (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">{m.month}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {m.byMall.map(b => `${b.name}: ${fmtUSD(b.amount)}`).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmtUSD(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight }) {
  const colors = { green: 'text-green-600', red: 'text-red-600' };
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? colors[highlight] : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
