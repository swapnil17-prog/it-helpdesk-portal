import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, LayoutGrid, Inbox, Settings, MoreHorizontal, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { RoleBadge } from './Badges'
import Avatar from './Avatar'

function navItemsForRole(role) {
  const items = []
  if (role === 'employee') items.push({ to: '/', icon: Inbox, label: 'My Tickets', end: true })
  if (role === 'agent' || role === 'admin') items.push({ to: '/queue', icon: Inbox, label: 'IT Queue' })
  if (role === 'agent' || role === 'admin' || role === 'management')
    items.push({ to: '/dashboard', icon: LayoutGrid, label: 'Dashboard' })
  if (role === 'admin') items.push({ to: '/admin', icon: Settings, label: 'Admin' })
  return items
}

function SidebarLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        `flex h-10 w-10 items-center justify-center rounded-xl transition ${
          isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`
      }
    >
      <Icon size={19} strokeWidth={2} />
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const items = navItemsForRole(user.role)

  return (
    <div className="flex min-h-screen bg-[#f7f7f9]">
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center gap-2 border-r border-gray-200 bg-white py-4">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-white">
          H
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-gray-200 bg-white/90 px-6 py-3 backdrop-blur">
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Bell size={17} />
          </button>
          <Avatar name={user.name} size={30} />
          <RoleBadge role={user.role} />
          <div className="relative">
            <button
              type="button"
              title="Menu"
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <MoreHorizontal size={17} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.department}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <main className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
