import { useState } from 'react'
import './ScreenerTab.css'
import { FILTER_GROUPS } from '../../lib/finvizFilters'
import { buildFinvizUrl } from '../../lib/finvizUrl'
import { useScreenerSaves } from '../../hooks/useScreenerSaves'

export default function ScreenerTab({ accountId, userId }) {
  const [filters, setFilters] = useState({})
  const { saves, savePreset, deletePreset } = useScreenerSaves(accountId, userId)
  const [presetName, setPresetName] = useState('')

  const url = buildFinvizUrl(filters)

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!presetName.trim()) return
    await savePreset(presetName.trim(), filters)
    setPresetName('')
  }

  function applyPreset(preset) {
    setFilters(preset.filters ?? {})
  }

  return (
    <div className="screener-tab">
      <div className="screener-filter-grid">
        {FILTER_GROUPS.map((group) => (
          <label key={group.key} htmlFor={`screener-${group.key}`}>
            {group.label}
            <select
              id={`screener-${group.key}`}
              value={filters[group.key] ?? ''}
              onChange={(e) => setFilter(group.key, e.target.value)}
            >
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="screener-url-bar">
        <span className="screener-url mono">{url}</span>
        <button type="button" onClick={() => navigator.clipboard.writeText(url)}>Copy URL</button>
        <a href={url} target="_blank" rel="noreferrer">Open in Finviz ↗</a>
      </div>

      <section className="screener-presets">
        <h2>Saved Presets</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
          <label htmlFor="screenerPresetName">Preset name</label>
          <input
            id="screenerPresetName"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button type="submit">Save</button>
        </form>

        <ul className="screener-preset-list">
          {saves.map((preset) => (
            <li key={preset.id}>
              <span>{preset.name}</span>
              <button type="button" onClick={() => applyPreset(preset)}>Apply</button>
              <button type="button" onClick={() => deletePreset(preset.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
