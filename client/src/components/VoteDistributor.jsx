import { useState } from 'react'
import { ChevronRight, Minus, Plus } from 'lucide-react'

export default function VoteDistributor({ items, votes, currentIndex, onNavigate, onUpdateVote, creditsRemaining, voteType = 'qv', onExecute }) {
  const [expandedItems, setExpandedItems] = useState({})

  function toggleExpand(index) {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      <div className="px-[18px] py-3.5">
        <span className="text-[13px] font-medium text-voice-text">Vote Distributor</span>
      </div>

      <div className="divide-y divide-voice-border">
        {items.map((item, i) => {
          const vote = votes[i]
          const creditsCost = voteType === 'binary' ? (vote.votes ? 1 : 0) : (vote.votes * vote.votes)
          const isActive = i === currentIndex
          const isExpanded = expandedItems[i]

          return (
            <div key={item.id}>
              {/* Row — Figma: arrow + Q label + credit value, 60px height */}
              <div
                className={`flex items-center h-[52px] px-[18px] gap-3 transition-colors ${
                  isActive ? 'bg-voice-card/40' : 'hover:bg-voice-card/20'
                }`}
              >
                <button
                  onClick={() => toggleExpand(i)}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  <ChevronRight size={11} className={`text-voice-text-tertiary flex-shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90 text-voice-accent' : ''
                  }`} />
                  <span className="text-[13px] font-medium text-voice-text-secondary">Q{i + 1}</span>
                </button>

                {/* Inline +/- controls */}
                {onUpdateVote && (
                  <div className="flex items-center gap-1.5">
                    {voteType === 'binary' ? (
                      <button
                        onClick={() => {
                          if (vote.votes) return
                          onExecute ? onExecute(i) : onUpdateVote(i, 1)
                        }}
                        className={`h-7 px-2 rounded-full border flex items-center justify-center transition-colors text-[10px] font-semibold ${
                          vote.votes ? 'bg-voice-accent/90 border-voice-accent text-white' : 'bg-voice-card border-voice-border text-voice-text-secondary hover:bg-voice-card/70'
                        }`}
                        title={vote.votes ? 'Selected' : 'Execute this option'}
                      >
                        {vote.votes ? 'Selected' : 'Execute'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            const newCount = vote.votes - 1
                            const newCost = newCount * newCount
                            const costDelta = newCost - creditsCost
                            if (costDelta <= creditsRemaining) onUpdateVote(i, newCount)
                          }}
                          className="w-7 h-7 rounded-full bg-voice-card border border-voice-border flex items-center justify-center hover:bg-voice-negative-soft hover:border-voice-negative/30 transition-colors"
                        >
                          <Minus size={10} className="text-voice-text-secondary" />
                        </button>

                        <button
                          onClick={() => {
                            const newCount = vote.votes + 1
                            const newCost = newCount * newCount
                            const costDelta = newCost - creditsCost
                            if (costDelta <= creditsRemaining) onUpdateVote(i, newCount)
                          }}
                          className="w-7 h-7 rounded-full bg-voice-card border border-voice-border flex items-center justify-center hover:bg-voice-positive-soft hover:border-voice-positive/30 transition-colors"
                        >
                          <Plus size={10} className="text-voice-text-secondary" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Credits display */}
                <div className="text-right min-w-[36px]">
                  <span className={`text-[13px] font-bold tabular-nums ${
                    vote.votes > 0 ? 'text-voice-positive' : vote.votes < 0 ? 'text-voice-negative' : 'text-voice-text-tertiary'
                  }`}>
                    {creditsCost}
                  </span>
                </div>
              </div>

              {/* Expanded card content (rollback: keep this as a simple one-liner, no markdown/body rendering) */}
              {isExpanded && (
                <div className="px-[18px] pb-3 bg-voice-card/20">
                  <div className="pl-6 border-l border-voice-border ml-0.5">
                    <p className="text-[12px] font-medium text-voice-text leading-snug truncate">
                      {item.title}
                    </p>
                    {item.semanticTag && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] bg-voice-accent-soft text-voice-accent font-medium">
                        {item.semanticTag}
                      </span>
                    )}
                    <button
                      onClick={() => onNavigate(i)}
                      className="mt-2 text-[11px] text-voice-accent hover:underline"
                    >
                      Go to card
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
