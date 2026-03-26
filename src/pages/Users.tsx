import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, writeAuditLog } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface ManagedUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'employee'
  created_at: string
  last_sign_in_at?: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function callManageUsers(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  return res.json()
}

export default function Users() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')

  // Edit modal
  const [editUser, setEditUser] = useState<ManagedUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'employee'>('employee')
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return }
    fetchUsers()
  }, [isAdmin])

  async function fetchUsers() {
    setLoading(true)
    setError('')
    const result = await callManageUsers('list_users')
    if (result.error) {
      setError(result.error)
    } else {
      setUsers(result.users ?? [])
    }
    setLoading(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')

    const result = await callManageUsers('invite_user', {
      email: inviteEmail.trim(),
      full_name: inviteName.trim(),
    })

    setInviting(false)
    if (result.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess(`Invitación enviada a ${inviteEmail}. El empleado recibirá un email para crear su contraseña.`)
      await writeAuditLog('user_invited', result.user_id, { email: inviteEmail.trim(), full_name: inviteName.trim() })
      setInviteEmail('')
      setInviteName('')
      fetchUsers()
    }
  }

  async function handleSaveEdit() {
    if (!editUser) return
    setSaving(true)
    const result = await callManageUsers('update_user', {
      user_id: editUser.id,
      full_name: editName,
      role: editRole,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      await writeAuditLog('user_updated', editUser.id, { full_name: editName, role: editRole })
      setEditUser(null)
      fetchUsers()
    }
  }

  async function handleDelete() {
    if (!deleteUser) return
    setDeleting(true)
    const result = await callManageUsers('delete_user', { user_id: deleteUser.id })
    setDeleting(false)
    if (result.error) {
      setError(result.error)
    } else {
      await writeAuditLog('user_deleted', deleteUser.id, { email: deleteUser.email })
      setDeleteUser(null)
      fetchUsers()
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function getInitials(name: string, email: string) {
    if (name?.trim()) return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    return email?.slice(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-background font-body pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#fff8f6]/80 backdrop-blur-xl border-b border-outline-variant/20 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline font-extrabold text-on-surface text-xl leading-tight">Gestión de usuarios</h1>
              <p className="text-xs text-on-surface-variant">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => { setShowInviteForm(true); setInviteSuccess(''); setInviteError('') }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Invitar
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-3">
        {error && (
          <div className="bg-error-container text-error rounded-2xl px-4 py-3 text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 animate-pulse flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
            <p className="text-on-surface-variant text-sm">Cargando usuarios...</p>
          </div>
        ) : (
          users.map(u => (
            <div key={u.id} className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <span className="font-headline font-extrabold text-primary text-sm">
                  {getInitials(u.full_name, u.email)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-on-surface text-sm">
                    {u.full_name || <span className="text-on-surface-variant italic">Sin nombre</span>}
                  </p>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-secondary-container text-on-secondary-container'
                  }`}>
                    {u.role === 'admin' ? 'Admin' : 'Empleado'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">{u.email}</p>
                <p className="text-[11px] text-on-surface-variant/50 mt-0.5">
                  {u.last_sign_in_at
                    ? `Último acceso: ${formatDate(u.last_sign_in_at)}`
                    : `Invitado el ${formatDate(u.created_at)} · Sin acceso aún`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditUser(u); setEditName(u.full_name); setEditRole(u.role) }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors"
                  title="Editar"
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">edit</span>
                </button>
                <button
                  onClick={() => setDeleteUser(u)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/50 transition-colors"
                  title="Eliminar"
                >
                  <span className="material-symbols-outlined text-error text-[20px]">person_remove</span>
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ── INVITE MODAL ── */}
      {showInviteForm && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowInviteForm(false)}
        >
          <div
            className="bg-[#fff8f6] rounded-t-[2rem] w-full max-w-lg p-6 pb-10 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-on-surface text-xl">Invitar empleado</h3>
              <button
                onClick={() => setShowInviteForm(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-sm text-on-surface-variant">
              El empleado recibirá un email con un enlace para crear su contraseña y acceder a la app.
            </p>

            {inviteSuccess && (
              <div className="bg-tertiary/10 text-tertiary rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">check_circle</span>
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="bg-error-container text-error rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Nombre completo</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Ej: María García"
                  required
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email corporativo</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="empleado@indetgroup.com"
                  required
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Enviando invitación...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Enviar invitación
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editUser && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setEditUser(null)}
        >
          <div
            className="bg-[#fff8f6] rounded-t-[2rem] w-full max-w-lg p-6 pb-10 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-on-surface text-xl">Editar usuario</h3>
              <button onClick={() => setEditUser(null)} className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-sm text-on-surface-variant">{editUser.email}</p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Nombre completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Rol</label>
                <div className="flex gap-3">
                  {(['employee', 'admin'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setEditRole(r)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                        editRole === r
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {r === 'admin' ? '🔑 Administrador' : '👤 Empleado'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteUser && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setDeleteUser(null)}
        >
          <div
            className="bg-[#fff8f6] rounded-3xl w-full max-w-sm p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-error-container/50 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-error text-3xl">person_remove</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-headline font-bold text-on-surface text-lg">¿Eliminar usuario?</h3>
              <p className="text-sm text-on-surface-variant">
                Se eliminará <strong>{deleteUser.full_name || deleteUser.email}</strong> y no podrá acceder a la app. Sus tickets quedarán guardados.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUser(null)}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#fff8f6]/70 backdrop-blur-xl border-t border-[#e5beb2]/15 shadow-[0_-4px_24px_rgba(40,24,18,0.06)] z-50 rounded-t-[1.5rem]">
        <Link to="/dashboard" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Dashboard</span>
        </Link>
        <Link to="/history" className="flex flex-col items-center text-[#5c4037] px-5 py-2 hover:opacity-80 active:scale-90 duration-150">
          <span className="material-symbols-outlined">history</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Historial</span>
        </Link>
        <Link to="/users" className="flex flex-col items-center bg-[#fbdcd3] text-[#a63500] rounded-2xl px-5 py-2 active:scale-90 duration-150">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Usuarios</span>
        </Link>
      </nav>
    </div>
  )
}
