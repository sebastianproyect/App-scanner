import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Receipt } from '../lib/types'

const CHART_COLORS = ['#a63500', '#d04400', '#e8845c', '#f5b89a', '#fbdcd3', '#7a2700']

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return

    // Run both queries in parallel
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

    let recentQ = supabase
      .from('receipts')
      .select('id, vendor, amount, date, created_at, status, user_id, categories(id, name, icon)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (!isAdmin) recentQ = recentQ.eq('user_id', user.id)

    let chartQ = supabase
      .from('receipts')
      .select('id, amount, date, created_at, status, categories(name)')
      .gte('date', sixMonthsAgoStr)
    if (!isAdmin) chartQ = chartQ.eq('user_id', user.id)

    Promise.all([recentQ, chartQ]).then(([recent, chart]) => {
      if (recent.data) setReceipts(recent.data as unknown as Receipt[])
      if (chart.data) setAllReceipts(chart.data as unknown as Receipt[])
      setLoading(false)
    })
  }, [user, profile])

  const totalExpenses = allReceipts.reduce((s, r) => s + Number(r.amount), 0)
  const pendingCount  = allReceipts.filter(r => r.status === 'pending').length
  const currentMonth  = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  }
  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // --- Chart data ---
  // Last 6 months bar chart
  const monthlyData = (() => {
    const now = new Date()
    const months: { label: string; key: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('es-ES', { month: 'short' }),
        total: 0,
      })
    }
    allReceipts.forEach(r => {
      const key = r.date?.slice(0, 7)
      const m = months.find(m => m.key === key)
      if (m) m.total += Number(r.amount)
    })
    return months
  })()

  // By category pie chart
  const categoryData = (() => {
    const map: Record<string, number> = {}
    allReceipts.forEach(r => {
      const cat = (r.categories as { name: string } | null)?.name ?? 'Otros'
      map[cat] = (map[cat] ?? 0) + Number(r.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  })()

  const thisMonthCount = allReceipts.filter(r => {
    const d = new Date(r.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-secondary-container text-on-secondary-container',
    synced:  'bg-tertiary/10 text-tertiary',
    flagged: 'bg-error-container text-error',
  }
  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendiente', synced: 'Guardado', flagged: 'Revisión',
  }
  const CATEGORY_ICONS: Record<string, string> = {
    'Oficina': 'business_center', 'Transporte': 'directions_car',
    'Comida': 'restaurant', 'Servicios': 'bolt',
    'Papelería': 'edit_note', 'Otros': 'more_horiz',
  }

  return (
    <div className="bg-background font-body text-on-surface selection:bg-primary-fixed min-h-screen">
      {/* Header */}
      <header className="bg-[#fff8f6] top-0 sticky z-50">
        <div className="flex items-center justify-between px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <img src="/icons/icon.png" alt="IDT" className="h-7 w-auto max-w-[90px] object-contain" style={{ mixBlendMode: 'multiply' }} />
            <h1 className="font-headline font-bold tracking-tight text-[#281812] text-xl">Indet Scanner</h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <Link to="/dashboard" className="text-[#a63500] font-semibold text-sm">Dashboard</Link>
              <Link to="/history" className="text-[#5c4037] hover:bg-[#fbdcd3]/50 transition-colors px-3 py-1 rounded-lg text-sm">
                Historial
              </Link>
              {isAdmin && (
                <Link to="/users" className="text-[#5c4037] hover:bg-[#fbdcd3]/50 transition-colors px-3 py-1 rounded-lg text-sm">
                  Usuarios
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[13px]">person</span>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {profile?.full_name || user?.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-full hover:bg-surface-container-highest transition-colors"
                title="Cerrar sesión"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">logout</span>
              </button>
              <button
                onClick={() => navigate('/scanner')}
                className="bg-gradient-to-br from-primary to-primary-container text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 active:scale-95 duration-200"
              >
                <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                Escanear
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/scanner')}
            className="md:hidden p-2 rounded-full text-primary active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined">document_scanner</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-32">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant mb-4">
              <span className="material-symbols-outlined text-[14px]">update</span>
              <span className="text-[11px] font-bold uppercase tracking-widest font-label">Actualizado ahora</span>
            </div>
            <h2 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight">
              Dashboard
            </h2>
            <p className="text-on-surface-variant text-sm mt-1 capitalize">{currentMonth}</p>
          </div>
          <div className="flex flex-col items-start md:items-end">
            <p className="text-on-surface-variant font-medium text-sm mb-1 uppercase tracking-tighter">
              Total de gastos
            </p>
            {loading ? (
              <div className="h-9 w-36 bg-surface-container-highest rounded-lg animate-pulse" />
            ) : (
              <span className="font-headline font-bold text-3xl text-primary">
                {formatCurrency(totalExpenses)}
              </span>
            )}
          </div>
        </div>

        {/* Stats Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
          <div className="md:col-span-2 p-8 rounded-[1.5rem] bg-surface-container-low flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-surface-container-highest rounded-2xl">
                  <span className="material-symbols-outlined text-primary">payments</span>
                </div>
                <span className="text-on-surface-variant text-sm font-medium">
                  {allReceipts.length} ticket{allReceipts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <p className="text-on-surface-variant text-sm font-medium mb-1">Total Gastos</p>
                {loading ? (
                  <div className="h-10 w-40 bg-surface-container-highest rounded-lg animate-pulse" />
                ) : (
                  <h3 className="font-headline font-extrabold text-4xl">{formatCurrency(totalExpenses)}</h3>
                )}
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
          </div>

          <div className="p-8 rounded-[1.5rem] bg-on-background text-on-primary-container flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-primary-fixed mb-4">hourglass_empty</span>
              <p className="text-secondary-fixed-dim text-sm font-medium mb-1">Pendientes</p>
              <h3 className="font-headline font-extrabold text-3xl">
                {loading ? '—' : pendingCount}
              </h3>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-primary-fixed-dim text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver lista <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="p-8 rounded-[1.5rem] bg-surface-container flex flex-col justify-between border border-outline-variant/10">
            <div>
              <span className="material-symbols-outlined text-on-surface-variant mb-4">receipt_long</span>
              <p className="text-on-surface-variant text-sm font-medium mb-1">Este mes</p>
              <h3 className="font-headline font-extrabold text-3xl">
                {loading ? '—' : thisMonthCount}
              </h3>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: allReceipts.length > 0 ? `${Math.min(100, (allReceipts.length / 50) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Charts */}
        {!loading && allReceipts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
            {/* Bar chart: monthly */}
            <div className="lg:col-span-3 p-6 rounded-[1.5rem] bg-surface-container-low">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-1">Últimos 6 meses</p>
                  <h4 className="font-headline font-bold text-lg">Evolución de gastos</h4>
                </div>
                <div className="p-2.5 bg-surface-container-highest rounded-xl">
                  <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#9e7b6e', fontFamily: 'Inter, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(166,53,0,0.06)', radius: 8 }}
                    contentStyle={{
                      background: '#fff8f6',
                      border: '1px solid #e5beb2',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    formatter={(v) => [formatCurrency(Number(v)), 'Gastos']}
                  />
                  <Bar dataKey="total" fill="#a63500" radius={[8, 8, 0, 0]}>
                    {monthlyData.map((entry, i) => {
                      const isCurrentMonth = entry.key === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                      return <Cell key={i} fill={isCurrentMonth ? '#a63500' : '#e8845c'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart: by category */}
            <div className="lg:col-span-2 p-6 rounded-[1.5rem] bg-surface-container-low">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest mb-1">Por categoría</p>
                  <h4 className="font-headline font-bold text-lg">Distribución</h4>
                </div>
                <div className="p-2.5 bg-surface-container-highest rounded-xl">
                  <span className="material-symbols-outlined text-primary text-[20px]">donut_large</span>
                </div>
              </div>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#fff8f6',
                        border: '1px solid #e5beb2',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      formatter={(v) => [formatCurrency(Number(v)), '']}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-on-surface-variant/40 text-sm">
                  Sin datos suficientes
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h4 className="font-headline font-bold text-2xl">Tickets recientes</h4>
            <Link
              to="/history"
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-semibold flex items-center gap-2"
            >
              Ver todos
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          {loading ? (
            <div className="bg-surface-container-low rounded-[2rem] overflow-hidden">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-6 animate-pulse flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-highest" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-surface-container-highest rounded" />
                    <div className="h-3 w-24 bg-surface-container-highest rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : receipts.length === 0 ? (
            <div className="bg-surface-container-low rounded-[2rem] p-16 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">receipt_long</span>
              <p className="text-on-surface-variant mt-4 font-medium">No hay tickets aún</p>
              <button
                onClick={() => navigate('/scanner')}
                className="mt-4 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                Escanear primer ticket
              </button>
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-[2rem] overflow-hidden">
              {receipts.slice(0, 6).map((tx, i) => {
                const cat = tx.categories as { name: string } | null
                return (
                  <div
                    key={tx.id}
                    onClick={() => navigate('/history')}
                    className={`flex items-center justify-between p-6 hover:bg-surface-container-highest transition-colors cursor-pointer group ${i % 2 !== 0 ? 'bg-surface-container-lowest/40' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors ${i % 2 !== 0 ? 'bg-surface-container-low' : 'bg-surface-container-highest'}`}>
                        <span className="material-symbols-outlined text-primary">
                          {cat?.name ? (CATEGORY_ICONS[cat.name] ?? 'receipt') : 'receipt'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{tx.vendor}</p>
                        <p className="text-on-surface-variant text-xs">
                          {cat?.name && `${cat.name} • `}{formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-headline font-bold text-on-surface">{formatCurrency(tx.amount)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${STATUS_STYLES[tx.status] ?? STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[tx.status] ?? 'Pendiente'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#fff8f6]/70 backdrop-blur-xl z-50 rounded-t-[1.5rem] border-t border-[#e5beb2]/15 shadow-[0_-4px_24px_rgba(40,24,18,0.06)]">
        <Link to="/dashboard" className="flex flex-col items-center bg-[#fbdcd3] text-[#a63500] rounded-2xl px-5 py-2 active:scale-90 duration-150">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Dashboard</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
          <span className="material-symbols-outlined">history</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Historial</span>
        </Link>
        {isAdmin && (
          <Link to="/users" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
            <span className="material-symbols-outlined">group</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Usuarios</span>
          </Link>
        )}
        <button onClick={signOut} className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Salir</span>
        </button>
      </nav>

      {/* FAB mobile */}
      <button
        onClick={() => navigate('/scanner')}
        className="md:hidden fixed bottom-24 right-6 bg-primary text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 duration-200 z-40"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  )
}
