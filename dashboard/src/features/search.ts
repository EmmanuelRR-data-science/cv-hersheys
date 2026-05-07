export type SearchableResult = {
  id: string
  image_id: string
  status: string
}

function normalize(input: string): string {
  return input.trim().toLowerCase()
}

export function matchesQuery(item: SearchableResult, query: string): boolean {
  const q = normalize(query)
  if (!q) return true

  return (
    normalize(item.id).includes(q) ||
    normalize(item.image_id).includes(q) ||
    normalize(item.status).includes(q)
  )
}

