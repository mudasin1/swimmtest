/**
 * src/views/Profile.jsx
 *
 * User profile management page
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useUpdateSettings } from '../context/AppContext'
import { supabase, signOut, updateProfile } from '../lib/supabase.js'
import { toInches } from '../lib/utils.js'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, savedSlugs, resorts, settings, unsaveResort } = useApp()
  const updateSettings = useUpdateSettings()
  
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name)
    }
  }, [profile])

  const savedResortsList = resorts.filter(r => savedSlugs.includes(r.slug))

  async function handleUpdateProfile(e) {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    try {
      await updateProfile(user.id, { display_name: displayName })
      setMessage('Profile updated successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage('Error updating profile: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  async function handleDeleteAccount() {
    if (!user) return
    // Note: Account deletion requires admin privileges or a server function
    // For now, we'll just sign them out and let them know to contact support
    alert('Please contact support to delete your account permanently.')
    setShowDeleteConfirm(false)
  }

  function toggleUnits() {
    const newUnits = settings.units === 'imperial' ? 'metric' : 'imperial'
    updateSettings({ units: newUnits })
    
    // Also update in Supabase if logged in
    if (user) {
      updateProfile(user.id, { units: newUnits }).catch(console.error)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
        Profile Settings
      </h1>

      {message && (
        <div className="mb-4 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          {message}
        </div>
      )}

      {/* Profile Form */}
      <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Account Information
        </h2>
        
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full max-w-xs px-3 py-2 rounded border outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundColor: 'var(--color-bg-dark)',
                borderColor: 'var(--color-bg-card-hover)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {user.email}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded font-medium transition-opacity disabled:opacity-50"
            style={{ 
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-bg-dark)'
            }}
          >
            {loading ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Units Preference */}
      <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Preferences
        </h2>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Units
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Choose your preferred measurement system
            </p>
          </div>
          
          <button
            onClick={toggleUnits}
            className="px-4 py-2 rounded border font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--color-bg-dark)',
              borderColor: 'var(--color-bg-card-hover)',
              color: 'var(--color-text-primary)'
            }}
          >
            {settings.units === 'imperial' ? 'Imperial (°F, inches)' : 'Metric (°C, cm)'}
          </button>
        </div>
      </div>

      {/* Saved Resorts */}
      <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Saved Resorts ({savedResortsList.length})
        </h2>
        
        {savedResortsList.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You haven't saved any resorts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {savedResortsList.map(resort => (
              <div 
                key={resort.slug}
                className="flex items-center justify-between p-3 rounded"
                style={{ backgroundColor: 'var(--color-bg-dark)' }}
              >
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {resort.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {resort.region}, {resort.country}
                  </p>
                </div>
                <button
                  onClick={() => unsaveResort(resort.slug)}
                  className="px-3 py-1 text-sm rounded border hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  style={{ 
                    borderColor: 'var(--color-bg-card-hover)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-lg border border-red-500/30" style={{ backgroundColor: 'rgba(239,68,68,0.05)' }}>
        <h2 className="text-lg font-semibold mb-4 text-red-400">
          Danger Zone
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Sign Out
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Sign out from your account on this device
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <div>
              <p className="font-medium text-red-400">
                Delete Account
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Permanently delete your account and all data
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="max-w-md w-full p-6 rounded-lg" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-bold mb-2 text-red-400">
              Delete Account?
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              This will permanently delete your account, saved resorts, and alert settings. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded border"
                style={{ borderColor: 'var(--color-bg-card-hover)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
