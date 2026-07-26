function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + firstThursdayDayNum) / 7)
  return { year: d.getUTCFullYear(), week }
}

export function currentWeekValue() {
  const { year, week } = getISOWeek(new Date())
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function weekRangeFromValue(value) {
  const [yearStr, weekStr] = value.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dayOfWeek = simple.getUTCDay()
  const start = new Date(simple)
  if (dayOfWeek <= 4) {
    start.setUTCDate(simple.getUTCDate() - dayOfWeek + 1)
  } else {
    start.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek)
  }
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)

  return { start, end }
}

export function isDateInRange(dateStr, start, end) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d >= start && d.getTime() <= end.getTime() + 86399999
}
