import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoginPage } from './LoginPage'

vi.mock('../services/api', () => {
  return {
    login: vi.fn(async () => ({ access_token: 'token-123', token_type: 'bearer' })),
  }
})

describe('LoginPage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  test('stores token after username and password login', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    await user.clear(usernameInput)
    await user.type(usernameInput, 'hersheys')
    await user.clear(passwordInput)
    await user.type(passwordInput, 'cv-hersheys')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(localStorage.getItem('hersheys_cv_dashboard_token')).toBe('token-123')
  })
})

