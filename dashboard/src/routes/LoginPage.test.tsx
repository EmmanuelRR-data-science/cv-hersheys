import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoginPage } from './LoginPage'

vi.mock('../services/api', () => {
  return {
    getMe: vi.fn(async () => ({ username: 'hersheys', role: 'analyst' })),
  }
})

describe('LoginPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  test('stores token after validation', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText(/token/i)
    await user.type(input, 'token-123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(localStorage.getItem('hersheys_cv_dashboard_token')).toBe('token-123')
  })
})

