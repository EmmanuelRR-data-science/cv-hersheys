type Props = {
  status: string
  from: string
  to: string
  onStatusChange: (value: string) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export function FiltersBar(props: Props) {
  return (
    <div className="filtersbar">
      <label className="filters-label">
        Estado
        <select
          className="filters-input"
          aria-label="Estado"
          value={props.status}
          onChange={(e) => props.onStatusChange(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="processed">processed</option>
          <option value="processing_failed">processing_failed</option>
        </select>
      </label>

      <label className="filters-label">
        Desde
        <input
          className="filters-input"
          aria-label="Desde"
          type="date"
          value={props.from}
          onChange={(e) => props.onFromChange(e.target.value)}
        />
      </label>

      <label className="filters-label">
        Hasta
        <input
          className="filters-input"
          aria-label="Hasta"
          type="date"
          value={props.to}
          onChange={(e) => props.onToChange(e.target.value)}
        />
      </label>
    </div>
  )
}

