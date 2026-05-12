import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { setToken } from '../auth/token'
import { login } from '../services/api'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.trim().length > 0 && status !== 'validating',
    [password, status, username],
  )

  const submit = async () => {
    const safeUsername = username.trim()
    const safePassword = password.trim()
    if (!safeUsername || !safePassword) return
    setStatus('validating')
    setMessage(null)
    try {
      const tokenResponse = await login({ username: safeUsername, password: safePassword })
      setToken(tokenResponse.access_token)
      navigate('/')
    } catch {
      setStatus('error')
      setMessage('Invalid username or password.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="page">
      <div className="card">
        <img className="hersheys-logo-login" src="/hersheys-logo.svg" alt="Logo Hershey's" />
        <h1 className="title">Dashboard</h1>
        <p className="subtitle">Sign in with your username and password</p>

        <label className="label">
          Username
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="username"
          />
        </label>

        <label className="label">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="password"
          />
        </label>

        <button className="btn" type="button" disabled={!canSubmit} onClick={() => void submit()}>
          Sign in
        </button>

        {message ? <div className="error">{message}</div> : null}
      </div>
    </div>
  )
}
