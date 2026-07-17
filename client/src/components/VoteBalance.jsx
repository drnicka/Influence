export default function VoteBalance({ creditsUsed, totalCredits }) {
  const remaining = totalCredits - creditsUsed
  const usedPercent = (creditsUsed / totalCredits) * 100

  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border p-[18px]">
      {/* Header row — Figma: "Vote Credit Balance" left, large number right */}
      <div className="flex items-start justify-between">
        <span className="text-[11px] text-voice-text-secondary">Vote Credit Balance</span>
        <span className="text-[28px] font-bold text-voice-text tabular-nums leading-none">{remaining}</span>
      </div>

      {/* Progress bar — Figma: 6px height */}
      <div className="mt-4 h-1.5 bg-voice-card rounded-full overflow-hidden flex">
        <div
          className="h-full bg-voice-accent rounded-full transition-all duration-300"
          style={{ width: `${usedPercent}%` }}
        />
      </div>

      {/* Labels — Figma: "Used X" left, "Available" right */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-voice-text-tertiary">Used {creditsUsed}</span>
        <span className="text-[11px] text-voice-text-tertiary">Available</span>
      </div>
    </div>
  )
}
