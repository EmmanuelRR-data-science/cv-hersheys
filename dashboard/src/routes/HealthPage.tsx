export function HealthPage() {
  return (
    <main className="page">
      <pre className="mono">{JSON.stringify({ status: 'ok' })}</pre>
    </main>
  )
}

