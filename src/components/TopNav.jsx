/**
 * src/components/TopNav.jsx
 *
 * Fixed top navigation bar, 60px tall.
 * SPEC.md section "Deliverable 5": app name, nav links, saved-resort badge,
 * responsive hamburger on small screens.
 */

import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Snowflake, Menu, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function TopNav() {
  const { savedSlugs } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    [
      'text-sm font-medium transition-colors px-3 py-1 rounded',
      isActive
        ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
    ].join(' ')

  const savedCount = savedSlugs?.length ?? 0

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center px-4 md:px-6 shadow-md"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <div className="flex items-center gap-2 mr-8">
        <Snowflake size={22} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          SnowDesk
        </span>
      </div>

      <div className="hidden md:flex items-center gap-1 flex-1">
        <NavLink to="/" end className={linkClass}>
          Dashboard
          {savedCount > 0 && (
            <span
              className="ml-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold w-5 h-5"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-dark)' }}
            >
              {savedCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/compare" className={linkClass}>
          Compare
        </NavLink>

        <NavLink to="/settings" className={linkClass}>
          Settings
        </NavLink>
      </div>

      <button
        className="md:hidden ml-auto p-2 rounded"
        style={{ color: 'var(--color-text-secondary)' }}
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {menuOpen && (
        <div
          className="absolute top-[60px] left-0 right-0 flex flex-col gap-1 px-4 py-3 md:hidden shadow-lg"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <NavLink to="/" end className={linkClass} onClick={() => setMenuOpen(false)}>
            Dashboard
            {savedCount > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold w-5 h-5"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-dark)' }}
              >
                {savedCount}
              </span>
            )}
          </NavLink>

          <NavLink to="/compare" className={linkClass} onClick={() => setMenuOpen(false)}>
            Compare
          </NavLink>

          <NavLink to="/settings" className={linkClass} onClick={() => setMenuOpen(false)}>
            Settings
          </NavLink>
        </div>
      )}
    </nav>
  )
}