import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { clearToken, getToken } from '../auth/token'
import { FiltersBar } from '../components/Filters/FiltersBar'
import { SearchBar } from '../components/Search/SearchBar'
import { isWithinLocalDateRange, matchesStatus } from '../features/filters'
import { matchesQuery } from '../features/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { listResults, type ResultItem } from '../services/api'

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const token = useMemo(() => getToken(), [])
  const [items, setItems] = useState<ResultItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [baselineReady, setBaselineReady] = useState(false)
  const [lastSeenTotal, setLastSeenTotal] = useState(0)
  const [lastSeenLatestId, setLastSeenLatestId] = useState<string | null>(null)
  const [hasNewResults, setHasNewResults] = useState(false)
  const query = searchParams.get('q') ?? ''
  const statusFilter = searchParams.get('status') ?? 'all'
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const debouncedQuery = useDebouncedValue(query, 500)
  const filteredItems = useMemo(
    () =>
      items.filter(
        (i) =>
          matchesQuery({ id: i.id, image_id: i.image_id, status: i.status }, debouncedQuery) &&
          matchesStatus(i.status, statusFilter) &&
          isWithinLocalDateRange(i.processed_at ?? null, from, to),
      ),
    [debouncedQuery, from, items, statusFilter, to],
  )

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    let cancelled = false
    const run = async (params: { resetNewResults: boolean }) => {
      setStatus('loading')
      try {
        const res = await listResults({ token, page: 1, limit: 10 })
        if (cancelled) return
        setItems(res.items)
        setBaselineReady(true)
        setLastSeenTotal(res.total)
        setLastSeenLatestId(res.items[0]?.id ?? null)
        if (params.resetNewResults) {
          setHasNewResults(false)
        }
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }
    void run({ resetNewResults: true })
    return () => {
      cancelled = true
    }
  }, [navigate, token])

  useEffect(() => {
    if (!token || !baselineReady) return

    let cancelled = false
    const interval = setInterval(() => {
      const run = async () => {
        try {
          const res = await listResults({ token, page: 1, limit: 1 })
          if (cancelled) return
          const latestId = res.items[0]?.id ?? null
          if (!latestId) return

          if (res.total > lastSeenTotal || latestId !== lastSeenLatestId) {
            setHasNewResults(true)
          }
        } catch {
          return
        }
      }
      void run()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [baselineReady, lastSeenLatestId, lastSeenTotal, token])

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const v = value.trim()
        if (!v) {
          p.delete(key)
          return p
        }
        p.set(key, v)
        return p
      },
      { replace: true },
    )
  }

  const setStatusParam = (value: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (value === 'all') {
          p.delete('status')
          return p
        }
        p.set('status', value)
        return p
      },
      { replace: true },
    )
  }

  const logout = () => {
    clearToken()
    navigate('/login')
  }

  const refresh = async () => {
    if (!token) return
    setStatus('loading')
    try {
      const res = await listResults({ token, page: 1, limit: 10 })
      setItems(res.items)
      setBaselineReady(true)
      setLastSeenTotal(res.total)
      setLastSeenLatestId(res.items[0]?.id ?? null)
      setHasNewResults(false)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-title">
          Hershey's CV Dashboard
          {hasNewResults ? <span className="notif-dot" aria-label="Nuevos resultados disponibles" /> : null}
        </div>
        <div className="dash-actions">
          {hasNewResults ? (
            <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
              Actualizar
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel">
          <div className="panel-title">Resultados recientes</div>
          <SearchBar query={query} onQueryChange={(v) => setParam('q', v)} />
          <FiltersBar
            status={statusFilter}
            from={from}
            to={to}
            onStatusChange={setStatusParam}
            onFromChange={(v) => setParam('from', v)}
            onToChange={(v) => setParam('to', v)}
          />

          {status === 'loading' ? (
            <div className="skeleton-list">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="skeleton-row" />
              ))}
            </div>
          ) : null}

          {status === 'error' ? <div className="error">No se pudieron cargar resultados.</div> : null}

          {status === 'ready' ? (
            items.length ? (
              <div className="table">
                <div className="table-head">
                  <div>ID</div>
                  <div>Image</div>
                  <div>Status</div>
                </div>
                {filteredItems.length ? (
                  filteredItems.map((r) => (
                    <div key={r.id} className="table-row">
                      <Link className="mono link" to={`/results/${r.id}${location.search}`}>
                        {r.id}
                      </Link>
                      <div className="mono">{r.image_id}</div>
                      <div className="pill">{r.status}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty">No hay resultados para esa búsqueda.</div>
                )}
              </div>
            ) : (
              <div className="empty">No hay resultados.</div>
            )
          ) : null}
        </section>
      </main>
    </div>
  )
}
