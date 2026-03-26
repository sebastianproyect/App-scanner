import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, writeAuditLog } from '../lib/supabase'
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
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [collapsedEmployees, setCollapsedEmployees] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !profile) return
    fetchReceipts()
  }, [user, profile])

  async function fetchReceipts() {
    setLoading(true)
    setFetchError('')

    let query = supabase
      .from('receipts')
      .select('*, categories(id, name, icon)')
      .order('created_at', { ascending: false })

    // Employee: only sees their own tickets
    if (!isAdmin) {
      query = query.eq('user_id', user!.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error cargando recibos:', error.message)
      setFetchError(`Error al cargar tickets: ${error.message}`)
    } else if (data) {
      setReceipts(data as Receipt[])
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

  async function changeStatus(receiptId: string, newStatus: string, receipt: Receipt) {
    const { error } = await supabase
      .from('receipts')
      .update({ status: newStatus })
      .eq('id', receiptId)
    if (!error) {
      setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, status: newStatus as Receipt['status'] } : r))
      await writeAuditLog('status_changed', receiptId, {
        old_status: receipt.status,
        new_status: newStatus,
        vendor: receipt.vendor,
        amount: receipt.amount,
        receipt_user_id: receipt.user_id,
      })
    }
  }

  function getImageUrl(path: string): string {
    const { data } = supabase.storage.from('receipt-images').getPublicUrl(path)
    return data.publicUrl
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  }

  function exportToPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

    // Header background
    doc.setFillColor(166, 53, 0)
    doc.rect(0, 0, pageW, 38, 'F')

    // Logo area
    doc.setFillColor(255, 255, 255, 0.15)
    doc.roundedRect(14, 8, 22, 22, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text('IDT', 25, 22, { align: 'center' })

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Informe de Gastos', 42, 18)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado el ${today}`, 42, 26)
    if (isAdmin) doc.text('Vista administrador — todos los empleados', 42, 32)

    // Summary cards
    const total = filtered.reduce((s, r) => s + Number(r.amount), 0)
    const totalTax = filtered.reduce((s, r) => s + Number(r.tax), 0)
    const pending = filtered.filter(r => r.status === 'pending').length

    doc.setFillColor(255, 248, 246)
    doc.roundedRect(14, 44, 55, 22, 3, 3, 'F')
    doc.roundedRect(75, 44, 55, 22, 3, 3, 'F')
    doc.roundedRect(136, 44, 55, 22, 3, 3, 'F')

    doc.setFontSize(7)
    doc.setTextColor(92, 64, 55)
    doc.setFont('helvetica', 'normal')
    doc.text('TOTAL GASTOS', 41, 51, { align: 'center' })
    doc.text('TOTAL IVA', 102, 51, { align: 'center' })
    doc.text('PENDIENTES', 163, 51, { align: 'center' })

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(166, 53, 0)
    doc.text(formatCurrency(total), 41, 61, { align: 'center' })
    doc.text(formatCurrency(totalTax), 102, 61, { align: 'center' })
    doc.setTextColor(40, 24, 18)
    doc.text(String(pending), 163, 61, { align: 'center' })

    // Table
    const head = isAdmin
      ? [['Empleado', 'Proveedor', 'Fecha', 'Categoría', 'Método pago', 'IVA', 'Total', 'Estado']]
      : [['Proveedor', 'Fecha', 'Categoría', 'Método pago', 'IVA', 'Total', 'Estado']]

    const body = filtered.map(r => {
      const cat = (r.categories as { name: string } | null)?.name ?? '—'
      const st = STATUS_LABELS[r.status]?.label ?? r.status
      const row = [
        r.vendor || '—',
        formatDate(r.date),
        cat,
        r.payment_method || '—',
        formatCurrency(r.tax),
        formatCurrency(r.amount),
        st,
      ]
      if (isAdmin) row.unshift(profilesMap[r.user_id]?.full_name || 'Empleado')
      return row
    })

    autoTable(doc, {
      startY: 72,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [166, 53, 0], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [40, 24, 18] },
      alternateRowStyles: { fillColor: [255, 248, 246] },
      columnStyles: { [isAdmin ? 7 : 6]: { fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    })

    // Footer
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.setFont('helvetica', 'normal')
      doc.text(`IDT Ledger — Informe confidencial`, 14, 290)
      doc.text(`Página ${i} de ${pageCount}`, pageW - 14, 290, { align: 'right' })
    }

    doc.save(`IDT-Informe-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  async function exportToExcel() {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'IDT Ledger'
    wb.created = new Date()

    const ws = wb.addWorksheet('Tickets IDT', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    })

    const ORANGE = 'FFA63500'
    const ORANGE_LIGHT = 'FFFFF0EB'
    const DARK = 'FF281812'
    const GRAY = 'FF5C4037'
    const WHITE = 'FFFFFFFF'
    const STATUS_COLORS: Record<string, string> = {
      pending: 'FFFFF3CD',
      synced:  'FFD4EDDA',
      flagged: 'FFF8D7DA',
    }

    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const totalAmount = filtered.reduce((s, r) => s + Number(r.amount), 0)
    const totalTax    = filtered.reduce((s, r) => s + Number(r.tax), 0)
    const colCount    = isAdmin ? 9 : 8

    // ── Row 1: Title banner ──────────────────────────────────────────────────
    ws.mergeCells(1, 1, 1, colCount)
    const titleCell = ws.getCell('A1')
    titleCell.value = '  INDET Group — Informe de Gastos'
    titleCell.font = { bold: true, size: 16, color: { argb: WHITE }, name: 'Calibri' }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(1).height = 36

    // ── Row 2: Subtitle ──────────────────────────────────────────────────────
    ws.mergeCells(2, 1, 2, colCount)
    const subCell = ws.getCell('A2')
    subCell.value = `  Generado el ${today}${isAdmin ? '  ·  Vista administrador — todos los empleados' : ''}`
    subCell.font = { size: 10, color: { argb: 'FFFFFFFF' }, italic: true }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7A2600' } }
    subCell.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(2).height = 22

    // ── Row 3: Summary cards ─────────────────────────────────────────────────
    ws.mergeCells(3, 1, 3, colCount)
    const summaryCell = ws.getCell('A3')
    summaryCell.value = `  TOTAL GASTOS: ${formatCurrency(totalAmount)}     TOTAL IVA: ${formatCurrency(totalTax)}     TICKETS: ${filtered.length}     PENDIENTES: ${filtered.filter(r => r.status === 'pending').length}`
    summaryCell.font = { bold: true, size: 11, color: { argb: ORANGE } }
    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_LIGHT } }
    summaryCell.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(3).height = 28

    // ── Row 4: Empty spacer ──────────────────────────────────────────────────
    ws.getRow(4).height = 6

    // ── Row 5: Column headers ────────────────────────────────────────────────
    const headers = [
      ...(isAdmin ? ['Empleado'] : []),
      'Proveedor', 'Fecha', 'Categoría', 'Método de pago', 'IVA (€)', 'Total (€)', 'Estado', 'Notas',
    ]
    const headerRow = ws.getRow(5)
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h
      cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Calibri' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF7A2600' } },
      }
    })
    headerRow.height = 28

    // ── Rows 6+: Data ────────────────────────────────────────────────────────
    filtered.forEach((r, idx) => {
      const cat = (r.categories as { name: string } | null)?.name ?? '—'
      const st  = STATUS_LABELS[r.status]?.label ?? r.status
      const isEven = idx % 2 === 0
      const bgColor = isEven ? 'FFFFFFFF' : 'FFFFF8F6'

      const rowData = [
        ...(isAdmin ? [profilesMap[r.user_id]?.full_name || '—'] : []),
        r.vendor || '—',
        r.date,
        cat,
        r.payment_method || '—',
        r.tax,
        r.amount,
        st,
        r.notes || '',
      ]

      const dataRow = ws.getRow(6 + idx)
      rowData.forEach((val, i) => {
        const cell = dataRow.getCell(i + 1)
        cell.value = val
        cell.font = { size: 10, color: { argb: DARK } }
        cell.alignment = { vertical: 'middle', horizontal: i >= (isAdmin ? 4 : 3) && i <= (isAdmin ? 5 : 4) ? 'right' : 'left' }

        // Status column: colored background
        const statusCol = isAdmin ? 7 : 6
        if (i + 1 === statusCol) {
          const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc } }
          cell.font = { bold: true, size: 10, color: { argb: GRAY } }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        }

        // Currency columns
        const amountCol  = isAdmin ? 6 : 5
        const taxCol     = isAdmin ? 5 : 4
        if (i + 1 === amountCol || i + 1 === taxCol) {
          cell.numFmt = '#,##0.00 "€"'
          cell.font = { bold: i + 1 === amountCol, size: 10, color: { argb: i + 1 === amountCol ? ORANGE : GRAY } }
        }

        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFEDDDD8' } },
        }
      })
      dataRow.height = 22
    })

    // ── Totals row ───────────────────────────────────────────────────────────
    const totalRow = ws.getRow(6 + filtered.length)
    const amountColIdx = isAdmin ? 6 : 5
    const taxColIdx    = isAdmin ? 5 : 4

    ws.mergeCells(6 + filtered.length, 1, 6 + filtered.length, taxColIdx - 1)
    const totalLabelCell = totalRow.getCell(1)
    totalLabelCell.value = 'TOTAL'
    totalLabelCell.font = { bold: true, size: 11, color: { argb: WHITE } }
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const taxTotalCell = totalRow.getCell(taxColIdx)
    taxTotalCell.value = totalTax
    taxTotalCell.numFmt = '#,##0.00 "€"'
    taxTotalCell.font = { bold: true, size: 11, color: { argb: WHITE } }
    taxTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    taxTotalCell.alignment = { horizontal: 'right', vertical: 'middle' }

    const amountTotalCell = totalRow.getCell(amountColIdx)
    amountTotalCell.value = totalAmount
    amountTotalCell.numFmt = '#,##0.00 "€"'
    amountTotalCell.font = { bold: true, size: 13, color: { argb: WHITE } }
    amountTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    amountTotalCell.alignment = { horizontal: 'right', vertical: 'middle' }

    // Fill remaining total cells orange
    for (let c = amountColIdx + 1; c <= colCount; c++) {
      const cell = totalRow.getCell(c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
    }
    totalRow.height = 28

    // ── Column widths ────────────────────────────────────────────────────────
    const colWidths = isAdmin
      ? [18, 28, 13, 16, 16, 10, 12, 12, 35]
      : [28, 13, 16, 16, 10, 12, 12, 35]
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    // ── Footer row ───────────────────────────────────────────────────────────
    const footerRowIdx = 7 + filtered.length
    ws.mergeCells(footerRowIdx, 1, footerRowIdx, colCount)
    const footerCell = ws.getCell(`A${footerRowIdx}`)
    footerCell.value = `IDT Ledger — INDET Group · Informe confidencial · ${today}`
    footerCell.font = { size: 8, italic: true, color: { argb: 'FFAAAAAA' } }
    footerCell.alignment = { horizontal: 'center' }
    ws.getRow(footerRowIdx).height = 18

    // ── Download ─────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `IDT-Informe-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
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
                <div className="flex gap-2">
                  <button
                    onClick={exportToPDF}
                    disabled={filtered.length === 0}
                    className="flex-1 bg-[#a63500] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-primary/10 disabled:opacity-40"
                  >
                    PDF
                    <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  </button>
                  <button
                    onClick={exportToExcel}
                    disabled={filtered.length === 0}
                    className="flex-1 editorial-gradient text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 duration-200 shadow-lg shadow-primary/10 disabled:opacity-40"
                  >
                    Excel
                    <span className="material-symbols-outlined text-sm">table_chart</span>
                  </button>
                </div>
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

        {/* Error display */}
        {fetchError && (
          <div className="bg-error-container/40 rounded-2xl p-4 mb-6 flex items-center gap-3 border border-error/20">
            <span className="material-symbols-outlined text-error">error</span>
            <p className="text-sm text-on-surface font-medium">{fetchError}</p>
          </div>
        )}

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
        ) : isAdmin ? (
          /* ── ADMIN: grouped by employee ── */
          <div className="space-y-6">
            {Object.entries(
              filtered.reduce((acc, r) => {
                if (!acc[r.user_id]) acc[r.user_id] = []
                acc[r.user_id].push(r)
                return acc
              }, {} as Record<string, Receipt[]>)
            )
            .sort(([, a], [, b]) => b.filter(r => r.status === 'pending').length - a.filter(r => r.status === 'pending').length)
            .map(([userId, userReceipts]) => {
              const emp = profilesMap[userId]
              const total = userReceipts.reduce((s, r) => s + Number(r.amount), 0)
              const pending = userReceipts.filter(r => r.status === 'pending').length
              const collapsed = collapsedEmployees.has(userId)
              const initials = emp?.full_name
                ? emp.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                : '?'
              return (
                <div key={userId} className="rounded-2xl overflow-hidden border border-outline-variant/15">
                  {/* Employee header */}
                  <button
                    onClick={() => setCollapsedEmployees(prev => {
                      const next = new Set(prev)
                      next.has(userId) ? next.delete(userId) : next.add(userId)
                      return next
                    })}
                    className="w-full flex items-center justify-between px-5 py-4 bg-surface-container hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
                        <span className="font-headline font-bold text-white text-sm">{initials}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-on-surface text-base leading-tight">
                          {emp?.full_name || 'Empleado'}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {userReceipts.length} ticket{userReceipts.length !== 1 ? 's' : ''}
                          {pending > 0 && <span className="ml-2 text-secondary-container bg-secondary-container/20 px-1.5 py-0.5 rounded font-semibold">{pending} pendiente{pending !== 1 ? 's' : ''}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-headline font-extrabold text-lg text-primary">{formatCurrency(total)}</span>
                      <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${collapsed ? '' : 'rotate-180'}`}>
                        keyboard_arrow_down
                      </span>
                    </div>
                  </button>

                  {/* Tickets for this employee */}
                  {!collapsed && (
                    <div className="divide-y divide-outline-variant/10">
                      {userReceipts.map(r => {
                        const cat = r.categories as { name: string } | null
                        const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
                        return (
                          <div key={r.id} className="flex items-center justify-between px-5 py-4 bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-12 h-12 rounded-xl bg-surface-container shrink-0 overflow-hidden flex items-center justify-center ${r.image_url ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                                onClick={() => r.image_url && setSelectedImage(getImageUrl(r.image_url))}
                              >
                                {r.image_url ? (
                                  <img src={getImageUrl(r.image_url)} alt="Ticket" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-primary text-xl">
                                    {cat?.name ? (CATEGORY_ICONS[cat.name] ?? 'receipt') : 'receipt'}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-on-surface text-sm truncate">{r.vendor || '—'}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-on-surface-variant">{formatDate(r.date)}</span>
                                  {cat?.name && <span className="text-xs text-on-surface-variant/60">• {cat.name}</span>}
                                  <span className={`flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded ${st.cls}`}>
                                    <span className="material-symbols-outlined text-[11px]">{st.icon}</span>
                                    {st.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {r.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => changeStatus(r.id, 'synced', r)}
                                    className="w-8 h-8 rounded-full bg-tertiary/10 hover:bg-tertiary/20 flex items-center justify-center transition-colors"
                                    title="Aprobar"
                                  >
                                    <span className="material-symbols-outlined text-tertiary text-[18px]">check</span>
                                  </button>
                                  <button
                                    onClick={() => changeStatus(r.id, 'flagged', r)}
                                    className="w-8 h-8 rounded-full bg-error-container/40 hover:bg-error-container/70 flex items-center justify-center transition-colors"
                                    title="Rechazar"
                                  >
                                    <span className="material-symbols-outlined text-error text-[18px]">close</span>
                                  </button>
                                </>
                              )}
                              <div className="text-right">
                                {r.tax > 0 && <span className="block text-xs text-on-surface-variant mb-0.5">IVA: {formatCurrency(r.tax)}</span>}
                                <span className="font-headline font-bold text-base text-on-surface">{formatCurrency(r.amount)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ── EMPLOYEE: flat list ── */
          <div className="space-y-3">
            {filtered.map(r => {
              const cat = r.categories as { name: string; icon?: string } | null
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
              return (
                <div key={r.id} className="group bg-surface-container-lowest hover:bg-surface-container-low transition-colors rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center shrink-0 overflow-hidden ${r.image_url ? 'cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all' : ''}`}
                      onClick={() => r.image_url && setSelectedImage(getImageUrl(r.image_url))}
                    >
                      {r.image_url ? (
                        <img src={getImageUrl(r.image_url)} alt="Ticket" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-primary text-2xl">
                          {cat?.name ? (CATEGORY_ICONS[cat.name] ?? 'receipt') : 'receipt'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface text-base leading-tight">{r.vendor || '—'}</h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs font-medium text-on-surface-variant">{formatDate(r.date)}</span>
                        {cat?.name && <span className="text-xs text-on-surface-variant/70">• {cat.name}</span>}
                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md ${st.cls}`}>
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: r.status === 'synced' ? "'FILL' 1" : "'FILL' 0" }}>{st.icon}</span>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {r.tax > 0 && <span className="block text-xs text-on-surface-variant font-label mb-0.5">IVA: {formatCurrency(r.tax)}</span>}
                    <span className="block font-headline font-extrabold text-xl text-on-surface">{formatCurrency(r.amount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 flex items-center gap-2 text-white/70 hover:text-white transition-colors font-semibold text-sm"
            >
              Cerrar <span className="material-symbols-outlined">close</span>
            </button>
            <img
              src={selectedImage}
              alt="Ticket"
              className="w-full rounded-2xl shadow-2xl max-h-[80vh] object-contain"
            />
            <a
              href={selectedImage}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
              onClick={e => e.stopPropagation()}
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Ver tamaño completo
            </a>
          </div>
        </div>
      )}

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
        {isAdmin && (
          <Link to="/users" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
            <span className="material-symbols-outlined">group</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Usuarios</span>
          </Link>
        )}
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
