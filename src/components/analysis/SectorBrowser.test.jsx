import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SectorBrowser from './SectorBrowser'
import { SECTORS } from '../../lib/sectorStocks'

describe('SectorBrowser', () => {
  it('renders a section for each sector', () => {
    render(<SectorBrowser onAddToCompare={vi.fn()} />)
    expect(screen.getByText(SECTORS[0].name)).toBeInTheDocument()
  })

  it('adds checked symbols to compare and clears selection', async () => {
    const onAddToCompare = vi.fn()
    render(<SectorBrowser onAddToCompare={onAddToCompare} />)

    const firstSector = SECTORS[0]
    const firstStock = firstSector.stocks[0]
    const checkbox = screen.getByRole('checkbox', { name: new RegExp(firstStock.sym) })
    await userEvent.click(checkbox)

    await userEvent.click(screen.getByRole('button', { name: /add to compare/i }))

    expect(onAddToCompare).toHaveBeenCalledWith([firstStock.sym])
    expect(checkbox).not.toBeChecked()
  })

  it('disables Add to Compare when nothing is selected', () => {
    render(<SectorBrowser onAddToCompare={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add to compare/i })).toBeDisabled()
  })
})
