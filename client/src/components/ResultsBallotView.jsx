import { ArrowLeft } from 'lucide-react'

export default function ResultsBallotView({ ballot, onBack }) {
  const items = ballot.items || []
  const voters = ballot.voters || []
  const voterCount = ballot.voterCount || voters.length

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-[18px] pt-2 pb-1">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-voice-text-secondary hover:text-voice-text transition-colors"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <span className="text-[10px] px-2 py-1 rounded-md bg-voice-accent-soft text-voice-accent font-semibold">
            RESULTS
          </span>
        </div>

        <h2 className="text-[17px] font-bold text-voice-text leading-snug mb-2">{ballot.title}</h2>
        <p className="text-[13px] text-voice-text-secondary leading-relaxed">{ballot.description}</p>

        {/* Voters summary */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-voice-text-tertiary">{voterCount} voter{voterCount !== 1 ? 's' : ''}:</span>
          {voters.map(v => (
            <span key={v} className="px-2 py-0.5 rounded-md bg-voice-card border border-voice-border text-[11px] text-voice-text font-medium">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Results items — ranked by totalVotes */}
      <div className="px-[18px] mt-5 space-y-3">
        {items.map((item, i) => {
          const totalVotes = item.totalVotes || 0
          const totalCredits = item.totalCreditsCost || 0
          const avg = item.averageVotes || 0
          const breakdown = item.voterBreakdown || []
          const comments = (item.comments || []).filter(Boolean)

          return (
            <div key={item.id} className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
              {/* Rank + title */}
              <div className="px-4 py-3 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-voice-accent/20 text-voice-accent' : 'bg-voice-card text-voice-text-secondary'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-voice-text leading-snug">{item.title}</h3>
                  {item.semanticTag && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-voice-accent-soft rounded-md text-[10px] text-voice-accent font-medium">
                      {item.semanticTag}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-[20px] font-bold tabular-nums ${totalVotes > 0 ? 'text-voice-positive' : totalVotes < 0 ? 'text-voice-negative' : 'text-voice-text-secondary'}`}>
                    {totalVotes > 0 ? '+' : ''}{totalVotes}
                  </div>
                  <div className="text-[10px] text-voice-text-tertiary">{totalCredits} credits</div>
                </div>
              </div>

              {/* Per-voter breakdown */}
              <div className="mx-4 border-t border-voice-border" />
              <div className="px-4 py-2.5 space-y-1.5">
                <p className="text-[10px] font-semibold text-voice-text-tertiary tracking-wide mb-1">VOTER BREAKDOWN</p>
                {breakdown.map(vb => (
                  <div key={vb.handle || vb.memberId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-[9px] font-semibold text-voice-text-secondary flex-shrink-0">
                        {(vb.handle || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-[12px] text-voice-text font-medium truncate">{vb.handle}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[13px] font-bold tabular-nums ${
                        vb.votes > 0 ? 'text-voice-positive' : vb.votes < 0 ? 'text-voice-negative' : 'text-voice-text-secondary'
                      }`}>
                        {vb.votes > 0 ? '+' : ''}{vb.votes}
                      </span>
                      <span className="text-[10px] text-voice-text-tertiary w-12 text-right">{vb.creditsCost}cr</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t border-voice-border/50">
                  <span className="text-[11px] text-voice-text-secondary">Average</span>
                  <span className="text-[12px] font-semibold text-voice-text tabular-nums">{avg}</span>
                </div>
              </div>

              {/* Comments */}
              {comments.length > 0 && (
                <>
                  <div className="mx-4 border-t border-voice-border" />
                  <div className="px-4 py-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold text-voice-text-tertiary tracking-wide mb-1">COMMENTS</p>
                    {breakdown.filter(vb => vb.comment).map(vb => (
                      <div key={vb.handle + '-comment'} className="flex gap-2">
                        <span className="text-[11px] text-voice-accent font-medium flex-shrink-0">{vb.handle}:</span>
                        <span className="text-[12px] text-voice-text-secondary leading-relaxed">{vb.comment}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-[18px] mt-10 pb-4 flex items-center justify-between">
        <span className="text-[10px] text-voice-text-tertiary">personal#voice &middot; Powered by Factory Labs</span>
        <span className="text-[10px] text-voice-text-tertiary">&copy; 2026</span>
      </div>
    </div>
  )
}
