export type PaginationModel = {
  total: number
  page: number
  limit: number
  pageCount: number
  hasPrev: boolean
  hasNext: boolean
  prevPage: number | null
  nextPage: number | null
  offset: number
  endExclusive: number
}

export function getPaginationModel(params: {
  total: number
  page: number
  limit: number
}): PaginationModel {
  const total = Math.max(0, Math.floor(params.total))
  const limit = Math.max(1, Math.floor(params.limit))
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const page = Math.min(Math.max(1, Math.floor(params.page)), pageCount)

  const hasPrev = page > 1
  const hasNext = page < pageCount
  const prevPage = hasPrev ? page - 1 : null
  const nextPage = hasNext ? page + 1 : null

  const offset = (page - 1) * limit
  const endExclusive = Math.min(offset + limit, total)

  return {
    total,
    page,
    limit,
    pageCount,
    hasPrev,
    hasNext,
    prevPage,
    nextPage,
    offset,
    endExclusive,
  }
}

