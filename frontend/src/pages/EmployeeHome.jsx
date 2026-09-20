import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import PageHeader from '../components/PageHeader'
import RaiseTicketModal from '../components/RaiseTicketModal'
import { timeAgo } from '../utils/format'

export default function EmployeeHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [justCreated, setJustCreated] = useState(null)

  function loadTickets() {
    setLoading(true)
    api
      .get('/tickets')
      .then((res) => setTickets(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(loadTickets, [])

  const openCount = tickets.filter((t) => !['Resolved', 'Closed'].includes(t.status)).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${user.name.split(' ')[0]},`}
        subtitle={
          (openCount > 0
            ? `You have ${openCount} open ticket${openCount > 1 ? 's' : ''}. `
            : 'You have no open tickets right now. ') + 'Got an IT issue? Raise it in a few clicks.'
        }
        right={
          <button onClick={() => setShowModal(true)} className="btn btn-primary shrink-0">
            <Plus size={16} /> Raise IT Ticket
          </button>
        }
      />

      {justCreated && (
        <div className="card flex items-center justify-between border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Ticket <span className="font-bold">{justCreated.ticket_number}</span> submitted
            successfully. IT has been notified.
          </p>
          <button
            onClick={() => navigate(`/tickets/${justCreated.id}`)}
            className="btn btn-secondary !py-1.5 text-xs"
          >
            View ticket
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          My Tickets
        </h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : tickets.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-gray-500">
              You haven't raised any tickets yet. Click "Raise IT Ticket" to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="card flex w-full flex-col gap-2 p-4 text-left transition hover:border-brand-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{t.ticket_number}</span>
                    <p className="truncate text-sm font-semibold text-gray-800">{t.issue}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Reported {timeAgo(t.reported_at)}
                    {t.assignee ? ` · Assigned to ${t.assignee.name}` : ' · Awaiting assignment'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <RaiseTicketModal
          onClose={() => setShowModal(false)}
          onCreated={(ticket) => {
            setShowModal(false)
            setJustCreated(ticket)
            loadTickets()
          }}
        />
      )}
    </div>
  )
}
