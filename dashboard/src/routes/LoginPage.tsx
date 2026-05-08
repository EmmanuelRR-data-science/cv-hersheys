import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { setToken } from '../auth/token'
import { getMe } from '../services/api'

export function LoginPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const canSubmit = useMemo(() => tokenInput.trim().length > 0 && status !== 'validating', [tokenInput, status])

  const submit = async () => {
    const token = tokenInput.trim()
    if (!token) return
    setStatus('validating')
    setMessage(null)
    try {
      await getMe({ token })
      setToken(token)
      navigate('/')
    } catch {
      setStatus('error')
      setMessage('Token inválido o expirado.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="page">
      <div className="card">
        <img className="hersheys-logo-login" src="/hersheys-logo.svg" alt="Logo Hershey's" />
        <h1 className="title">Dashboard</h1>
        <p className="subtitle">Pega un token JWT para iniciar sesión</p>

        <label className="label">
          Token
          <textarea
            className="input"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            rows={5}
            placeholder="Bearer ..."
          />
        </label>

        <button className="btn" type="button" disabled={!canSubmit} onClick={() => void submit()}>
          Entrar
        </button>

        {message ? <div className="error">{message}</div> : null}
      </div>
    </div>
  )
}
