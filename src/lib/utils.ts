type ClassValue = string | number | boolean | null | undefined | ClassValue[]

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity as 20)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('el-GR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function getSnapshotAge(isoString: string): { minutes: number; isStale: boolean; label: string } {
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
  const isStale = minutes > 90
  const label = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
  return { minutes, isStale, label }
}

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function roleColor(role: string): string {
  const map: Record<string, string> = {
    operator:    '#00ffa3',
    picker:      '#3b82f6',
    packer:      '#f97316',
    validator:   '#a78bfa',
    sorter:      '#eab308',
    transporter: '#ec4899',
  }
  return map[role] ?? '#94a3b8'
}
