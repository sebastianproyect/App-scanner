import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Category } from '../lib/types'

interface AiResult {
  vendor: string
  date: string
  amount: number
  tax: number
  payment_method: string
  category: string
  notes: string
}

const CATEGORY_MAP: Record<string, string> = {
  'Oficina': 'Oficina',
  'Office': 'Oficina',
  'Transporte': 'Transporte',
  'Transport': 'Transporte',
  'Comida': 'Comida',
  'Food': 'Comida',
  'Servicios': 'Servicios',
  'Services': 'Servicios',
  'Papeleria': 'Papelería',
  'Papelería': 'Papelería',
  'Stationery': 'Papelería',
  'Otros': 'Otros',
  'Other': 'Otros',
}

export default function ReviewReceipt() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const imageData: string | null = (location.state as { imageData?: string })?.imageData ?? null

  const [categories, setCategories] = useState<Category[]>([])
  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [tax, setTax] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiError, setAiError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ vendor: string; date: string; amount: number } | null>(null)
  const [pendingSave, setPendingSave] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) setCategories(data as Category[])
    })
  }, [])

  // Run AI analysis automatically when image arrives
  useEffect(() => {
    if (!imageData || categories.length === 0) return
    analyzeWithAI()
  }, [imageData, categories])

  async function compressImage(dataUrl: string): Promise<string> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1600
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.92))
      }
      img.src = dataUrl
    })
  }

  async function analyzeWithAI() {
    setAnalyzing(true)
    setAiError('')
    try {
      const compressed = imageData ? await compressImage(imageData) : imageData
      const { data, error: fnError } = await supabase.functions.invoke('parse-receipt', {
        body: { imageBase64: compressed }
      })

      if (fnError) throw new Error(fnError.message)
      if (!data?.data) throw new Error(data?.error ?? 'Sin respuesta de la IA')

      const result = data.data as AiResult

      // Solo bloquear si no se extrajo absolutamente nada útil
      if (!result.vendor && !result.amount && !result.date && !result.notes) {
        throw new Error('La IA no pudo leer el ticket. Completa los campos manualmente.')
      }

      setVendor(result.vendor || '')
      if (result.date) setDate(result.date)
      if (result.amount) setAmount(String(result.amount))
      if (result.tax) setTax(String(result.tax))
      setPaymentMethod(result.payment_method || '')
      setNotes(result.notes || '')

      // Match AI category to our categories list
      if (result.category) {
        const normalized = CATEGORY_MAP[result.category] ?? result.category
        const match = categories.find(c =>
          c.name.toLowerCase() === normalized.toLowerCase()
        )
        if (match) setCategoryId(match.id)
      }

      setAiDone(true)
    } catch (e) {
      console.error('Error analizando ticket:', e)
      setAiError('La IA no pudo leer el ticket. Completa los campos manualmente.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function doSave() {
    if (!user) return
    setDuplicateWarning(null)
    setPendingSave(false)
    setSaving(true)
    setError('')

    let image_url: string | null = null

    if (imageData) {
      try {
        const blob = await (await fetch(imageData)).blob()
        const fileName = `${user.id}/${Date.now()}.jpg`
        const { data: uploadData } = await supabase.storage
          .from('receipt-images')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false })
        if (uploadData) image_url = uploadData.path
      } catch { /* continue without image */ }
    }

    const { error: insertError } = await supabase.from('receipts').insert({
      user_id: user.id,
      vendor: vendor.trim(),
      date,
      amount: parseFloat(amount) || 0,
      tax: parseFloat(tax) || 0,
      category_id: categoryId || null,
      payment_method: paymentMethod.trim(),
      image_url,
      notes: notes.trim(),
      status: 'pending',
    })

    setSaving(false)
    if (insertError) {
      setError('Error al guardar. Intenta de nuevo.')
    } else {
      navigate('/history')
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')

    // ── Duplicate check ──────────────────────────────────────────────────────
    const amountNum = parseFloat(amount) || 0
    if (vendor.trim() && amountNum > 0) {
      const { data: existing } = await supabase
        .from('receipts')
        .select('vendor, date, amount')
        .eq('user_id', user.id)
        .eq('date', date)
        .ilike('vendor', `%${vendor.trim().split(' ')[0]}%`)
        .limit(5)

      const dup = existing?.find(r => {
        const diff = Math.abs(Number(r.amount) - amountNum)
        return diff / (amountNum || 1) < 0.05   // within 5%
      })

      if (dup) {
        setDuplicateWarning({ vendor: dup.vendor, date: dup.date, amount: Number(dup.amount) })
        setPendingSave(true)
        return
      }
    }

    await doSave()
  }


  return (
    <div className="bg-background font-body text-on-surface selection:bg-surface-container-highest min-h-screen">
      {/* Header */}
      <header className="bg-[#fff8f6] top-0 sticky z-50 flex items-center justify-between px-6 py-4 w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center p-2 rounded-full hover:bg-[#fbdcd3]/50 transition-colors active:scale-95 duration-200 text-[#5c4037]"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="font-headline font-bold tracking-tight text-[#281812] text-xl">
            Revisar Ticket
          </span>
        </div>
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[18px]">account_balance</span>
        </div>
      </header>

      <form onSubmit={handleSave}>
        <main className="max-w-xl mx-auto px-6 pt-4 pb-36">

          {/* Receipt Image */}
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-surface-container-low mb-6 shadow-sm">
            {imageData ? (
              <img src={imageData} alt="Ticket escaneado" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/40">receipt_long</span>
                  <p className="text-on-surface-variant/60 text-sm">Sin imagen</p>
                </div>
              </div>
            )}

            {/* AI Status Badge */}
            <div className="absolute bottom-4 left-6">
              {analyzing ? (
                <div className="bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  Analizando con IA...
                </div>
              ) : aiDone ? (
                <div className="bg-primary/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  IA completó el formulario
                </div>
              ) : (
                <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">
                  TICKET ESCANEADO
                </span>
              )}
            </div>
          </div>

          {/* AI analyzing overlay message */}
          {analyzing && (
            <div className="bg-surface-container-low rounded-2xl p-4 mb-6 flex items-center gap-3 border border-primary/10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary animate-pulse">auto_awesome</span>
              </div>
              <div>
                <p className="font-semibold text-on-surface text-sm">Gemini IA leyendo el ticket...</p>
                <p className="text-on-surface-variant text-xs">Extrayendo monto, proveedor, fecha y categoría</p>
              </div>
            </div>
          )}

          {aiError && (
            <div className="bg-error-container/40 rounded-2xl p-4 mb-6 flex items-center gap-3 border border-error/20">
              <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <div>
                <p className="font-semibold text-on-surface text-sm">{aiError}</p>
                <p className="text-on-surface-variant text-xs">Puedes llenar los campos y guardar igual</p>
              </div>
            </div>
          )}

          {aiDone && (
            <div className="bg-tertiary/5 rounded-2xl p-4 mb-6 flex items-center gap-3 border border-tertiary/15">
              <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <p className="font-semibold text-on-surface text-sm">Información extraída automáticamente</p>
                <p className="text-on-surface-variant text-xs">Revisa y corrige si es necesario antes de guardar</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Vendor */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                Proveedor / Tienda
              </label>
              <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">storefront</span>
                </div>
                <input
                  className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-headline font-bold text-lg text-on-surface placeholder:text-on-surface-variant/40"
                  type="text"
                  placeholder="Nombre del establecimiento"
                  value={vendor}
                  onChange={e => setVendor(e.target.value)}
                  required
                  disabled={analyzing}
                />
              </div>
            </div>

            {/* Date & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                  Fecha
                </label>
                <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-3 focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                  <span className="material-symbols-outlined text-secondary text-sm shrink-0">calendar_today</span>
                  <input
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-body font-semibold text-on-surface text-sm"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    disabled={analyzing}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                  Categoría
                </label>
                <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-3 focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                  <span className="material-symbols-outlined text-secondary text-sm shrink-0">category</span>
                  <select
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-body font-semibold text-on-surface text-sm appearance-none"
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                    disabled={analyzing}
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                Monto Total
              </label>
              <div className="bg-surface-container-highest p-6 rounded-2xl flex items-baseline gap-3 focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                <span className="text-primary font-headline font-extrabold text-3xl">€</span>
                <input
                  className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-headline font-extrabold text-4xl text-primary tracking-tighter placeholder:text-primary/30"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  disabled={analyzing}
                />
              </div>
            </div>

            {/* Tax & Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                  Impuesto
                </label>
                <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                  <span className="text-on-surface-variant font-semibold text-sm">$</span>
                  <input
                    className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-headline font-bold text-lg text-on-surface placeholder:text-on-surface-variant/40"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tax}
                    onChange={e => setTax(e.target.value)}
                    disabled={analyzing}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                  Método de pago
                </label>
                <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm shrink-0">credit_card</span>
                  <input
                    className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-body font-semibold text-on-surface text-sm placeholder:text-on-surface-variant/40"
                    type="text"
                    placeholder="Efectivo, tarjeta..."
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    disabled={analyzing}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                Descripción
              </label>
              <textarea
                className="w-full bg-surface-container-low border-none p-4 rounded-xl focus:ring-2 focus:ring-surface-tint/40 transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm resize-none"
                rows={2}
                placeholder="Descripción del gasto..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={analyzing}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-error-container text-error px-4 py-3 rounded-xl text-sm font-medium">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}
          </div>
        </main>

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-background rounded-3xl p-7 w-full max-w-sm shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>content_copy</span>
              </div>
              <div>
                <h3 className="font-headline font-bold text-on-surface text-lg leading-tight">Ticket posiblemente duplicado</h3>
                <p className="text-on-surface-variant text-sm mt-1">Ya existe un ticket muy parecido guardado hoy:</p>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 space-y-1">
              <p className="font-bold text-on-surface text-sm">{duplicateWarning.vendor}</p>
              <p className="text-on-surface-variant text-xs">{new Date(duplicateWarning.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}</p>
              <p className="font-headline font-extrabold text-primary text-xl">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(duplicateWarning.amount)}
              </p>
            </div>
            <p className="text-on-surface-variant text-sm">¿Quieres guardarlo de todas formas o cancelar?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setDuplicateWarning(null); setPendingSave(false) }}
                className="flex-1 py-3 rounded-xl bg-surface-container-highest text-on-surface font-semibold text-sm active:scale-95 transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={doSave}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform"
              >
                Guardar igual
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Fixed Bottom Action */}
        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-xl mx-auto flex gap-3">
            {!analyzing && (
              <button
                type="button"
                onClick={analyzeWithAI}
                className="px-4 py-4 rounded-xl bg-surface-container-highest text-primary font-semibold flex items-center gap-2 active:scale-95 transition-transform"
                title="Volver a analizar con IA"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </button>
            )}
            <button
              type="submit"
              disabled={saving || analyzing}
              className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold text-lg shadow-lg hover:opacity-95 transition-opacity active:scale-[0.98] duration-150 flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Guardando...
                </>
              ) : analyzing ? (
                <>
                  <span className="material-symbols-outlined animate-pulse">auto_awesome</span>
                  Analizando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                  Confirmar y Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
