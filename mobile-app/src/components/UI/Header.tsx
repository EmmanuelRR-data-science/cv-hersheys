export function Header(props: { title: string; subtitle?: string }) {
  return (
    <header className="ui-header">
      <div className="ui-header-title">{props.title}</div>
      {props.subtitle ? <div className="ui-header-subtitle">{props.subtitle}</div> : null}
    </header>
  )
}

