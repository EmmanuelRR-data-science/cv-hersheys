import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { CameraCapture } from './CameraCapture'

describe('CameraCapture', () => {
  test('shows an error when camera permission is denied', async () => {
    const getUserMedia = vi.fn(async () => {
      throw new Error('denied')
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })

    render(<CameraCapture onCaptured={() => undefined} />)

    await waitFor(() => {
      expect(screen.getByText(/Permiso de cámara/i)).toBeInTheDocument()
    })
  })
})

