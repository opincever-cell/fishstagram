export function timeAgo(timestamp) {
  const now = new Date()
  const posted = new Date(timestamp)
  const seconds = Math.floor((now - posted) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 5) return `${minutes} minutes ago`
  if (minutes < 10) return '5 minutes ago'
  if (minutes < 20) return '10 minutes ago'
  if (minutes < 30) return '20 minutes ago'
  if (minutes < 60) return '30 minutes ago'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
