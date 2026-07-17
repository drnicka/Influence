const TAGLINES = [
  'Where memory holds weight',
  'Turn preferences into execution',
  'Govern your agent with ballots',
  'Weighted memory, sharper decisions',
  'From slop to signal',
  'Choose what matters, then ship it',
  'Preference is a budget, spend it',
  'Make tradeoffs explicit',
  'A governor interface for thinking',
  'Vote, export, act',
]

function pickTagline() {
  // Rotate on refresh. Time bucketing avoids flicker during hot reload.
  const idx = Math.floor(Date.now() / 60_000) % TAGLINES.length
  return TAGLINES[idx]
}

export default function Header({ member, multiUser, onLogout }) {
  return (
    <div className="px-[18px] py-4 flex items-center justify-between border-b border-voice-border">
      <div className="flex items-baseline gap-3">
        <span className="text-[17px] font-bold text-voice-text tracking-tight">Influence</span>
        <span className="hidden sm:inline text-[11px] text-voice-text-tertiary">{pickTagline()}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-voice-text-tertiary">
          {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
        </span>

        {multiUser && member && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-[10px] font-semibold text-voice-text">
              {(member.handle || '?')[0].toUpperCase()}
            </div>
            <span className="text-[11px] text-voice-text font-medium">{member.handle}</span>
            <button
              onClick={onLogout}
              className="text-[10px] text-voice-text-tertiary hover:text-voice-text transition-colors"
            >
              switch member
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
