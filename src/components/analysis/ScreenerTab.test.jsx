import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScreenerTab from './ScreenerTab'
import { supabase } from '../../utils/supabase'

vi.mock('../../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockScreenerFrom({ ownSaves = [], defaultSaves = [] } = {}) {
  let selectCallCount = 0
  return vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: () => {
          selectCallCount += 1
          return Promise.resolve({ data: selectCallCount === 1 ? ownSaves : defaultSaves, error: null })
        },
      }),
    }),
    insert: (row) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'new1', ...row }, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }))
}

describe('ScreenerTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.from.mockImplementation(mockScreenerFrom())
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('renders a select for each filter group', () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    expect(screen.getByLabelText(/^price$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^market cap$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^sector$/i)).toBeInTheDocument()
  })

  it('shows the bare Finviz URL with no filters selected', () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    expect(screen.getByText('https://finviz.com/screener.ashx')).toBeInTheDocument()
  })

  it('updates the displayed URL when a filter is selected', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    expect(screen.getByText('https://finviz.com/screener.ashx?f=sh_price_u10')).toBeInTheDocument()
  })

  it('copies the current URL when Copy URL is clicked', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    await userEvent.click(screen.getByRole('button', { name: /copy url/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://finviz.com/screener.ashx?f=sh_price_u10')
  })

  it('the Open in Finviz link href matches the built URL', async () => {
    render(<ScreenerTab accountId="a1" userId="u1" />)
    await userEvent.selectOptions(screen.getByLabelText(/^price$/i), 'sh_price_u10')
    expect(screen.getByRole('link', { name: /open in finviz/i })).toHaveAttribute(
      'href',
      'https://finviz.com/screener.ashx?f=sh_price_u10',
    )
  })
})
