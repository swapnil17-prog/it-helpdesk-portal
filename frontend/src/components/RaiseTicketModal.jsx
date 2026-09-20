import { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export default function RaiseTicketModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [priorities, setPriorities] = useState([])
  const [issue, setIssue] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [location, setLocation] = useState('')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/priorities')]).then(([cats, pris]) => {
      setCategories(cats.data)
      setPriorities(pris.data)
      const medium = pris.data.find((p) => p.name === 'Medium')
      setPriorityId(String((medium || pris.data[0])?.id || ''))
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!issue.trim() || !description.trim() || !priorityId) {
      setError('Please fill in Issue, Description and Priority.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/tickets', {
        issue: issue.trim(),
        description: description.trim(),
        priority_id: Number(priorityId),
        category_id: categoryId ? Number(categoryId) : null,
        contact_info: location.trim() || null,
      })
      if (file) {
        const form = new FormData()
        form.append('file', file)
        await api.post(`/tickets/${res.data.id}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Raise an IT ticket</h2>
            <p className="text-xs text-gray-500">Tell us what's wrong and we'll route it to the IT team.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar name={user.name} size={26} />
              <div className="text-right text-xs leading-tight">
                <p className="font-semibold text-gray-800">{user.name}</p>
                <p className="text-gray-400">{user.department}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Issue</label>
            <input
              className="input"
              placeholder="e.g. MS Teams not opening"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              maxLength={120}
              autoFocus
            />
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="What happened, any error message, and how it affects your work"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Priority</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {priorities.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriorityId(String(p.id))}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                    String(p.id) === priorityId ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="flex items-center gap-1.5 text-xs font-bold"
                    style={{ color: String(p.id) === priorityId ? undefined : p.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="text-[11px] leading-tight text-gray-500">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">
                Category <span className="font-normal text-gray-400">optional</span>
              </label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">
                Location <span className="font-normal text-gray-400">optional</span>
              </label>
              <input
                className="input"
                placeholder="e.g. Floor 3, desk 14"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-6 text-center transition ${
                dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Upload size={18} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                {file ? file.name : 'Drop a screenshot here or browse'}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Submitting...' : 'Submit ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
