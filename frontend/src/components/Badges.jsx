const STATUS_STYLES = {
  New: 'bg-blue-50 text-blue-700 ring-blue-200',
  Assigned: 'bg-purple-50 text-purple-700 ring-purple-200',
  'In Progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Waiting for User': 'bg-gray-100 text-gray-600 ring-gray-300',
  'Waiting for Vendor': 'bg-gray-100 text-gray-600 ring-gray-300',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Closed: 'bg-gray-100 text-gray-500 ring-gray-300',
  Reopened: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 ring-gray-300'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  if (!priority) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
      style={{
        backgroundColor: `${priority.color}14`,
        color: priority.color,
        borderColor: `${priority.color}33`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
      {priority.name}
    </span>
  )
}

export function PriorityDot({ priority }) {
  if (!priority) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: priority.color }}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priority.color }} />
      {priority.name}
    </span>
  )
}

const ROLE_LABELS = {
  employee: 'Employee',
  agent: 'IT Agent',
  admin: 'IT Admin',
  management: 'Management',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

export function RoleBadge({ role }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
      {roleLabel(role)}
    </span>
  )
}
