import { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Send } from 'lucide-react'
import QuestionCard from './QuestionCard'
import VoteControls from './VoteControls'
import VoteBalance from './VoteBalance'
import VoteDistributor from './VoteDistributor'
import ResultsChart from './ResultsChart'
import TriageScreen from './TriageScreen'
import MetadataTable from './MetadataTable'
import OpinionFeed from './OpinionFeed'
import { apiGet } from '../api'

export default function BallotView({ ballot, onSubmitVotes, onRevote, onPass, onBack, onPublishPublic, onClosePublic }) {
  const [showTriage, setShowTriage] = useState(false)

  const items = ballot.items || []
  const totalCredits = ballot.credits || 100
  const voteType = (ballot.voteType || 'qv').toLowerCase()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [votes, setVotes] = useState(() =>
    items.map(item => ({
      itemId: item.id,
      votes: item.votes || 0,
      comment: item.comment || '',
      layout: item.layout || '',
      imagePrompt: item.imagePrompt || ''
    }))
  )
  const isCompleted = ballot.status === 'completed'
  const isResults = !!ballot.isResults
  const isPublicDraft = ballot.visibility === 'public' && ballot.publicationStatus !== 'published'
  const isPublicPublished = ballot.visibility === 'public' && ballot.publicationStatus === 'published'

  // QR for the public vote link — fetched with auth, rendered inline
  const [qrSvg, setQrSvg] = useState(null)
  useEffect(() => {
    setQrSvg(null)
    if (!isPublicPublished || ballot.status !== 'open') return
    apiGet(`/ballots/${ballot.id}/qr.svg`)
      .then(r => (r.ok ? r.text() : null))
      .then(svg => setQrSvg(svg))
      .catch(() => {})
  }, [ballot.id, isPublicPublished, ballot.status])
  // Results as the hero: completed and results ballots open on their weighted outcome
  const [activeTab, setActiveTab] = useState(isCompleted || isResults ? 'results' : 'votes')
  const isReadOnly = isCompleted

  const creditsUsed = useMemo(() => {
    // Results ballots: use server-computed creditsCost (sum of all voters' quadratic costs)
    if (isResults) {
      return items.reduce((sum, item) => sum + (item.creditsCost || 0), 0)
    }
    if (voteType === 'binary' || voteType === 'execution') return votes.reduce((sum, v) => sum + (v.votes ? 1 : 0), 0)
    return votes.reduce((sum, v) => sum + v.votes * v.votes, 0)
  }, [votes, voteType, isResults, items])

  const creditsRemaining = totalCredits - creditsUsed

  function updateVote(index, newVoteCount) {
    const newVotes = [...votes]
    if (voteType === 'binary') {
      const next = newVoteCount ? 1 : 0
      for (let i = 0; i < newVotes.length; i++) newVotes[i] = { ...newVotes[i], votes: 0 }
      newVotes[index] = { ...newVotes[index], votes: next }
      setVotes(newVotes)
      return
    }
    const oldCost = newVotes[index].votes * newVotes[index].votes
    const newCost = newVoteCount * newVoteCount
    if (creditsRemaining - (newCost - oldCost) < 0) return
    newVotes[index] = { ...newVotes[index], votes: newVoteCount }
    setVotes(newVotes)
  }

  function updateComment(index, comment) {
    const newVotes = [...votes]
    newVotes[index] = { ...newVotes[index], comment }
    setVotes(newVotes)
  }

  function updateLayout(index, layout) {
    const newVotes = [...votes]
    newVotes[index] = { ...newVotes[index], layout }
    setVotes(newVotes)
  }

  function updateImagePrompt(index, imagePrompt) {
    const newVotes = [...votes]
    newVotes[index] = { ...newVotes[index], imagePrompt }
    setVotes(newVotes)
  }

  function executeBinaryAt(index) {
    const newVotes = votes.map((v, i) => ({ ...v, votes: i === index ? 1 : 0 }))
    setVotes(newVotes)
    onSubmitVotes(ballot.id, newVotes)
  }

  function navigateToItem(index) {
    if (index >= 0 && index < items.length) setCurrentIndex(index)
  }

  const currentItem = items[currentIndex]
  const currentVote = votes[currentIndex]

  const tabs = [
    { id: 'votes', label: 'Votes' },
    { id: 'results', label: 'Weighted intents' },
    { id: 'opinions', label: 'Opinions' },
  ]

  if (showTriage) {
    return <TriageScreen ballot={ballot} onPass={onPass} onClose={() => setShowTriage(false)} />
  }

  return (
    <div className="pb-8">
      {/* Header bar */}
      <div className="px-[18px] pt-2 pb-1">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-voice-text-secondary hover:text-voice-text transition-colors"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="flex items-center gap-3">
            {isPublicDraft && ballot.status === 'open' && (
              <button
                onClick={() => onPublishPublic?.(ballot.id)}
                className="text-[11px] text-voice-accent hover:text-voice-text transition-colors"
              >
                Publish — get link + QR
              </button>
            )}
            {isPublicPublished && ballot.status === 'open' && (
              <>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/vote/${ballot.shareSlug}`
                    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
                  }}
                  className="text-[11px] text-voice-positive hover:text-voice-text transition-colors"
                  title="Copy public link"
                >
                  Copy link
                </button>
                <button
                  onClick={() => onClosePublic?.(ballot.id)}
                  className="text-[11px] text-voice-accent hover:text-voice-text transition-colors"
                  title="Stop accepting votes and tally results into your inbox"
                >
                  Close &amp; tally
                </button>
              </>
            )}
            {ballot.status === 'open' && !isPublicPublished && (
              <button
                onClick={() => setShowTriage(true)}
                className="text-[11px] text-voice-text-tertiary hover:text-voice-negative transition-colors"
              >
                Pass
              </button>
            )}
          </div>
        </div>

        <h2 className="text-[17px] font-bold text-voice-text leading-snug mb-2">{ballot.title}</h2>
        <p className="text-[13px] text-voice-text-secondary leading-relaxed">{ballot.description}</p>

        <MetadataTable ballot={ballot} items={items} />
        {isPublicPublished && ballot.status === 'open' && (
          <div className="mt-4 rounded-2xl border border-voice-border bg-white p-4 flex flex-col items-center gap-2">
            {qrSvg ? (
              <div className="w-full max-w-[300px] [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <p className="text-[11px] text-gray-500">Generating QR…</p>
            )}
            <p className="text-[11px] text-gray-600 font-medium break-all text-center">
              {window.location.origin}/vote/{ballot.shareSlug}
            </p>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="px-[18px] mt-3">
        <div className="flex gap-[19px]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-[106px] h-[44px] rounded-full text-[13px] font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-voice-card text-voice-text'
                  : 'border border-voice-border text-voice-text-secondary hover:text-voice-text hover:border-voice-border-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'votes' && (
        <>
          {!isResults && (
            <div className="px-[18px] mt-4">
              <VoteBalance creditsUsed={creditsUsed} totalCredits={totalCredits} />
            </div>
          )}

          {/* Card Navigator */}
          <div className="px-[18px] mt-4">
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
                      i === currentIndex ? 'bg-voice-accent w-4' : votes[i].votes !== 0 ? 'bg-voice-muted' : 'bg-voice-border'
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
            <div className="px-[18px] mt-4">
              <QuestionCard item={currentItem} index={currentIndex} />
            </div>
          )}

          {currentItem && !isReadOnly && (
            <div className="px-[18px] mt-4">
              <VoteControls
                voteType={voteType}
                voteCount={currentVote.votes}
                creditsCost={voteType === 'binary' || voteType === 'execution' ? (currentVote.votes ? 1 : 0) : (currentVote.votes * currentVote.votes)}
                creditsRemaining={creditsRemaining}
                onChange={(newCount) => updateVote(currentIndex, newCount)}
                comment={currentVote.comment}
                onCommentChange={(comment) => updateComment(currentIndex, comment)}

                // Slide layout controls (optional)
                itemType={currentItem?.type}
                layout={currentVote.layout}
                onLayoutChange={(layout) => updateLayout(currentIndex, layout)}
                imagePrompt={currentVote.imagePrompt}
                onImagePromptChange={(p) => updateImagePrompt(currentIndex, p)}

                onExecute={voteType === 'binary' ? () => onSubmitVotes(ballot.id, votes) : undefined}
              />
            </div>
          )}

          {currentItem && isReadOnly && (
            <div className="px-[18px] mt-4 space-y-3">
              <div className="bg-voice-surface rounded-xl p-4 border border-voice-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-voice-text-secondary">{isResults ? 'Combined votes' : 'Your vote'}</span>
                  <span className={`text-2xl font-bold ${currentItem.votes > 0 ? 'text-voice-positive' : currentItem.votes < 0 ? 'text-voice-negative' : 'text-voice-text-secondary'}`}>
                    {currentItem.votes > 0 ? '+' : ''}{currentItem.votes}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-voice-text-secondary">Credits spent</span>
                  <span className="text-sm text-voice-text">{currentItem.creditsCost}</span>
                </div>
              </div>
              {!isResults && currentItem.comment && (
                <div className="bg-voice-surface rounded-xl p-4 border border-voice-border">
                  <p className="text-xs text-voice-text-secondary mb-1">Your comment</p>
                  <p className="text-sm text-voice-text">{currentItem.comment}</p>
                </div>
              )}
            </div>
          )}

          {!isReadOnly && voteType !== 'binary' && (
            <div className="px-[18px] mt-4">
              <button
                onClick={() => onSubmitVotes(ballot.id, votes)}
                className="w-full h-[45px] bg-voice-accent/90 hover:bg-voice-accent rounded-xl text-[11px] font-semibold text-white transition-colors flex items-center justify-center gap-2 tracking-wide"
              >
                <Send size={12} />
                {voteType === 'execution'
                  ? `Submit decisions (${votes.filter(v => v.votes !== 0).length}/${items.length} decided)`
                  : 'Submit your vote'}
              </button>
            </div>
          )}

          <div className="px-[18px] mt-6">
            <VoteDistributor
              items={items}
              votes={votes}
              currentIndex={currentIndex}
              onNavigate={navigateToItem}
              onUpdateVote={!isReadOnly ? updateVote : undefined}
              creditsRemaining={creditsRemaining}
              voteType={voteType}
              onExecute={!isReadOnly && voteType === 'binary' ? executeBinaryAt : undefined}
            />
          </div>

          <div className="px-[18px] mt-4">
            <div className="bg-voice-surface rounded-xl p-[18px] border border-voice-border">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-voice-text">Total votes</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-voice-text tabular-nums">{creditsUsed}</span>
                  <p className="text-[10px] text-voice-text-tertiary">of {totalCredits}</p>
                </div>
              </div>
            </div>
          </div>

          {!isReadOnly && (
            <div className="px-[18px] mt-4 flex items-center justify-between">
              <button
                onClick={() => setVotes(items.map(item => ({ itemId: item.id, votes: 0, comment: '', layout: item.layout || '', imagePrompt: item.imagePrompt || '' })))}
                className="text-[11px] text-voice-text-tertiary hover:text-voice-accent transition-colors"
              >
                Clear all votes
              </button>
              {ballot.status === 'open' && (
                <button
                  onClick={() => setShowTriage(true)}
                  className="text-[11px] text-voice-text-tertiary hover:text-voice-negative transition-colors"
                >
                  Pass
                </button>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'results' && (
        <div className="px-[18px] mt-4 space-y-3">
          {isResults && (
            <div className="bg-voice-surface rounded-xl border border-voice-border p-4">
              <p className="text-xs text-voice-text-secondary">Results context</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="text-voice-text-secondary">Source ballot</div>
                <div className="text-voice-text text-right font-medium break-all">{ballot.sourceBallotId || '—'}</div>
                <div className="text-voice-text-secondary">Voters</div>
                <div className="text-voice-text text-right font-medium">{ballot.voterCount || ballot.voters?.length || '—'}</div>
              </div>
            </div>
          )}

          <ResultsChart
            items={items}
            votes={votes}
            totalCredits={totalCredits}
            isCompleted={isCompleted}
            onRevote={() => onRevote(ballot.id)}
          />
        </div>
      )}

      {activeTab === 'opinions' && isResults && (
        <OpinionFeed ballot={ballot} />
      )}

      {activeTab === 'opinions' && !isResults && (
        <div className="px-[18px] mt-4 space-y-3">
          {items.map((item, i) => {
            const comment = votes[i]?.comment || item.comment || ''
            const voteCount = votes[i]?.votes ?? item.votes ?? 0
            if (!comment) return null
            return (
              <div key={item.id} className="bg-voice-surface rounded-xl border border-voice-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-voice-text-secondary">Q{i + 1}</span>
                  <span className={`text-xs font-bold ${voteCount > 0 ? 'text-voice-positive' : voteCount < 0 ? 'text-voice-negative' : 'text-voice-text-secondary'}`}>
                    {voteCount > 0 ? '+' : ''}{voteCount} votes
                  </span>
                </div>
                <p className="text-sm font-medium text-voice-text mb-1 truncate">{item.title}</p>
                <p className="text-sm text-voice-text-secondary leading-relaxed">{comment}</p>
              </div>
            )
          })}
          {votes.every(v => !v.comment) && items.every(i => !i.comment) && (
            <div className="bg-voice-surface rounded-xl p-6 border border-voice-border text-center">
              <p className="text-sm text-voice-text-secondary">No opinions yet. Add comments when voting to build context for your agent.</p>
            </div>
          )}
        </div>
      )}

      <div className="px-[18px] mt-10 pb-4 flex items-center justify-between">
        <span className="text-[10px] text-voice-text-tertiary">personal#voice &middot; Powered by Factory Labs</span>
        <span className="text-[10px] text-voice-text-tertiary">&copy; 2026</span>
      </div>
    </div>
  )
}
