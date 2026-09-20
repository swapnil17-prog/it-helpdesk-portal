import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { StatusBadge, PriorityDot } from '../components/Badges'
import { ageInDays, ageLabel } from '../utils/format'

function ageColorClass(reportedAt) {
  const days = ageInDays(reportedAt)
  if (days > 5) return 'text-rose-600 font-medium'
  if (days >= 3) return 'text-amber-600 font-medium'
  return 'text-gray-500'
}

export default function ITQueue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  function load() {
    setLoading(true)
    api
      .get('/tickets')
      .then((res) => setTickets(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const isOpen = (t) => !['Resolved', 'Closed'].includes(t.status)
  const isCriticalOrHigh = (t) => t.priority.level >= 3

  const tabs = useMemo(
    () => [
      { key: 'all', label: 'All', count: tickets.filter(isOpen).length },
      { key: 'unassigned', label: 'Unassigned', count: tickets.filter((t) => isOpen(t) && !t.assignee).length },
      { key: 'mine', label: 'Mine', count: tickets.filter((t) => isOpen(t) && t.assignee?.id === user.id).length },
      {
        key: 'urgent',
        label: 'Critical and high',
        count: tickets.filter((t) => isOpen(t) && isCriticalOrHigh(t)).length,
      },
      {
        key: 'waiting',
        label: 'Waiting',
        count: tickets.filter((t) => t.status === 'Waiting for User' || t.status === 'Waiting for Vendor').length,
      },
      { key: 'resolved', label: 'Resolved', count: tickets.filter((t) => t.status === 'Resolved').length },
      { key: 'closed', label: 'Closed', count: tickets.filter((t) => t.status === 'Closed').length },
    ],
    [tickets, user.id]
  )

  const filtered = useMemo(() => {
    let list = tickets
    if (tab === 'all') list = list.filter(isOpen)
    if (tab === 'unassigned') list = list.filter((t) => isOpen(t) && !t.assignee)
    if (tab === 'mine') list = list.filter((t) => isOpen(t) && t.assignee?.id === user.id)
    if (tab === 'urgent') list = list.filter((t) => isOpen(t) && isCriticalOrHigh(t))
    if (tab === 'waiting')
      list = list.filter((t) => t.status === 'Waiting for User' || t.status === 'Waiting for Vendor')
    if (tab === 'resolved') list = list.filter((t) => t.status === 'Resolved')
    if (tab === 'closed') list = list.filter((t) => t.status === 'Closed')

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.ticket_number.toLowerCase().includes(q) ||
          t.issue.toLowerCase().includes(q) ||
          t.requester.name.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q)
      )
    }
    return list
  }, [tickets, tab, search, user.id])

  async function claim(ticketId) {
    setBusyId(ticketId)
    try {
      await api.patch(`/tickets/${ticketId}/assign`, { assigned_to_id: user.id })
      load()
    } finally {
      setBusyId(null)
    }
  }

  const openCount = tickets.filter(isOpen).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="IT Queue"
        subtitle={`${openCount} open ticket${openCount === 1 ? '' : 's'}`}
        right={
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input w-64 pl-9"
              placeholder="Search ID, name, issue"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pill-tab ${tab === t.key ? 'active' : ''}`}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">No tickets in this view.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const urgent = isOpen(t) && !t.assignee && isCriticalOrHigh(t)
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className={`cursor-pointer border-b border-gray-50 border-l-4 last:border-b-0 ${
                      urgent ? 'border-l-rose-500 bg-rose-50/60 hover:bg-rose-50' : 'border-l-transparent hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.issue}</p>
                      <p className="font-mono text-xs text-gray-400">{t.ticket_number}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.requester.name}
                      <p className="text-xs text-gray-400">{t.department}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityDot priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.assignee?.name || '—'}</td>
                    <td className={`px-4 py-3 ${ageColorClass(t.reported_at)}`}>{ageLabel(t.reported_at)}</td>
                    <td className="px-4 py-3">
                      {!t.assignee && (
                        <button
                          disabled={busyId === t.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            claim(t.id)
                          }}
                          className="btn btn-secondary !py-1 text-xs"
                        >
                          Take it
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
