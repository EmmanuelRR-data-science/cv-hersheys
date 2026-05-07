import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import { HealthPage } from './HealthPage'

describe('HealthPage', () => {
  test('renders ok JSON', () => {
    render(
      <MemoryRouter initialEntries={['/health']}>
        <Routes>
          <Route path="/health" element={<HealthPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/\{.*"status":\s*"ok".*\}/i)).toBeInTheDocument()
  })
})

