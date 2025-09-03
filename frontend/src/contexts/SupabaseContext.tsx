/**
 * Supabase Auth Context
 * 
 * Provides authentication state and MCP integration for Supabase projects
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient, clearSupabaseClient, type SupabaseConfig } from '../lib/supabase'

export interface SupabaseContextValue {
  // Auth state
  user: User | null
  session: Session | null
  loading: boolean
  
  // Configuration
  config: SupabaseConfig | null
  isConfigured: boolean
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  configure: (config: SupabaseConfig) => Promise<boolean>
  clearConfiguration: () => void
  
  // MCP integration
  getMCPConfig: () => { projectRef: string; accessToken: string } | null
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}

interface SupabaseProviderProps {
  children: React.ReactNode
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<SupabaseConfig | null>(null)

  // Load saved configuration from localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('supabase-config')
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig)
        setConfig(parsedConfig)
        
        // Initialize client with saved config
        const client = getSupabaseClient(parsedConfig)
        
        // Get initial session
        client.auth.getSession().then(({ data: { session } }) => {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = client.auth.onAuthStateChange(
          async (_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
          }
        )

        return () => subscription.unsubscribe()
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading Supabase configuration:', error)
      setLoading(false)
    }
  }, [])

  const configure = async (newConfig: SupabaseConfig): Promise<boolean> => {
    try {
      // Test the configuration by creating a client and checking connection
      const testClient = getSupabaseClient(newConfig)
      
      // Try to get session to validate the configuration
      const { error } = await testClient.auth.getSession()
      
      if (error && !error.message.includes('not authenticated')) {
        // If it's not just a "not logged in" error, the config might be wrong
        console.warn('Supabase configuration warning:', error.message)
      }

      // Save configuration
      localStorage.setItem('supabase-config', JSON.stringify(newConfig))
      setConfig(newConfig)

      // Set up auth listener
      const { data: { subscription: _subscription } } = testClient.auth.onAuthStateChange(
        async (_event, session) => {
          setSession(session)
          setUser(session?.user ?? null)
        }
      )

      // Get current session
      const { data: { session } } = await testClient.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)

      return true
    } catch (error) {
      console.error('Failed to configure Supabase:', error)
      return false
    }
  }

  const clearConfiguration = () => {
    localStorage.removeItem('supabase-config')
    clearSupabaseClient()
    setConfig(null)
    setSession(null)
    setUser(null)
  }

  const signIn = async (email: string, password: string) => {
    if (!config) {
      return { error: { message: 'Supabase not configured' } }
    }

    const client = getSupabaseClient(config)
    const result = await client.auth.signInWithPassword({ email, password })
    return { error: result.error }
  }

  const signUp = async (email: string, password: string) => {
    if (!config) {
      return { error: { message: 'Supabase not configured' } }
    }

    const client = getSupabaseClient(config)
    const result = await client.auth.signUp({ email, password })
    return { error: result.error }
  }

  const signOut = async () => {
    if (!config) return

    const client = getSupabaseClient(config)
    await client.auth.signOut()
  }

  const getMCPConfig = () => {
    if (!config || !session?.access_token) {
      return null
    }

    // Extract project ref from URL
    const projectRefMatch = config.url.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co/)
    const projectRef = projectRefMatch ? projectRefMatch[1] : ''

    if (!projectRef) {
      return null
    }

    return {
      projectRef,
      accessToken: session.access_token
    }
  }

  const value: SupabaseContextValue = {
    user,
    session,
    loading,
    config,
    isConfigured: !!config,
    signIn,
    signUp,
    signOut,
    configure,
    clearConfiguration,
    getMCPConfig,
  }

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  )
}