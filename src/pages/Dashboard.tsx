import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Receipt } from '../lib/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return
    let query = supabase
      .from('receipts')
      .select('*, categories(id, name, icon)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (!isAdmin) query = query.eq('user_id', user.id)
    query.then(({ data }) => {
      if (data) setReceipts(data as Receipt[])
      setLoading(false)
    })
  }, [user, profile])

  const totalExpenses = receipts.reduce((s, r) => s + Number(r.amount), 0)
  const pendingCount  = receipts.filter(r => r.status === 'pending').length
  const currentMonth  = new Date().toLocaleString('es-MX', { month: 'long', year: 'numeric' })

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest font-label">En vivo</span>
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
          {/* Total expenses */}
          <div className="md:col-span-2 p-8 rounded-[1.5rem] bg-surface-container-low flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-surface-container-highest rounded-2xl">
                  <span className="material-symbols-outlined text-primary">payments</span>
                </div>
                <span className="text-on-surface-variant text-sm font-medium">
                  {receipts.length} ticket{receipts.length !== 1 ? 's' : ''}
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

          {/* Pending */}
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

          {/* This month count */}
          <div className="p-8 rounded-[1.5rem] bg-surface-container flex flex-col justify-between border border-outline-variant/10">
            <div>
              <span className="material-symbols-outlined text-on-surface-variant mb-4">receipt_long</span>
              <p className="text-on-surface-variant text-sm font-medium mb-1">Este mes</p>
              <h3 className="font-headline font-extrabold text-3xl">
                {loading ? '—' : receipts.filter(r => {
                  const d = new Date(r.created_at)
                  const now = new Date()
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                }).length}
              </h3>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: receipts.length > 0 ? `${Math.min(100, (receipts.length / 50) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>

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
