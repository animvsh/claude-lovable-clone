/**
 * Supabase Configuration Component
 * 
 * Allows users to easily configure their Supabase project connection
 */

import React, { useState } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'
import { isValidSupabaseUrl, isValidAnonKey } from '../lib/supabase'

interface SupabaseConfigProps {
  onConfigured?: () => void
  className?: string
}

export function SupabaseConfig({ onConfigured, className = '' }: SupabaseConfigProps) {
  const { configure, config, isConfigured } = useSupabase()
  
  const [url, setUrl] = useState(config?.url || '')
  const [anonKey, setAnonKey] = useState(config?.anonKey || '')
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsConfiguring(true)

    // Validate inputs
    if (!isValidSupabaseUrl(url)) {
      setError('Please enter a valid Supabase URL (e.g., https://your-project.supabase.co)')
      setIsConfiguring(false)
      return
    }

    if (!isValidAnonKey(anonKey)) {
      setError('Please enter a valid Supabase anon key')
      setIsConfiguring(false)
      return
    }

    try {
      const success = await configure({ url, anonKey })
      
      if (success) {
        onConfigured?.()
      } else {
        setError('Failed to configure Supabase connection. Please check your credentials.')
      }
    } catch (err) {
      setError('Configuration error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleQuickSetup = (projectRef: string) => {
    setUrl(`https://${projectRef}.supabase.co`)
  }

  if (isConfigured) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-green-800">
              ✅ Supabase Connected
            </h3>
            <p className="text-sm text-green-600 mt-1">
              Project: {config?.url?.replace('https://', '').replace('.supabase.co', '')}
            </p>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-green-700 hover:text-green-800 underline"
          >
            {showAdvanced ? 'Hide' : 'Reconfigure'}
          </button>
        </div>
        
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-green-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supabase URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anon Key
                </label>
                <textarea
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isConfiguring}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isConfiguring ? 'Updating...' : 'Update Configuration'}
              </button>
            </form>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          🗄️ Connect to Supabase
        </h2>
        <p className="text-sm text-gray-600">
          Connect your Supabase project to enable database management, real-time updates, and AI-powered SQL assistance.
        </p>
      </div>

      {/* Quick Setup */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          🚀 Quick Setup
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Enter your project reference to auto-configure the URL:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="your-project-ref"
            className="flex-1 px-3 py-2 border border-blue-200 rounded-md text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleQuickSetup(e.currentTarget.value)
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[placeholder="your-project-ref"]') as HTMLInputElement
              if (input?.value) {
                handleQuickSetup(input.value)
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Auto-fill
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supabase URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project.supabase.co"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Find this in your Supabase project settings → API
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anon Key (Public)
          </label>
          <textarea
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Find this in your Supabase project settings → API → anon/public key
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isConfiguring || !url || !anonKey}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConfiguring ? 'Connecting...' : 'Connect to Supabase'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          💡 What you'll get:
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Visual database schema exploration</li>
          <li>• SQL query editor with AI assistance</li>
          <li>• Real-time data viewing and editing</li>
          <li>• TypeScript type generation</li>
          <li>• Secure authentication integration</li>
        </ul>
      </div>
    </div>
  )
}