import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeProfile, type UserProfile } from '../lib/profile'

/** Subscribes to the current user's Firestore profile in real time. */
export function useProfile() {
  const { effectiveUid } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!effectiveUid) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribeProfile(effectiveUid, (p) => {
      setProfile(p)
      setLoading(false)
    })
    return unsub
  }, [effectiveUid])

  return { profile, loading }
}
