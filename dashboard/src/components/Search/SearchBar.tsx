type Props = {
  query: string
  onQueryChange: (query: string) => void
}

export function SearchBar(props: Props) {
  return (
    <div className="searchbar">
      <input
        className="searchbar-input"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        placeholder="Buscar por ID, ImageID o Status"
        aria-label="Buscar"
      />
    </div>
  )
}

