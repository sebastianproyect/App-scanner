import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Correo o contraseña incorrectos')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-background font-body flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-3xl">account_balance</span>
          </div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface tracking-tight">
            IDT Ledger
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Control de gastos empresarial</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
              Correo electrónico
            </label>
            <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3.5 rounded-xl focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">mail</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-semibold text-on-surface-variant uppercase tracking-widest px-1">
              Contraseña
            </label>
            <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3.5 rounded-xl focus-within:ring-2 focus-within:ring-surface-tint/40 transition-all">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">lock</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-error-container text-error px-4 py-3 rounded-xl text-sm font-medium">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold text-base shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                Entrando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">login</span>
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        <p className="text-center text-on-surface-variant/60 text-xs mt-8">
          ¿Problemas para entrar? Contacta al administrador.
        </p>
      </div>
    </div>
  )
}
