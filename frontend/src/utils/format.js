export function timeAgo(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z')
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

export function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z')
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ageInDays(isoString) {
  if (!isoString) return 0
  const date = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z')
  return (Date.now() - date.getTime()) / 86400000
}

export function ageLabel(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z')
  const totalMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m`
}
