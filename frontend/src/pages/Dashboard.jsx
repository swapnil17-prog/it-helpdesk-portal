import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import api from '../api/client'
import PageHeader from '../components/PageHeader'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatLongDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Delta({ current, previous }) {
  const diff = current - previous
  if (diff === 0) return <span className="text-gray-400">Same as yesterday</span>
  const positive = diff > 0
  return (
    <span className={positive ? 'text-emerald-600' : 'text-rose-600'}>
      {positive ? '+' : ''}
      {diff} vs yesterday
    </span>
  )
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [yesterday, setYesterday] = useState(null)
  const dateInputRef = useRef(null)

  function openDatePicker() {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker()
    } else {
      dateInputRef.current?.focus()
    }
  }

  function load(date) {
    Promise.all([
      api.get('/dashboard/summary', { params: { for_date: date } }),
      api.get('/dashboard/summary', { params: { for_date: shiftDate(date, -1) } }),
    ]).then(([today, prior]) => {
      setData(today.data)
      setYesterday(prior.data)
    })
  }

  useEffect(() => {
    load(selectedDate)
    const interval = setInterval(() => load(selectedDate), 30000)
    return () => clearInterval(interval)
  }, [selectedDate])

  if (!data || !yesterday) return <p className="text-sm text-gray-500">Loading dashboard...</p>

  const kpis = [
    {
      label: 'Logged today',
      value: data.logged_today,
      context: <Delta current={data.logged_today} previous={yesterday.logged_today} />,
    },
    {
      label: 'Allocated today',
      value: data.allocated_today,
      context: <Delta current={data.allocated_today} previous={yesterday.allocated_today} />,
    },
    {
      label: 'Closed today',
      value: data.closed_today,
      context: <Delta current={data.closed_today} previous={yesterday.closed_today} />,
    },
    {
      label: 'Open tickets',
      value: data.open_tickets,
      context: (
        <span className="text-gray-400">
          {data.avg_resolution_hours != null ? `Avg fix ${data.avg_resolution_hours}h` : 'No resolutions yet'}
        </span>
      ),
    },
    {
      label: 'Unallocated',
      value: data.unallocated_tickets,
      warn: data.unallocated_tickets > 0,
      context:
        data.unallocated_tickets > 0 ? (
          <span className="font-medium text-rose-600">Needs an owner</span>
        ) : (
          <span className="text-emerald-600">Fully staffed</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Live view of demand, allocation and backlog"
        right={
          <div className="relative">
            <button
              type="button"
              onClick={openDatePicker}
              className="input flex w-40 items-center gap-2 text-left text-sm text-gray-700"
            >
              <Calendar size={15} className="shrink-0 text-gray-400" />
              {formatLongDate(selectedDate)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 h-full w-full opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.warn ? 'text-rose-600' : 'text-gray-900'}`}>
              {k.value}
            </p>
            <p className="mt-1 text-xs">{k.context}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Open tickets by priority">
          {data.priority_split.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-[180px] w-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.priority_split}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.priority_split.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{data.open_tickets}</span>
                  <span className="text-xs text-gray-500">open</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {data.priority_split.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-semibold text-gray-900">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Tickets by department">
          {data.department_split.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.department_split} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={16} label={{ position: 'right', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Agent workload">
          {data.agent_workload.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.agent_workload} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={16} label={{ position: 'right', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Open tickets by age">
          {data.aging_buckets.every((b) => b.count === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.aging_buckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f5" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} hide />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36} label={{ position: 'top', fontSize: 12 }}>
                  {data.aging_buckets.map((entry, i) => (
                    <Cell key={i} fill={entry.name === '>5 days' && entry.count > 0 ? '#dc2626' : '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="card flex items-center justify-between p-4 text-sm text-gray-600">
        <span>Reopened tickets</span>
        <span className="font-semibold">
          {data.reopened_count} ({data.reopened_pct}%)
        </span>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-bold text-gray-800">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">No data yet</div>
  )
}
