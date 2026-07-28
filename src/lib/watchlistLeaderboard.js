export function buildLeaderboard(entries) {
  const bySymbol = new Map()

  for (const entry of entries) {
    if (!bySymbol.has(entry.symbol)) {
      bySymbol.set(entry.symbol, { symbol: entry.symbol, userIds: new Set(), people: [] })
    }
    const group = bySymbol.get(entry.symbol)
    if (!group.userIds.has(entry.userId)) {
      group.userIds.add(entry.userId)
      group.people.push(entry.displayName)
    }
  }

  return [...bySymbol.values()]
    .map((g) => ({ symbol: g.symbol, count: g.userIds.size, people: g.people }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol))
}
