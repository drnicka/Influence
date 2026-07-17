import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'

export default function ResultsChart({ items, votes, totalCredits, isCompleted, onRevote }) {
  // Build sorted list by absolute vote count descending (priority order)
  const sorted = useMemo(() => {
    return items
      .map((item, i) => {
        const voteCount = votes[i]?.votes ?? item.votes ?? 0
        const creditsCost = voteCount * voteCount
        return { item, voteCount, creditsCost, originalIndex: i }
      })
      .sort((a, b) => Math.abs(b.voteCount) - Math.abs(a.voteCount))
  }, [items, votes])

  const maxCredits = Math.max(...sorted.map(s => s.creditsCost), 1)

  return (
    <div className="space-y-4">
      <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
        <div className="px-[18px] py-3.5 border-b border-voice-border flex items-center justify-between">
          <span className="text-[13px] font-medium text-voice-text">Priority Ranking</span>
          <span className="text-[11px] text-voice-text-tertiary">
            {votes.reduce((s, v) => s + v.votes * v.votes, 0)} / {totalCredits} credits
          </span>
        </div>

        <div className="p-[18px] space-y-4">
          {sorted.map((entry, rank) => {
            const { item, voteCount, creditsCost } = entry
            const barWidth = maxCredits > 0 ? (creditsCost / maxCredits) * 100 : 0

            return (
              <div key={item.id}>
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`text-[11px] font-bold flex-shrink-0 w-5 text-center tabular-nums ${
                      rank === 0 ? 'text-voice-accent' : 'text-voice-text-tertiary'
                    }`}>
                      {rank + 1}
                    </span>
                    <span className="text-[11px] text-voice-text truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`text-[11px] font-bold tabular-nums ${
                      voteCount > 0 ? 'text-voice-positive' : voteCount < 0 ? 'text-voice-negative' : 'text-voice-text-tertiary'
                    }`}>
                      {voteCount > 0 ? '+' : ''}{voteCount}
                    </span>
                    <span className="text-[10px] text-voice-text-tertiary tabular-nums">{creditsCost}c</span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-5 bg-voice-card rounded overflow-hidden relative">
                  {voteCount !== 0 && (
                    <div
                      className={`absolute top-0 h-full rounded transition-all duration-500 ${
                        voteCount > 0
                          ? 'bg-voice-positive/20 left-0'
                          : 'bg-voice-negative/20 right-0'
                      }`}
                      style={{ width: `${Math.max(barWidth, 4)}%` }}
                    >
                      <div
                        className={`absolute top-0 h-full rounded ${
                          voteCount > 0 ? 'bg-voice-positive/50 left-0' : 'bg-voice-negative/50 right-0'
                        }`}
                        style={{ width: '60%' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-[18px] pb-3.5 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-voice-positive/50" />
            <span className="text-[10px] text-voice-text-tertiary">Agree</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-voice-negative/50" />
            <span className="text-[10px] text-voice-text-tertiary">Disagree</span>
          </div>
        </div>
      </div>

      {/* Re-vote button */}
      {isCompleted && onRevote && (
        <button
          onClick={onRevote}
          className="w-full h-[45px] bg-voice-card hover:bg-voice-card-hover rounded-xl text-[11px] font-semibold text-voice-text transition-colors border border-voice-border flex items-center justify-center gap-2"
        >
          <RefreshCw size={12} />
          Re-vote (creates new version)
        </button>
      )}
    </div>
  )
}
