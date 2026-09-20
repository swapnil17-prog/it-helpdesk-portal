import { useEffect, useState } from 'react'
import api from '../api/client'
import { RoleBadge } from '../components/Badges'
import PageHeader from '../components/PageHeader'

const TABS = ['Categories', 'Priorities', 'Users']

export default function Admin() {
  const [tab, setTab] = useState('Categories')

  return (
    <div className="space-y-4">
      <PageHeader title="Admin" subtitle="Manage categories, priorities and IT users — no code changes required." />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pill-tab ${tab === t ? 'active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Categories' && <CategoriesPanel />}
      {tab === 'Priorities' && <PrioritiesPanel />}
      {tab === 'Users' && <UsersPanel />}
    </div>
  )
}

function CategoriesPanel() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function load() {
    api.get('/categories', { params: { include_inactive: true } }).then((res) => setItems(res.data))
  }
  useEffect(load, [])

  async function add() {
    setError('')
    if (!name.trim()) return
    try {
      await api.post('/categories', { name: name.trim(), sort_order: items.length })
      setName('')
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add category')
    }
  }

  async function toggle(item) {
    await api.patch(`/categories/${item.id}`, { is_active: !item.is_active })
    load()
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex gap-2">
        <input
          className="input"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} className="btn btn-primary shrink-0">
          Add
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <ItemsTable items={items} onToggle={toggle} />
    </div>
  )
}

function PrioritiesPanel() {
  const [items, setItems] = useState([])

  function load() {
    api.get('/priorities', { params: { include_inactive: true } }).then((res) => setItems(res.data))
  }
  useEffect(load, [])

  async function toggle(item) {
    await api.patch(`/priorities/${item.id}`, { is_active: !item.is_active })
    load()
  }

  return (
    <div className="card p-6">
      <p className="mb-4 text-sm text-gray-500">
        Priority levels drive urgency and dashboard grouping. Level 1 = lowest urgency.
      </p>
      <div className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {p.name} <span className="text-xs font-normal text-gray-400">(level {p.level})</span>
                </p>
                <p className="text-xs text-gray-500">{p.description}</p>
              </div>
            </div>
            <button
              onClick={() => toggle(p)}
              className={`btn !py-1 text-xs ${p.is_active ? 'btn-secondary' : 'btn-primary'}`}
            >
              {p.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function UsersPanel() {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    employee_id: '',
    name: '',
    email: '',
    department: '',
    role: 'employee',
    password: 'password123',
  })
  const [error, setError] = useState('')

  function load() {
    api.get('/users').then((res) => setItems(res.data))
  }
  useEffect(load, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/users', form)
      setShowForm(false)
      setForm({ employee_id: '', name: '', email: '', department: '', role: 'employee', password: 'password123' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create user')
    }
  }

  async function toggleActive(u) {
    await api.patch(`/users/${u.id}`, { is_active: !u.is_active })
    load()
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">Employees, IT agents, admins and management users.</p>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary">
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-5 grid gap-3 rounded-lg border border-gray-100 p-4 sm:grid-cols-2">
          <Field label="Employee ID">
            <input
              className="input"
              required
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            />
          </Field>
          <Field label="Name">
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Department">
            <input
              className="input"
              required
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="agent">IT Agent</option>
              <option value="admin">IT Admin</option>
              <option value="management">Management</option>
            </select>
          </Field>
          <Field label="Initial password">
            <input
              className="input"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Create User
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-2">Employee ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{u.employee_id}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{u.name}</td>
                <td className="px-3 py-2 text-gray-600">{u.department}</td>
                <td className="px-3 py-2">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-2">
                  {u.is_active ? (
                    <span className="text-xs font-medium text-emerald-600">Active</span>
                  ) : (
                    <span className="text-xs font-medium text-gray-400">Disabled</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleActive(u)} className="btn btn-secondary !py-1 text-xs">
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ItemsTable({ items, onToggle }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5"
        >
          <span className="text-sm font-medium text-gray-800">{item.name}</span>
          <button
            onClick={() => onToggle(item)}
            className={`btn !py-1 text-xs ${item.is_active ? 'btn-secondary' : 'btn-primary'}`}
          >
            {item.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}
