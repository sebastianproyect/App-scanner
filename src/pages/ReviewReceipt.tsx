import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Category } from '../lib/types'

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

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) setCategories(data as Category[])
    })
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setSaving(true)

    let image_url: string | null = null

    // Upload image to Supabase Storage if present
    if (imageData) {
      const blob = await (await fetch(imageData)).blob()
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipt-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) {
        console.error('Error subiendo imagen:', uploadError)
      } else {
        image_url = uploadData.path
      }
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
      setError('Error al guardar el ticket. Intenta de nuevo.')
      console.error(insertError)
    } else {
      navigate('/history')
    }
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
          {/* Receipt Image Preview */}
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-surface-container-low mb-8 shadow-sm">
            {imageData ? (
              <img src={imageData} alt="Ticket escaneado" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant/40">receipt_long</span>
                  <p className="text-on-surface-variant/60 text-sm font-medium">Sin imagen</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-6">
              <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">
                TICKET ESCANEADO
              </span>
            </div>
          </div>

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
                <span className="text-primary font-headline font-extrabold text-3xl">$</span>
                <input
                  className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-headline font-extrabold text-4xl text-primary tracking-tighter placeholder:text-primary/30"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
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
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
                Notas (opcional)
              </label>
              <textarea
                className="w-full bg-surface-container-low border-none p-4 rounded-xl focus:ring-2 focus:ring-surface-tint/40 transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm resize-none"
                rows={2}
                placeholder="Descripción adicional del gasto..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
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

        {/* Fixed Bottom Action */}
        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-xl mx-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold text-lg shadow-lg hover:opacity-95 transition-opacity active:scale-[0.98] duration-150 flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Guardando...
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
