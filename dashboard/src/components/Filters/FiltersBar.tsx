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
        Status
        <select
          className="filters-input"
          aria-label="Status"
          value={props.status}
          onChange={(e) => props.onStatusChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="processed">processed</option>
          <option value="processing_failed">processing_failed</option>
        </select>
      </label>

      <label className="filters-label">
        From
        <input
          className="filters-input"
          aria-label="From"
          type="date"
          value={props.from}
          onChange={(e) => props.onFromChange(e.target.value)}
        />
      </label>

      <label className="filters-label">
        To
        <input
          className="filters-input"
          aria-label="To"
          type="date"
          value={props.to}
          onChange={(e) => props.onToChange(e.target.value)}
        />
      </label>
    </div>
  )
}

