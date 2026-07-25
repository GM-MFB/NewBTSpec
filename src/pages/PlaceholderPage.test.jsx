import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlaceholderPage from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('shows the given title and a coming soon message', () => {
    render(<MemoryRouter><PlaceholderPage title="Stats" /></MemoryRouter>)
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('links back to Home', () => {
    render(<MemoryRouter><PlaceholderPage title="Analyze" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })
})
