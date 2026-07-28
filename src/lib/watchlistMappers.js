export function fromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    symbol: row.symbol,
    note: row.note,
    createdAt: row.created_at,
  }
}

export function toRow(entry) {
  return {
    user_id: entry.userId,
    display_name: entry.displayName,
    symbol: entry.symbol.toUpperCase(),
    note: entry.note || null,
    rank: 0,
  }
}
