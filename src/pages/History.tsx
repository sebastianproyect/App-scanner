import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Receipt } from '../lib/types'

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: string }> = {
  pending:  { label: 'Pendiente', cls: 'bg-secondary-container text-on-secondary-container', icon: 'schedule' },
  synced:   { label: 'Guardado',  cls: 'bg-tertiary/10 text-tertiary',                       icon: 'check_circle' },
  flagged:  { label: 'Revisión',  cls: 'bg-error-container text-error',                      icon: 'flag' },
}

const CATEGORY_ICONS: Record<string, string> = {
  'Oficina': 'business_center',
  'Transporte': 'directions_car',
  'Comida': 'restaurant',
  'Servicios': 'bolt',
  'Papelería': 'edit_note',
  'Otros': 'more_horiz',
}

export default function History() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    fetchReceipts()
  }, [user])

  async function fetchReceipts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('receipts')
      .select('*, categories(id, name, icon)')
      .order('date', { ascending: false })
    if (!error && data) setReceipts(data as Receipt[])
    setLoading(false)
  }

  const filtered = receipts.filter(r => {
    const matchSearch =
      r.vendor.toLowerCase().includes(search.toLowerCase()) ||
      String(r.amount).includes(search)
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
  }

  function exportToExcel() {
    const rows = filtered.map(r => ({
      'Proveedor': r.vendor,
      'Fecha': r.date,
      'Monto': r.amount,
      'Impuesto': r.tax,
      'Categoría': (r.categories as { name: string } | null)?.name ?? '',
      'Método de pago': r.payment_method,
      'Estado': STATUS_LABELS[r.status]?.label ?? r.status,
      'Notas': r.notes,
      'Registrado': new Date(r.created_at).toLocaleDateString('es-MX'),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets IDT')
    XLSX.writeFile(wb, `IDT-Gastos-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="bg-background font-body text-on-surface min-h-screen pb-32">
      {/* Header */}
      <header className="bg-[#fff8f6] top-0 sticky z-50">
        <div className="flex items-center justify-between px-6 py-4 w-full">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">account_balance</span>
            </div>
            <span className="font-headline font-bold tracking-tight text-[#281812] text-xl">Historial</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[13px]">person</span>
              </div>
              <span className="text-xs font-semibold text-on-surface-variant hidden sm:block">
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
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8">
        {/* Search & Export */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          <div className="lg:col-span-8 space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">search</span>
              <input
                className="w-full pl-12 pr-6 py-4 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-surface-tint/40 transition-all text-on-surface placeholder:text-on-surface-variant/60"
                placeholder="Buscar por proveedor o monto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'synced', label: 'Guardados' },
                { key: 'pending', label: 'Pendientes' },
                { key: 'flagged', label: 'En revisión' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                    statusFilter === f.key
                      ? 'bg-surface-container-highest text-primary scale-105'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Card */}
          <div className="lg:col-span-4">
            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/15 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-on-tertiary-container rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary">table_chart</span>
                  </div>
                  <h3 className="font-headline font-bold text-on-surface">Exportar Excel</h3>
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                  Descarga todos los tickets en un archivo .xlsx listo para compartir.
                </p>
              </div>
              <button
                onClick={exportToExcel}
                disabled={filtered.length === 0}
                className="editorial-gradient text-white w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-primary/10 disabled:opacity-40"
              >
                Descargar Excel
                <span className="material-symbols-outlined text-sm">download</span>
              </button>
            </div>
          </div>
        </section>

        {/* List Header */}
        <div className="flex items-end justify-between mb-5 px-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 font-label">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
            </span>
            <h2 className="text-3xl font-headline font-extrabold text-on-surface mt-1">Tickets recientes</h2>
          </div>
          <button
            onClick={fetchReceipts}
            className="p-2 rounded-full hover:bg-surface-container-highest transition-colors"
            title="Actualizar"
          >
            <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
          </button>
        </div>

        {/* Receipt List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30">receipt_long</span>
            <p className="text-on-surface-variant mt-4 font-medium">
              {receipts.length === 0 ? 'Aún no hay tickets registrados' : 'Sin resultados para tu búsqueda'}
            </p>
            {receipts.length === 0 && (
              <button
                onClick={() => navigate('/scanner')}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                Escanear primer ticket
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const cat = r.categories as { name: string; icon?: string } | null
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
              return (
                <div
                  key={r.id}
                  className="group bg-surface-container-lowest hover:bg-surface-container-low transition-colors rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">
                        {cat?.name ? (CATEGORY_ICONS[cat.name] ?? 'receipt') : 'receipt'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-base leading-tight">{r.vendor}</h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs font-medium text-on-surface-variant">{formatDate(r.date)}</span>
                        {cat?.name && (
                          <span className="text-xs text-on-surface-variant/70">• {cat.name}</span>
                        )}
                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md ${st.cls}`}>
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: r.status === 'synced' ? "'FILL' 1" : "'FILL' 0" }}>
                            {st.icon}
                          </span>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      {r.tax > 0 && (
                        <span className="block text-xs text-on-surface-variant font-label mb-0.5">
                          IVA: {formatCurrency(r.tax)}
                        </span>
                      )}
                      <span className="block font-headline font-extrabold text-xl text-on-surface">
                        {formatCurrency(r.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#fff8f6]/70 backdrop-blur-xl border-t border-[#e5beb2]/15 shadow-[0_-4px_24px_rgba(40,24,18,0.06)] z-50 rounded-t-[1.5rem]">
        <Link to="/dashboard" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Dashboard</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center bg-[#fbdcd3] text-[#a63500] rounded-2xl px-5 py-2 active:scale-90 duration-150">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Historial</span>
        </Link>
        <button
          onClick={() => navigate('/scanner')}
          className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150"
        >
          <span className="material-symbols-outlined">document_scanner</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Escanear</span>
        </button>
      </nav>
    </div>
  )
}
