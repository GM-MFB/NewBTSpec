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

  it('calls onSendToFrontier with the selected symbols and clears the selection', async () => {
    const onSendToFrontier = vi.fn()
    render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={onSendToFrontier} onSendToOptimizer={vi.fn()} />)

    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(firstCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /send to frontier/i }))

    expect(onSendToFrontier).toHaveBeenCalledTimes(1)
    expect(onSendToFrontier.mock.calls[0][0]).toHaveLength(1)
    expect(firstCheckbox).not.toBeChecked()
  })

  it('calls onSendToOptimizer with the selected symbols and clears the selection', async () => {
    const onSendToOptimizer = vi.fn()
    render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={vi.fn()} onSendToOptimizer={onSendToOptimizer} />)

    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(firstCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /send to optimizer/i }))

    expect(onSendToOptimizer).toHaveBeenCalledTimes(1)
    expect(onSendToOptimizer.mock.calls[0][0]).toHaveLength(1)
  })

  it('disables the send buttons when nothing is selected', () => {
    render(<SectorBrowser onAddToCompare={vi.fn()} onSendToFrontier={vi.fn()} onSendToOptimizer={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send to frontier/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /send to optimizer/i })).toBeDisabled()
  })
})
