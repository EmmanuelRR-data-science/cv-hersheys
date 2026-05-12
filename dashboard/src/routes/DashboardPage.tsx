import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { clearToken, getToken } from '../auth/token'
import { FiltersBar } from '../components/Filters/FiltersBar'
import { SearchBar } from '../components/Search/SearchBar'
import { isWithinLocalDateRange, matchesStatus } from '../features/filters'
import { matchesQuery } from '../features/search'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { getImageFile, listResults, type ResultItem } from '../services/api'

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(date)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const token = useMemo(() => getToken(), [])
  const [items, setItems] = useState<ResultItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<Record<string, true>>({})
  const [baselineReady, setBaselineReady] = useState(false)
  const [lastSeenTotal, setLastSeenTotal] = useState(0)
  const [lastSeenLatestId, setLastSeenLatestId] = useState<string | null>(null)
  const [hasNewResults, setHasNewResults] = useState(false)
  const previewUrlsRef = useRef<Record<string, string>>({})
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
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url)
      }
      previewUrlsRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!token || items.length === 0) {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url)
      }
      previewUrlsRef.current = {}
      return
    }

    let cancelled = false
    const loadPreviews = async () => {
      const next: Record<string, string> = {}
      for (const item of items) {
        if (cancelled) return
        try {
          const blob = await getImageFile({ token, imageId: item.image_id })
          if (cancelled) return
          if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') continue
          if (blob.size < 100) {
            continue
          }
          next[item.id] = URL.createObjectURL(blob)
        } catch {
          continue
        }
      }
      if (cancelled) {
        for (const url of Object.values(next)) {
          URL.revokeObjectURL(url)
        }
        return
      }

      for (const url of Object.values(previewUrlsRef.current)) {
        if (!Object.values(next).includes(url)) {
          URL.revokeObjectURL(url)
        }
      }
      previewUrlsRef.current = next
      setPreviewUrls(next)
    }

    void loadPreviews()
    return () => {
      cancelled = true
    }
  }, [items, token])

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
          <img className="hersheys-logo-header" src="/hersheys-logo.svg" alt="Logo Hershey's" />
          <span>Hershey's CV Dashboard</span>
          {hasNewResults ? <span className="notif-dot" aria-label="New results available" /> : null}
        </div>
        <div className="dash-actions">
          {hasNewResults ? (
            <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
              Refresh
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <section className="panel">
          <div className="panel-title">Recent results</div>
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

          {status === 'error' ? <div className="error">Could not load results.</div> : null}

          {status === 'ready' ? (
            items.length ? (
              <div className="table">
                <div className="table-head">
                  <div>ID</div>
                  <div>Image ID</div>
                  <div>Preview</div>
                  <div>Status / Uploaded at</div>
                </div>
                {filteredItems.length ? (
                  filteredItems.map((r) => (
                    <div key={r.id} className="table-row">
                      <Link className="mono link" to={`/results/${r.id}${location.search}`}>
                        {r.id}
                      </Link>
                      <div className="mono">{r.image_id}</div>
                      <div>
                        {previewUrls[r.id] && !brokenPreviewIds[r.id] ? (
                          <img
                            className="thumb-preview"
                            src={previewUrls[r.id]}
                            alt={`Preview ${r.image_id}`}
                            onError={() => setBrokenPreviewIds((prev) => ({ ...prev, [r.id]: true }))}
                          />
                        ) : (
                          <div className="thumb-placeholder">No preview</div>
                        )}
                      </div>
                      <div>
                        <div className="pill">{r.status}</div>
                        <div className="mono">{formatDateTime(r.uploaded_at ?? r.processed_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">No results found for this search.</div>
                )}
              </div>
            ) : (
              <div className="empty">No results.</div>
            )
          ) : null}
        </section>
      </main>
    </div>
  )
}
