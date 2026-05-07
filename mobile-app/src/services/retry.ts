export type RetryOptions = {
  maxRetries: number
  delayMs?: number
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const delayMs = options.delayMs ?? 0
  const maxRetries = Math.max(options.maxRetries, 1)

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error
      }
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error('unreachable')
}

