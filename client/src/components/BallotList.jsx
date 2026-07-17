import { Clock, CheckCircle, SkipForward, ChevronRight, Users, BarChart3 } from 'lucide-react'
import { useMemo, useState } from 'react'

export default function BallotList({ ballots, onSelect, onNewRound, toast, clearToast, fetchError, onRetry, multiUser, activeFeed, onFeedChange, onOpenRooms, onCreatePublicBallot }) {
  const [view, setView] = useState('inbox')

  // Separate personal (inbox) vs subscribed room ballots
  const personalBallots = useMemo(() =>
    ballots.filter(b => !b.visibility || b.visibility === 'personal' || b.visibility === 'public'),
  [ballots])

  const subscribedBallots = useMemo(() =>
    ballots.filter(b => b.visibility === 'room'),
  [ballots])

  const activeBallots = activeFeed === 'subscribed'
    ? subscribedBallots
    : personalBallots

  const counts = useMemo(() => ({
    inbox: activeBallots.filter(b => b.status === 'open').length,
    completed: activeBallots.filter(b => b.status === 'completed' || b.status === 'closed').length,
    passed: activeBallots.filter(b => b.status === 'passed').length,
  }), [activeBallots])

  const filtered = useMemo(() => {
    const visible = activeBallots.filter(b => b.status !== 'burned')
    if (view === 'inbox') return visible.filter(b => b.status === 'open')
    if (view === 'completed') {
      // Weighted intents first: results ballots lead the voted list
      return visible
        .filter(b => b.status === 'completed' || b.status === 'closed')
        .sort((a, b) => (b.isResults ? 1 : 0) - (a.isResults ? 1 : 0))
    }
    if (view === 'passed') return visible.filter(b => b.status === 'passed')
    return visible
  }, [activeBallots, view])

  const tabs = [
    { id: 'inbox', label: 'Inbox', count: counts.inbox },
    { id: 'completed', label: 'Voted', count: counts.completed },
    { id: 'passed', label: 'Passed', count: counts.passed },
  ]

  const emptyTitle = view === 'inbox'
    ? (activeFeed === 'subscribed' ? 'No room ballots yet' : 'Inbox empty')
    : view === 'completed'
      ? 'No completed ballots'
      : 'No passed ballots'

  const emptyHint = activeBallots.length === 0
    ? (activeFeed === 'subscribed'
      ? 'Create a room and send a ballot to get started.'
      : 'Agents push proposals via the API — vote to send weighted context back.')
    : 'Switch tabs or refresh.'

  return (
    <div className="px-[18px] space-y-3">
      {/* Feed switcher (only in multi-user mode) */}
      {multiUser && (
        <div className="flex gap-2 mb-1">
          <button
            onClick={() => onFeedChange?.('inbox')}
            className={`flex-1 h-[36px] rounded-full text-[12px] font-medium transition-all ${
              activeFeed === 'inbox'
                ? 'bg-voice-card text-voice-text'
                : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
            }`}
          >
            Personal
            {personalBallots.filter(b => b.status === 'open').length > 0 && (
              <span className="ml-1 text-voice-accent">{personalBallots.filter(b => b.status === 'open').length}</span>
            )}
          </button>
          <button
            onClick={() => onFeedChange?.('subscribed')}
            className={`flex-1 h-[36px] rounded-full text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeFeed === 'subscribed'
                ? 'bg-voice-card text-voice-text'
                : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
            }`}
          >
            <Users size={12} />
            Subscribed
            {subscribedBallots.filter(b => b.status === 'open').length > 0 && (
              <span className="ml-1 text-voice-accent">{subscribedBallots.filter(b => b.status === 'open').length}</span>
            )}
          </button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-[19px]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`w-[106px] h-[44px] rounded-full text-[13px] font-medium transition-all ${
              view === tab.id
                ? 'bg-voice-card text-voice-text'
                : 'border border-voice-border text-voice-text-secondary hover:text-voice-text hover:border-voice-border-hover'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1 ${view === tab.id ? 'text-voice-accent' : 'text-voice-text-tertiary'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Session actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {multiUser && onCreatePublicBallot && (
          <button
            onClick={onCreatePublicBallot}
            className="px-3 py-2 text-[11px] font-medium rounded-lg bg-voice-card border border-voice-border text-voice-text hover:bg-voice-card/70 transition-colors"
            title="Draft a public vote: publish for a QR/link anyone can open"
          >
            New public vote
          </button>
        )}
        {multiUser && onOpenRooms && (
          <button
            onClick={onOpenRooms}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-lg bg-voice-accent/90 hover:bg-voice-accent text-white transition-colors"
            title="Manage rooms and create room ballots"
          >
            <Users size={12} /> Rooms
          </button>
        )}
        <button
          onClick={onNewRound}
          className="px-3 py-2 text-[11px] font-medium rounded-lg bg-voice-card border border-voice-border text-voice-text hover:bg-voice-card/70 transition-colors"
          title="New round: regenerate returned ballots back into the Inbox"
        >
          New round
        </button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-3 py-2 text-[11px] flex items-center justify-between gap-3 ${
          toast.kind === 'ok'
            ? 'bg-voice-surface border-voice-positive/30 text-voice-text'
            : toast.kind === 'err'
              ? 'bg-voice-surface border-voice-negative/30 text-voice-text'
              : 'bg-voice-surface border-voice-border text-voice-text-secondary'
        }`}>
          <span className="truncate">{toast.text}</span>
          <button
            onClick={clearToast}
            className="text-voice-text-tertiary hover:text-voice-text transition-colors"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {fetchError ? (
        <div className="bg-voice-surface rounded-xl p-10 text-center border border-voice-negative/30">
          <p className="text-voice-negative text-sm font-medium">Failed to load ballots</p>
          <p className="text-voice-text-tertiary text-xs mt-2">{fetchError}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 text-[11px] font-medium rounded-lg bg-voice-card border border-voice-border text-voice-text hover:bg-voice-card/70 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-voice-surface rounded-xl p-10 text-center border border-voice-border">
          <p className="text-voice-text-secondary text-sm font-medium">{emptyTitle}</p>
          <p className="text-voice-text-tertiary text-xs mt-2">{emptyHint}</p>
        </div>
      ) : filtered.map(ballot => {
        const total = ballot.items?.length || 0
        const voted = (ballot.items || []).filter(i => (i.votes || 0) !== 0).length
        const isResults = ballot.isResults === true
        const isClosed = ballot.status === 'closed'
        const isRoom = ballot.visibility === 'room'
        const isPublic = ballot.visibility === 'public'

        const statusIcon = isResults
          ? <BarChart3 size={11} className="text-voice-accent" />
          : isClosed
            ? <CheckCircle size={11} className="text-voice-text-secondary" />
            : ballot.status === 'completed'
              ? <CheckCircle size={11} className="text-voice-positive" />
              : ballot.status === 'passed'
                ? <SkipForward size={11} className={
                  ballot.triageAction === 'return'
                    ? 'text-voice-accent'
                    : ballot.passComment
                      ? 'text-voice-text-secondary'
                      : 'text-voice-text-tertiary'
                } />
                : <Clock size={11} className="text-voice-accent" />

        return (
          <button
            key={ballot.id}
            onClick={() => onSelect(ballot.id)}
            className="w-full bg-voice-surface rounded-xl p-4 border border-voice-border hover:border-voice-border-hover hover:bg-voice-card/30 transition-all text-left group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-voice-text truncate leading-snug">
                  {ballot.title}
                </h3>
                {(isRoom || isResults || isPublic) && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {isRoom && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-voice-card/60 border border-voice-border text-[9px] font-semibold text-voice-text-secondary">
                        <Users size={9} /> ROOM
                      </span>
                    )}
                    {isPublic && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-voice-card/60 border border-voice-border text-[9px] font-semibold text-voice-text-secondary">
                        PUBLIC {ballot.publicationStatus === 'published' ? '· LIVE' : '· DRAFT'}
                      </span>
                    )}
                    {isResults && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-voice-accent-soft text-[9px] font-semibold text-voice-accent">
                        <BarChart3 size={9} /> RESULTS
                      </span>
                    )}
                    {ballot.voterCount > 0 && (
                      <span className="text-[9px] text-voice-text-tertiary">{ballot.voterCount} voters</span>
                    )}
                    {isResults && ballot.sourceBallotId && (
                      <span className="text-[9px] text-voice-text-tertiary">src: {String(ballot.sourceBallotId).slice(0, 8)}</span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-voice-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                  {ballot.description || 'No description'}
                </p>

                {/* Metadata row */}
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="flex items-center gap-1 text-[10px] text-voice-text-secondary">
                    {statusIcon}
                    <span className="capitalize">
                      {isResults ? 'results'
                        : isClosed ? (isRoom ? 'closed (see results)' : 'closed')
                        : ballot.status === 'passed'
                          ? (ballot.triageAction === 'return'
                            ? 'returned'
                            : ballot.passComment
                              ? 'pass+fb'
                              : 'pass')
                          : ballot.status}
                    </span>
                  </span>
                  <span className="text-voice-border">·</span>
                  <span className="text-[10px] text-voice-text-tertiary">
                    {voted}/{total} items
                  </span>
                  {typeof ballot.creditsUsed === 'number' && ballot.creditsUsed > 0 && (
                    <>
                      <span className="text-voice-border">·</span>
                      <span className="text-[10px] text-voice-text-tertiary">
                        {ballot.creditsUsed}c used
                      </span>
                    </>
                  )}
                </div>

                {/* Timestamp */}
                <p className="text-[10px] text-voice-text-tertiary mt-1.5">
                  {ballot.status === 'completed'
                    ? formatRelative(ballot.votedAt)
                    : ballot.status === 'passed'
                      ? formatRelative(ballot.triageAction === 'return' ? ballot.returnedAt : ballot.passedAt)
                      : formatRelative(ballot.created)}
                </p>
              </div>
              <ChevronRight size={16} className="text-voice-text-tertiary group-hover:text-voice-text-secondary transition-colors mt-1 flex-shrink-0" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
