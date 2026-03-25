import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Receipt, Profile } from '../lib/types'

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
  const isAdmin = profile?.role === 'admin'

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!user || !profile) return
    fetchReceipts()
  }, [user, profile])

  async function fetchReceipts() {
    setLoading(true)

    let query = supabase
      .from('receipts')
      .select('*, categories(id, name, icon)')
      .order('created_at', { ascending: false })

    // Employee: only sees their own tickets from today
    if (!isAdmin) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      query = query.gte('created_at', todayStart.toISOString())
    }

    const { data, error } = await query

    if (!error && data) {
      setReceipts(data as Receipt[])
    } else if (error) {
      console.error('Error cargando recibos:', error.message)
    }

    // Admin: also fetch all profiles to show submitter names
    if (isAdmin) {
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role')
      if (profilesData) {
        const map: Record<string, Profile> = {}
        profilesData.forEach(p => { map[p.id] = p as Profile })
        setProfilesMap(map)
      }
    }

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
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  }

  function exportToExcel() {
    const rows = filtered.map(r => ({
      'Empleado': isAdmin ? (profilesMap[r.user_id]?.full_name || r.user_id.slice(0, 8)) : undefined,
      'Proveedor': r.vendor,
      'Fecha': r.date,
      'Monto': r.amount,
      'IVA': r.tax,
      'Categoría': (r.categories as { name: string } | null)?.name ?? '',
      'Método de pago': r.payment_method,
      'Estado': STATUS_LABELS[r.status]?.label ?? r.status,
      'Notas': r.notes,
      'Registrado': new Date(r.created_at).toLocaleDateString('es-ES'),
    }))

    // Remove 'Empleado' column for non-admin
    const finalRows = isAdmin ? rows : rows.map(({ Empleado: _, ...rest }) => rest)

    const ws = XLSX.utils.json_to_sheet(finalRows)
    ws['!cols'] = isAdmin
      ? [{ wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 14 }]
      : [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 14 }]

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
            <div>
              <span className="font-headline font-bold tracking-tight text-[#281812] text-xl">Historial</span>
              {isAdmin && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">Admin</span>
              )}
            </div>
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

        {/* Admin banner */}
        {isAdmin && (
          <div className="bg-primary/5 border-t border-primary/10 px-6 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">admin_panel_settings</span>
            <span className="text-xs text-primary font-semibold">Vista administrador — mostrando todos los tickets de todos los empleados</span>
          </div>
        )}
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

          {/* Export Card — solo admin */}
          <div className="lg:col-span-4">
            {isAdmin ? (
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/15 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-on-tertiary-container rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-tertiary">table_chart</span>
                    </div>
                    <h3 className="font-headline font-bold text-on-surface">Exportar Excel</h3>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
                    Descarga todos los tickets en un archivo .xlsx con nombre del empleado.
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
            ) : (
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/15 h-full flex flex-col justify-center items-center text-center gap-3">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">lock</span>
                <p className="text-on-surface-variant text-sm">
                  Solo el administrador puede exportar y ver todos los tickets.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* List Header */}
        <div className="flex items-end justify-between mb-5 px-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 font-label">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
              {isAdmin
                ? receipts.length > 0 && ` · ${[...new Set(receipts.map(r => r.user_id))].length} empleado(s)`
                : ` · ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`
              }
            </span>
            <h2 className="text-3xl font-headline font-extrabold text-on-surface mt-1">
              {isAdmin ? 'Todos los tickets' : 'Tus envíos de hoy'}
            </h2>
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
              {receipts.length === 0
                ? isAdmin ? 'Aún no hay tickets registrados' : 'No has enviado ningún ticket hoy'
                : 'Sin resultados para tu búsqueda'}
            </p>
            {receipts.length === 0 && (
              <button
                onClick={() => navigate('/scanner')}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                {isAdmin ? 'Escanear primer ticket' : 'Escanear ticket'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const cat = r.categories as { name: string; icon?: string } | null
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
              const submitter = isAdmin ? profilesMap[r.user_id] : null
              return (
                <div
                  key={r.id}
                  className="group bg-surface-container-lowest hover:bg-surface-container-low transition-colors rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">
                        {cat?.name ? (CATEGORY_ICONS[cat.name] ?? 'receipt') : 'receipt'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-base leading-tight">{r.vendor || '—'}</h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs font-medium text-on-surface-variant">{formatDate(r.date)}</span>
                        {cat?.name && (
                          <span className="text-xs text-on-surface-variant/70">• {cat.name}</span>
                        )}
                        {/* Admin: show submitter name */}
                        {submitter && (
                          <span className="flex items-center gap-1 text-xs text-primary/70 font-medium">
                            <span className="material-symbols-outlined text-[12px]">person</span>
                            {submitter.full_name || 'Empleado'}
                          </span>
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
