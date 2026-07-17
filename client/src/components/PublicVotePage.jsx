import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import VoteControls from './VoteControls'
import VoteBalance from './VoteBalance'
import VoteDistributor from './VoteDistributor'
import StatementCard from './StatementCard'
import PublicStatementCard from './PublicStatementCard'

function PublicAccessGate({ ballot, name, setName, password, setPassword, onContinue, gateError }) {
  return (
    <div className="min-h-screen bg-voice-bg flex items-center justify-center p-4" data-1p-ignore="true">
      <div className="w-full max-w-sm bg-voice-surface border border-voice-border rounded-2xl p-6">
        <h1 className="text-[17px] font-bold text-voice-text mb-1">Public vote</h1>
        <p className="text-[12px] text-voice-text-secondary mb-2">{ballot?.title || 'Ballot'}</p>
        <p className="text-[11px] text-voice-text-tertiary mb-6">Enter your name{ballot?.passwordRequired ? ' and ballot password' : ''} to continue.</p>

        {gateError ? (
          <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/5 text-[12px] text-red-300">
            {gateError}
          </div>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-voice-text-secondary mb-1">Your name</label>
            <input
              type="text"
              name="public_vote_display_name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Guest"
              autoComplete="off"
              data-1p-ignore="true"
              className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
              required
            />
          </div>

          {ballot?.passwordRequired ? (
            <div>
              <label className="block text-[11px] text-voice-text-secondary mb-1">Ballot password</label>
              <input
                type="password"
                name="ballot_access_code"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                data-1p-ignore="true"
                className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
                required
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={onContinue}
            className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors"
          >
            Continue to ballot
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PublicVotePage({ slug }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [ballot, setBallot] = useState(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [gateOpen, setGateOpen] = useState(true)
  const [gateError, setGateError] = useState(null)
  const [votes, setVotes] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/public/${slug}`)
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || `Failed to load (${res.status})`)
        if (cancelled) return
        setBallot(data)
        setVotes((data.items || []).map(item => ({ itemId: item.id, votes: 0, comment: '' })))
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  const totalCredits = ballot?.credits || 100
  const voteType = (ballot?.voteType || 'qv').toLowerCase()

  const creditsUsed = useMemo(() => {
    if (voteType === 'binary') return votes.reduce((sum, v) => sum + (v.votes ? 1 : 0), 0)
    return votes.reduce((sum, v) => sum + ((v.votes || 0) * (v.votes || 0)), 0)
  }, [votes, voteType])

  const creditsRemaining = totalCredits - creditsUsed

  function updateVote(index, newVoteCount) {
    const next = [...votes]
    if (voteType === 'binary') {
      for (let i = 0; i < next.length; i++) next[i] = { ...next[i], votes: 0 }
      next[index] = { ...next[index], votes: newVoteCount ? 1 : 0 }
      setVotes(next)
      return
    }
    const oldCost = (next[index].votes || 0) ** 2
    const newCost = (newVoteCount || 0) ** 2
    if (creditsRemaining - (newCost - oldCost) < 0) return
    next[index] = { ...next[index], votes: newVoteCount }
    setVotes(next)
  }

  function updateComment(index, comment) {
    const next = [...votes]
    next[index] = { ...next[index], comment }
    setVotes(next)
  }

  function navigateToItem(index) {
    const total = ballot?.items?.length || 0
    if (index >= 0 && index < total) setCurrentIndex(index)
  }

  function continueFromGate() {
    setGateError(null)
    if (!name.trim()) {
      setGateError('Name is required')
      return
    }
    if (ballot?.passwordRequired && !password.trim()) {
      setGateError('Ballot password is required')
      return
    }
    setGateOpen(false)
  }

  async function submit(e) {
    e.preventDefault()
    if (!ballot) return
    try {
      setSubmitting(true)
      setError(null)
      setResult(null)

      const payload = {
        name: name.trim(),
        votes: votes.map(v => ({ itemId: v.itemId, votes: Number(v.votes || 0), comment: v.comment || '' })),
      }
      if (ballot.passwordRequired) payload.password = password

      const res = await fetch(`/api/public/${slug}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Submit failed (${res.status})`)
      setResult(data)
    } catch (err) {
      setError(err.message)
      if (String(err.message || '').toLowerCase().includes('password')) {
        setGateOpen(true)
        setGateError('Password was rejected, please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-voice-bg text-voice-text p-6">Loading public ballot…</div>
  if (error && !ballot) return <div className="min-h-screen bg-voice-bg text-red-300 p-6">{error}</div>
  if (gateOpen) return <PublicAccessGate ballot={ballot} name={name} setName={setName} password={password} setPassword={setPassword} onContinue={continueFromGate} gateError={gateError} />

  const items = ballot?.items || []
  const currentItem = items[currentIndex]
  const currentVote = votes[currentIndex] || { votes: 0, comment: '' }

  return (
    <div className="min-h-screen bg-voice-bg text-voice-text p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-voice-surface border border-voice-border rounded-2xl p-5 md:p-7">
          <p className="text-xs text-voice-text-secondary mb-2">Public vote</p>
          <h1 className="text-2xl font-semibold mb-2">{ballot.title}</h1>
          {ballot.description ? <p className="text-voice-text-secondary mb-4">{ballot.description}</p> : null}
          <p className="text-[12px] text-voice-text-secondary mb-5">Vote on the statements you agree with most strongly. Spread your credits to express priority and conviction.</p>

          <VoteBalance creditsUsed={creditsUsed} totalCredits={totalCredits} />

          <div className="mt-4">
            <div className="flex items-center justify-between py-3 border-t border-b border-voice-border">
              <button
                onClick={() => navigateToItem(currentIndex - 1)}
                disabled={currentIndex === 0}
                className={`text-xs font-medium flex items-center gap-1 ${currentIndex === 0 ? 'text-voice-border' : 'text-voice-text-secondary hover:text-voice-text'}`}
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-voice-text mr-2">Q{currentIndex + 1}</span>
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateToItem(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentIndex ? 'bg-voice-accent w-4' : (votes[i]?.votes || 0) !== 0 ? 'bg-voice-muted' : 'bg-voice-border'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => navigateToItem(currentIndex + 1)}
                disabled={currentIndex === items.length - 1}
                className={`text-xs font-medium flex items-center gap-1 ${currentIndex === items.length - 1 ? 'text-voice-border' : 'text-voice-text-secondary hover:text-voice-text'}`}
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {currentItem && (
            <div className="mt-4">
              {(String(currentItem.type || '').toLowerCase() === 'public_statement')
                ? <PublicStatementCard item={{ ...currentItem, submittedBy: currentItem.submittedBy || 'Community' }} />
                : <StatementCard item={{ ...currentItem, type: 'statement', submittedBy: currentItem.submittedBy || 'Community' }} />}
            </div>
          )}

          {currentItem && (
            <div className="mt-4">
              <VoteControls
                voteType={voteType}
                voteCount={currentVote.votes}
                creditsCost={voteType === 'binary' ? (currentVote.votes ? 1 : 0) : (currentVote.votes * currentVote.votes)}
                creditsRemaining={creditsRemaining}
                onChange={(newCount) => updateVote(currentIndex, newCount)}
                comment={currentVote.comment}
                onCommentChange={(comment) => updateComment(currentIndex, comment)}
              />
            </div>
          )}

          <div className="mt-6">
            <VoteDistributor
              items={items}
              votes={votes}
              currentIndex={currentIndex}
              onNavigate={navigateToItem}
              onUpdateVote={updateVote}
              creditsRemaining={creditsRemaining}
              voteType={voteType}
            />
          </div>

          {error ? <div className="text-sm text-red-300 mt-4">{error}</div> : null}
          {result?.ok ? <div className="text-sm text-green-300 mt-4">Vote submitted. Thank you.</div> : null}

          <form onSubmit={submit} className="mt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-[45px] bg-voice-accent/90 hover:bg-voice-accent rounded-xl text-[11px] font-semibold text-white transition-colors flex items-center justify-center gap-2 tracking-wide disabled:opacity-60"
            >
              <Send size={12} /> {submitting ? 'Submitting…' : 'Submit your vote'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
