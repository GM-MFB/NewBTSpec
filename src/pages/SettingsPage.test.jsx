import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useUserSettings')

describe('SettingsPage', () => {
  it('shows the current Finnhub key once loaded', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: 'abc123', displayName: '', loading: false, saveFinnhubKey: vi.fn(), saveDisplayName: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText(/finnhub api key/i)).toHaveValue('abc123'))
  })

  it('shows the user id, read-only', () => {
    useAuth.mockReturnValue({ user: { id: 'u1-abc-123' } })
    useUserSettings.mockReturnValue({ finnhubKey: '', displayName: '', loading: false, saveFinnhubKey: vi.fn(), saveDisplayName: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByText('u1-abc-123')).toBeInTheDocument()
  })

  it('shows the current display name once loaded', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    useUserSettings.mockReturnValue({ finnhubKey: '', displayName: 'Matt', loading: false, saveFinnhubKey: vi.fn(), saveDisplayName: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText(/display name/i)).toHaveValue('Matt'))
  })

  it('calls saveDisplayName with the entered value on submit', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    const saveDisplayName = vi.fn().mockResolvedValue(undefined)
    useUserSettings.mockReturnValue({ finnhubKey: '', displayName: '', loading: false, saveFinnhubKey: vi.fn(), saveDisplayName })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/display name/i), 'New Name')
    await userEvent.click(screen.getByRole('button', { name: /save display name/i }))

    expect(saveDisplayName).toHaveBeenCalledWith('New Name')
  })

  it('calls saveFinnhubKey with the entered value on submit', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    const saveFinnhubKey = vi.fn().mockResolvedValue(undefined)
    useUserSettings.mockReturnValue({ finnhubKey: '', displayName: '', loading: false, saveFinnhubKey, saveDisplayName: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/finnhub api key/i), 'new-key')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(saveFinnhubKey).toHaveBeenCalledWith('new-key')
    expect(await screen.findByText(/saved/i)).toBeInTheDocument()
  })

  it('shows an inline error when saveFinnhubKey rejects', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    const saveFinnhubKey = vi.fn().mockRejectedValue(new Error('save failed'))
    useUserSettings.mockReturnValue({ finnhubKey: '', displayName: '', loading: false, saveFinnhubKey, saveDisplayName: vi.fn() })

    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await userEvent.type(screen.getByLabelText(/finnhub api key/i), 'new-key')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })
})
