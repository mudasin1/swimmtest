/**
 * src/components/TopNav.jsx
 *
 * Top navigation bar with auth state
 */

import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { signOut } from '../lib/supabase.js'

export default function TopNav() {
  const { user, profile, savedSlugs } = useApp()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User'

  return (
    <nav 
      className="fixed top-0 left-0 right-0 h-[60px] z-50 px-4 flex items-center justify-between border-b"
      style={{ 
        backgroundColor: 'var(--color-bg-dark)',
        borderColor: 'var(--color-bg-card)'
      }}
    >
      <div className="flex items-center gap-6">
        <Link 
          to="/" 
          className="text-xl font-bold hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text-primary)' }}
        >
          SnowBro ❄️
        </Link>
        
        <div className="hidden md:flex items-center gap-4">
          <Link 
            to="/"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Dashboard
          </Link>
          <Link 
            to="/compare"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Compare
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
              style={{ 
                borderColor: 'var(--color-bg-card-hover)',
                color: 'var(--color-text-primary)'
              }}
            >
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs">▾</span>
            </button>

            {dropdownOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-lg py-1"
                style={{ 
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-bg-card-hover)'
                }}
              >
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => setDropdownOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => setDropdownOpen(false)}
                >
                  Settings
                </Link>
                <div className="border-t my-1" style={{ borderColor: 'var(--color-bg-card-hover)' }} />
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:opacity-80 transition-opacity"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="px-4 py-1.5 rounded text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ 
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-bg-dark)'
            }}
          >
            Log In
          </Link>
        )}
      </div>
    </nav>
  )
}
