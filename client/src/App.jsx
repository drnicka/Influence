import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import BallotList from './components/BallotList'
import BallotView from './components/BallotView'
import CompactBallotList from './components/CompactBallotList'
import Toast from './components/Toast'
import AuthGate from './components/AuthGate'
import { apiFetch, apiPost, apiGet, getApiKey, setApiKey, getStoredMember, setStoredMember } from './api'
import RoomPanel from './components/RoomPanel'
import CreateRoomBallot from './components/CreateRoomBallot'
import CreatePublicBallot from './components/CreatePublicBallot'
import PublicVotePage from './components/PublicVotePage'

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const publicVoteMatch = path.match(/^\/vote\/([a-zA-Z0-9_-]+)$/)
  const publicVoteSlug = publicVoteMatch?.[1] || null

  const [ballots, setBallots] = useState([])
  const [activeBallot, setActiveBallot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [toast, setToast] = useState(null)
  const [member, setMember] = useState(getStoredMember)
  const [multiUser, setMultiUser] = useState(null) // null = loading, true/false after health check
  const [activeFeed, setActiveFeed] = useState('inbox') // 'inbox' | 'subscribed' | 'public'
  const [screen, setScreen] = useState('list') // 'list' | 'rooms' | 'create-room-ballot' | 'create-public-ballot'
  const [selectedRoom, setSelectedRoom] = useState(null)

  // Stale-tab guard: long-lived SPA tabs run old bundles and silently miss
  // new card types. Compare the served bundle hash against the loaded one.
  const [staleBuild, setStaleBuild] = useState(false)
  useEffect(() => {
    const current = document.querySelector('script[type="module"]')?.getAttribute('src') || ''
    if (!current.includes('index-')) return // dev server: hot reload handles it
    const check = () =>
      fetch('/', { cache: 'no-store' })
        .then(r => r.text())
        .then(html => {
          const m = html.match(/assets\/index-[^"]+\.js/)
          if (m && !current.endsWith(m[0].split('/').pop())) setStaleBuild(true)
        })
        .catch(() => {})
    const t = setInterval(check, 60_000)
    check()
    return () => clearInterval(t)
  }, [])

  // Check if server is in multi-user mode
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => {
      setMultiUser(!!d.multiUser)
    }).catch(() => setMultiUser(false))
  }, [])

  useEffect(() => {
    // Only fetch once we know auth state
    if (multiUser === null) return
    if (multiUser && !getApiKey()) return
    fetchBallots()
  }, [multiUser, member])

  // Poll for new ballots every 5s when on the list screen
  useEffect(() => {
    if (multiUser === null) return
    if (multiUser && !getApiKey()) return
    if (activeBallot || screen !== 'list') return // don't poll when viewing a ballot or room panel

    const interval = setInterval(() => {
      fetchBallots()
    }, 5000)

    return () => clearInterval(interval)
  }, [multiUser, member, activeBallot, screen])

  async function fetchBallots() {
    try {
      setFetchError(null)
      const res = await apiGet('/ballots')

      // Stale API key — server wiped or key invalid. Clear and re-auth.
      if (res.status === 401) {
        handleLogout()
        return null
      }

      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      setBallots(data)

      return data
    } catch (err) {
      console.error('Failed to fetch ballots:', err)
      setFetchError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function loadBallot(id) {
    try {
      const res = await apiGet(`/ballots/${id}`)
      const data = await res.json()
      setActiveBallot(data)
    } catch (err) {
      console.error('Failed to load ballot:', err)
    }
  }

  function handleAuth(apiKey, memberData) {
    setApiKey(apiKey)
    setStoredMember(memberData)
    setMember(memberData)
  }

  function handleLogout() {
    setApiKey(null)
    setStoredMember(null)
    setMember(null)
    setBallots([])
    setActiveBallot(null)
    // Re-check if server is still in multi-user mode
    fetch('/api/health').then(r => r.json()).then(d => setMultiUser(!!d.multiUser)).catch(() => {})
  }

  function shortId(id) {
    return typeof id === 'string' ? id.slice(0, 6) : ''
  }

  async function handleSubmitVotes(ballotId, votes) {
    try {
      const res = await apiPost(`/ballots/${ballotId}/vote`, { votes })
      const data = await res.json()

      // Room/public ballots return { ok, ballotId, votesSubmitted, votesExpected }
      if (data?.ok && data?.votesSubmitted !== undefined) {
        setToast({
          kind: 'ok',
          text: `Vote submitted (${data.votesSubmitted}/${data.votesExpected})`,
        })
        setActiveBallot(null)
        fetchBallots()
        return
      }

      // Personal ballot: returns full ballot data
      setActiveBallot(data)
      fetchBallots()

      if (data?.executionBallotId) {
        const execId = data.executionBallotId
        const execTitle = data.executionBallotTitle || 'Execution ballot'
        setToast({
          kind: 'ok',
          text: `${execTitle} created (#${shortId(execId)})`,
          actionLabel: 'Open',
          onAction: () => loadBallot(execId),
        })
      }
    } catch (err) {
      console.error('Failed to submit votes:', err)
      setToast({ kind: 'err', text: `Submit failed: ${err.message}` })
    }
  }

  async function handleRevote(ballotId) {
    try {
      const res = await apiPost(`/ballots/${ballotId}/revote`)
      const data = await res.json()
      setActiveBallot(data)
      fetchBallots()
    } catch (err) {
      console.error('Failed to revote:', err)
    }
  }

  async function handlePass(ballotId, { action = 'pass', comment = '' } = {}) {
    try {
      const res = await apiPost(`/ballots/${ballotId}/pass`, { action, comment })
      if (!res.ok) throw new Error(`pass failed: ${res.status}`)
      setActiveBallot(null)
      await fetchBallots()
    } catch (err) {
      console.error('Failed to pass ballot:', err)
    }
  }

  async function handlePublishPublic(ballotId) {
    try {
      const res = await apiPost(`/ballots/${ballotId}/publish-public`, {})
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `publish failed: ${res.status}`)

      const url = data?.publicUrl || ''
      if (url && navigator?.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(url) } catch {}
      }
      setToast({ kind: 'ok', text: url ? `Published. Link copied: ${url}` : 'Published public ballot.' })
      await fetchBallots()
      if (activeBallot?.id === ballotId) await loadBallot(ballotId)
    } catch (err) {
      console.error('Failed to publish public ballot:', err)
      setToast({ kind: 'err', text: `Publish failed: ${err.message}` })
    }
  }

  async function handleClosePublic(ballotId) {
    try {
      const res = await apiPost(`/ballots/${ballotId}/close-public`, {})
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `close failed: ${res.status}`)
      setToast({
        kind: 'ok',
        text: `Vote closed — ${data.voterCount} voter${data.voterCount === 1 ? '' : 's'} tallied`,
        actionLabel: 'Open results',
        onAction: () => loadBallot(data.resultsBallotId),
      })
      setActiveBallot(null)
      await fetchBallots()
    } catch (err) {
      console.error('Failed to close public ballot:', err)
      setToast({ kind: 'err', text: `Close failed: ${err.message}` })
    }
  }

  async function handleNewRound() {
    try {
      const res = await apiPost('/round/new', { regenLimit: 5 })
      if (!res.ok) throw new Error(`new round failed: ${res.status}`)
      await fetchBallots()
      setToast({ kind: 'ok', text: 'New round started' })
    } catch (err) {
      console.error('Failed to start new round:', err)
      setToast({ kind: 'err', text: `New round failed: ${err.message}` })
    }
  }

  // Auth gate: show registration/login if multi-user mode is active and no key stored,
  // OR if user explicitly opened it via "Go multiplayer"
  const [showAuthGate, setShowAuthGate] = useState(false)

  if (publicVoteSlug) {
    return <PublicVotePage slug={publicVoteSlug} />
  }

  if ((multiUser && !getApiKey()) || showAuthGate) {
    return <AuthGate onAuth={(key, data) => {
      handleAuth(key, data)
      setShowAuthGate(false)
      // Re-check health to pick up multiUser=true
      fetch('/api/health').then(r => r.json()).then(d => setMultiUser(!!d.multiUser)).catch(() => {})
    }} />
  }

  return (
    <div className="min-h-screen bg-voice-bg font-sans">
      {staleBuild && (
        <div className="sticky top-0 z-50 bg-voice-accent text-white text-[12px] font-medium px-4 py-2 flex items-center justify-center gap-3">
          A new build of Influence is available
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-semibold transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mx-auto max-w-md lg:max-w-6xl">
        <Header
          member={member}
          multiUser={multiUser}
          onLogout={handleLogout}
        />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-voice-text-secondary">Loading...</div>
          </div>
        ) : screen === 'rooms' ? (
          <RoomPanel
            onClose={() => setScreen('list')}
            onCreateRoomBallot={(room) => {
              setSelectedRoom(room)
              setScreen('create-room-ballot')
            }}
          />
        ) : screen === 'create-room-ballot' && selectedRoom ? (
          <CreateRoomBallot
            room={selectedRoom}
            onBack={() => setScreen('rooms')}
            onCreated={(ballot) => {
              setToast({ kind: 'ok', text: `Ballot sent to ${selectedRoom.name}` })
              setSelectedRoom(null)
              setScreen('list')
              setActiveFeed('subscribed')
              fetchBallots()
            }}
          />
        ) : screen === 'create-public-ballot' ? (
          <CreatePublicBallot
            onBack={() => setScreen('list')}
            onCreated={(ballot) => {
              setToast({ kind: 'ok', text: 'Public ballot draft created — publish when ready' })
              setScreen('list')
              setActiveBallot(ballot)
              fetchBallots()
            }}
          />
        ) : !activeBallot ? (
          <BallotList
            ballots={ballots}
            onSelect={loadBallot}
            onNewRound={handleNewRound}
            toast={toast}
            clearToast={() => setToast(null)}
            fetchError={fetchError}
            onRetry={fetchBallots}
            multiUser={multiUser}
            activeFeed={activeFeed}
            onFeedChange={setActiveFeed}
            onOpenRooms={() => setScreen('rooms')}
            onCreatePublicBallot={() => setScreen('create-public-ballot')}
          />
        ) : (
          // Two surfaces: compact inbox rail + ballot (single column on mobile)
          <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:px-6">
            <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-140px)]">
              <div className="h-full bg-voice-surface border border-voice-border rounded-2xl overflow-hidden">
                <CompactBallotList
                  ballots={ballots}
                  onSelect={loadBallot}
                  onNewRound={handleNewRound}
                />
              </div>
            </div>

            <div>
              <BallotView
                ballot={activeBallot}
                onSubmitVotes={handleSubmitVotes}
                onRevote={handleRevote}
                onPass={handlePass}
                onPublishPublic={handlePublishPublic}
                onClosePublic={handleClosePublic}
                onBack={() => setActiveBallot(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

