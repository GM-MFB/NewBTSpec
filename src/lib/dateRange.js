export function isWithinDateRange(dateStr, startDate, endDate) {
  if (!startDate && !endDate) return true
  if (!dateStr) return false
  if (startDate && dateStr < startDate) return false
  if (endDate && dateStr > endDate) return false
  return true
}
