import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarClock,
  Mic,
  BookOpen,
  History,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Menu,
  X,
  Download,
  Crown,
} from 'lucide-react'
import { LogoMark } from './Logo'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../hooks/useProfile'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { PLAN_LABELS, type Plan } from '../lib/profile'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/timetable', label: 'Timetable', icon: CalendarClock },
  { to: '/app/record', label: 'Record Lesson', icon: Mic, soon: true },
  { to: '/app/programs', label: 'Programs', icon: BookOpen },
  { to: '/app/history', label: 'History', icon: History, soon: true },
  { to: '/app/reports', label: 'Data & Reports', icon: BarChart3, soon: true },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
]

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { profile } = useProfile()
  const { canInstall, install } = usePwaInstall()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Teacher'
  const firstName = displayName.split(' ')[0]
  const initials = initialsOf(displayName)
  const plan = (profile?.plan ?? 'starter') as Plan

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false)
    setDrawerOpen(false)
  }, [location.pathname])

  // Close user dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const SidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-navy-100 px-6">
        <LogoMark size={34} />
        <span className="flex items-baseline text-lg font-extrabold tracking-tight">
          <span className="text-navy-800">Project</span>
          <span className="ml-1 text-teal-500">Daybook</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) =>
          item.soon ? (
            <button
              key={item.label}
              type="button"
              title="Coming soon"
              className="flex w-full cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-400"
            >
              <item.icon size={18} />
              {item.label}
              <span className="ml-auto rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold text-navy-500">
                Soon
              </span>
            </button>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
      <div className="space-y-1 border-t border-navy-100 p-4">
        {plan === 'perpetual' ? (
          <div className="mb-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 px-3 py-2 text-xs font-bold text-white">
            <Crown size={14} /> Founding Teacher
          </div>
        ) : (
          <Link
            to="/app/settings"
            className="mb-1 flex items-center justify-between rounded-xl bg-cloud px-3 py-2 text-xs font-bold text-navy-600"
          >
            <span>{PLAN_LABELS[plan]}</span>
            {plan === 'starter' ? (
              <span className="text-teal-600">Upgrade</span>
            ) : (
              <span className="text-teal-500">✓</span>
            )}
          </Link>
        )}
        {canInstall && (
          <button
            onClick={install}
            className="flex w-full items-center gap-3 rounded-xl bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100"
          >
            <Download size={18} /> Install app
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-600 hover:bg-navy-50"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-cloud">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-navy-100 bg-white lg:flex">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <button
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-navy-100 bg-white/80 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-navy-200 text-navy-700 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-3">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy-500 hover:bg-navy-50">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-500" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-navy-50"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white">
                    {initials}
                  </span>
                )}
                <span className="hidden text-sm font-semibold text-navy-800 sm:block">{firstName}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-navy-100 bg-white p-2 shadow-card">
                  <div className="px-3 py-2">
                    <p className="text-sm font-bold text-navy-900">{displayName}</p>
                    <p className="truncate text-xs text-navy-400">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-navy-100" />
                  <Link
                    to="/app/settings"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy-600 hover:bg-navy-50"
                  >
                    <SettingsIcon size={16} /> Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy-600 hover:bg-navy-50"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
