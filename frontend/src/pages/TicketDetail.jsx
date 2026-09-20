import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Paperclip, RefreshCw } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, PriorityBadge } from '../components/Badges'
import Avatar from '../components/Avatar'
import { ageLabel, formatDateTime, timeAgo } from '../utils/format'

const MANUAL_STATUSES = ['Assigned', 'In Progress', 'Waiting for User', 'Waiting for Vendor']

export default function TicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAgentLike = user.role === 'agent' || user.role === 'admin'
  const fileInputRef = useRef(null)

  const [ticket, setTicket] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [agents, setAgents] = useState([])
  const [categories, setCategories] = useState([])
  const [priorities, setPriorities] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [comment, setComment] = useState('')
  const [replyTab, setReplyTab] = useState('public')
  const [pendingWaiting, setPendingWaiting] = useState(null)
  const [waitingReason, setWaitingReason] = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolutionText, setResolutionText] = useState('')
  const [showReopenForm, setShowReopenForm] = useState(false)
  const [reopenReason, setReopenReason] = useState('')

  function load() {
    api
      .get(`/tickets/${id}`)
      .then((res) => setTicket(res.data))
      .catch((err) => setLoadError(err.response?.data?.detail || 'Could not load this ticket.'))
  }

  useEffect(() => {
    load()
    if (isAgentLike) {
      api.get('/users', { params: { role: 'agent' } }).then((res) => setAgents(res.data))
      api.get('/categories').then((res) => setCategories(res.data))
      api.get('/priorities').then((res) => setPriorities(res.data))
    }
  }, [id])

  async function runAction(fn) {
    setError('')
    setBusy(true)
    try {
      await fn()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadAttachment(attachment) {
    setError('')
    try {
      const res = await api.get(`/tickets/${id}/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Could not download this attachment.')
    }
  }

  function handleAttachClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    runAction(async () => {
      const form = new FormData()
      form.append('file', file)
      await api.post(`/tickets/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    })
  }

  function handleStatusSelect(status) {
    if (status === ticket.status) return
    if (status === 'Waiting for User' || status === 'Waiting for Vendor') {
      setPendingWaiting(status)
      setWaitingReason('')
      return
    }
    runAction(() => api.patch(`/tickets/${id}/status`, { status }))
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="card p-6 text-sm font-medium text-rose-600">{loadError}</div>
      </div>
    )
  }

  if (!ticket) return <p className="text-sm text-gray-500">Loading...</p>

  const isOwner = ticket.requester.id === user.id
  const canReopen = (isOwner || isAgentLike) && ['Resolved', 'Closed'].includes(ticket.status)
  const canResolve = isAgentLike && !['Resolved', 'Closed'].includes(ticket.status)
  const canClose = isAgentLike && ticket.status === 'Resolved'
  const locked = ['Resolved', 'Closed'].includes(ticket.status)

  const timeline = [
    ...ticket.comments.map((c) => ({ type: 'comment', at: c.created_at, data: c })),
    ...ticket.history.map((h) => ({ type: 'history', at: h.changed_at, data: h })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </button>
        <span className="text-sm text-gray-400">Age {ageLabel(ticket.reported_at)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-gray-400">{ticket.ticket_number}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">{ticket.issue}</h1>

      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card bg-gray-50/70 p-5">
            <h3 className="field-label">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{ticket.description}</p>
            {ticket.contact_info && (
              <p className="mt-2 text-xs text-gray-500">Location / contact: {ticket.contact_info}</p>
            )}
            {ticket.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.attachments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => downloadAttachment(a)}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Paperclip size={13} />
                    {a.filename}
                  </button>
                ))}
              </div>
            )}
          </div>

          {ticket.waiting_reason && (
            <div className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-700">
              <span className="font-semibold">Waiting reason:</span> {ticket.waiting_reason}
            </div>
          )}

          {ticket.resolution_summary && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold">Resolution</p>
              <p className="mt-0.5 whitespace-pre-wrap">{ticket.resolution_summary}</p>
            </div>
          )}

          <div className="card p-5">
            <div className="space-y-4">
              {timeline.length === 0 && (
                <p className="text-sm text-gray-400">No activity yet.</p>
              )}
              {timeline.map((item) =>
                item.type === 'comment' ? (
                  <div key={`c-${item.data.id}`} className="flex items-start gap-3">
                    <Avatar name={item.data.author.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{item.data.author.name}</span>
                        <span className="text-xs text-gray-400">{timeAgo(item.data.created_at)}</span>
                      </div>
                      {item.data.is_internal ? (
                        <div className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                            <Lock size={11} /> Internal note, not visible to requester
                          </p>
                          <p className="whitespace-pre-wrap">{item.data.comment_text}</p>
                        </div>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{item.data.comment_text}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={`h-${item.data.id}`} className="flex items-center gap-2 pl-1 text-xs text-gray-400">
                    <RefreshCw size={12} />
                    <span>
                      {item.data.changed_by.name} changed {item.data.field_changed.toLowerCase()}
                      {item.data.old_value ? ` from ${item.data.old_value}` : ''} to {item.data.new_value}
                    </span>
                    <span>· {timeAgo(item.data.changed_at)}</span>
                  </div>
                )
              )}
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              {isAgentLike && (
                <div className="mb-2 flex gap-4 border-b border-gray-100 text-sm font-medium">
                  <button
                    className={`-mb-px border-b-2 pb-2 ${
                      replyTab === 'public' ? 'border-ink-900 text-gray-900' : 'border-transparent text-gray-400'
                    }`}
                    onClick={() => setReplyTab('public')}
                  >
                    Public reply
                  </button>
                  <button
                    className={`-mb-px border-b-2 pb-2 ${
                      replyTab === 'internal' ? 'border-ink-900 text-gray-900' : 'border-transparent text-gray-400'
                    }`}
                    onClick={() => setReplyTab('internal')}
                  >
                    Internal note
                  </button>
                </div>
              )}
              <textarea
                className="input"
                rows={2}
                placeholder={replyTab === 'internal' ? 'Write an internal note (IT only)...' : 'Write a reply to the requester'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAttachClick}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  <Paperclip size={13} /> Attach
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
                <button
                  disabled={busy || !comment.trim()}
                  className="btn btn-primary"
                  onClick={() =>
                    runAction(async () => {
                      await api.post(`/tickets/${id}/comments`, {
                        comment_text: comment.trim(),
                        is_internal: replyTab === 'internal',
                      })
                      setComment('')
                    })
                  }
                >
                  Send reply
                </button>
              </div>
            </div>
          </div>

          {canReopen && !showReopenForm && (
            <div className="card flex items-center justify-between p-4">
              <p className="text-sm text-gray-600">Issue happening again, or resolution not working?</p>
              <button className="btn btn-secondary" onClick={() => setShowReopenForm(true)}>
                Reopen ticket
              </button>
            </div>
          )}
          {showReopenForm && (
            <div className="card p-4">
              <label className="field-label">Reason for reopening *</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Describe why this needs to be reopened"
                  autoFocus
                />
                <button
                  disabled={busy || !reopenReason.trim()}
                  className="btn btn-primary shrink-0"
                  onClick={() =>
                    runAction(async () => {
                      await api.post(`/tickets/${id}/reopen`, { reason: reopenReason.trim() })
                      setShowReopenForm(false)
                      setReopenReason('')
                    })
                  }
                >
                  Reopen
                </button>
                <button className="btn btn-secondary shrink-0" onClick={() => setShowReopenForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            {isAgentLike ? (
              <div className="space-y-4">
                <div>
                  <label className="field-label">Status</label>
                  <select
                    className="input"
                    value={MANUAL_STATUSES.includes(ticket.status) ? ticket.status : ''}
                    disabled={locked || !ticket.assignee || busy}
                    onChange={(e) => handleStatusSelect(e.target.value)}
                  >
                    {!MANUAL_STATUSES.includes(ticket.status) && (
                      <option value="">{ticket.status}</option>
                    )}
                    {MANUAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {!ticket.assignee && (
                    <p className="mt-1 text-xs text-gray-400">Assign an agent to change status.</p>
                  )}
                  {pendingWaiting && (
                    <div className="mt-2 rounded-lg border border-gray-200 p-3">
                      <label className="field-label">Reason for {pendingWaiting}</label>
                      <input
                        className="input"
                        value={waitingReason}
                        onChange={(e) => setWaitingReason(e.target.value)}
                        placeholder="e.g. Awaiting manager approval"
                        autoFocus
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button className="btn btn-secondary !py-1 text-xs" onClick={() => setPendingWaiting(null)}>
                          Cancel
                        </button>
                        <button
                          disabled={busy}
                          className="btn btn-primary !py-1 text-xs"
                          onClick={() =>
                            runAction(async () => {
                              await api.patch(`/tickets/${id}/status`, {
                                status: pendingWaiting,
                                waiting_reason: waitingReason.trim(),
                              })
                              setPendingWaiting(null)
                            })
                          }
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="field-label">Priority</label>
                  <select
                    className="input"
                    value={ticket.priority.id}
                    disabled={locked || busy}
                    onChange={(e) =>
                      runAction(() => api.patch(`/tickets/${id}/priority`, { priority_id: Number(e.target.value) }))
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Category</label>
                  <select
                    className="input"
                    value={ticket.category?.id || ''}
                    disabled={locked || busy}
                    onChange={(e) =>
                      runAction(() =>
                        api.patch(`/tickets/${id}/category`, {
                          category_id: e.target.value ? Number(e.target.value) : null,
                        })
                      )
                    }
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Assignee</label>
                  <select
                    className="input"
                    value={ticket.assignee?.id || ''}
                    disabled={locked || busy}
                    onChange={(e) =>
                      runAction(() => api.patch(`/tickets/${id}/assign`, { assigned_to_id: Number(e.target.value) }))
                    }
                  >
                    <option value="" disabled>
                      Unassigned
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <SidebarInfo label="Status"><StatusBadge status={ticket.status} /></SidebarInfo>
                <SidebarInfo label="Priority"><PriorityBadge priority={ticket.priority} /></SidebarInfo>
                <SidebarInfo label="Category" value={ticket.category?.name || 'Uncategorized'} />
                <SidebarInfo label="Assignee" value={ticket.assignee?.name || 'Unassigned'} />
              </div>
            )}

            <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
              <p className="font-semibold text-gray-900">{ticket.requester.name}</p>
              <p className="text-gray-500">
                {ticket.department}
                {ticket.contact_info ? `, ${ticket.contact_info}` : ''}
              </p>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <p>Reported {formatDateTime(ticket.reported_at)}</p>
              {ticket.allocated_at && <p>Allocated {formatDateTime(ticket.allocated_at)}</p>}
              {ticket.resolved_at && <p>Resolved {formatDateTime(ticket.resolved_at)}</p>}
              {ticket.closed_at && <p>Closed {formatDateTime(ticket.closed_at)}</p>}
            </div>

            {isAgentLike && (canResolve || canClose) && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                {canResolve && !showResolveForm && (
                  <button
                    className="btn btn-primary w-full"
                    disabled={!ticket.assignee}
                    title={!ticket.assignee ? 'Assign this ticket before resolving it' : undefined}
                    onClick={() => setShowResolveForm(true)}
                  >
                    Resolve ticket
                  </button>
                )}
                {canClose && (
                  <button
                    disabled={busy}
                    className="btn btn-primary w-full"
                    onClick={() => runAction(() => api.post(`/tickets/${id}/close`))}
                  >
                    Close ticket
                  </button>
                )}
                {showResolveForm && (
                  <div className="space-y-2">
                    <label className="field-label">Resolution summary *</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="What was done to fix the issue..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn btn-secondary !py-1 text-xs"
                        onClick={() => {
                          setShowResolveForm(false)
                          setResolutionText('')
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={busy || !resolutionText.trim()}
                        className="btn btn-primary !py-1 text-xs"
                        onClick={() =>
                          runAction(async () => {
                            await api.post(`/tickets/${id}/resolve`, { resolution_summary: resolutionText.trim() })
                            setShowResolveForm(false)
                            setResolutionText('')
                          })
                        }
                      >
                        Confirm resolved
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarInfo({ label, value, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {children || <span className="font-medium text-gray-800">{value}</span>}
    </div>
  )
}
