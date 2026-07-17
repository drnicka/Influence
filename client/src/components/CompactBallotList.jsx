export default function CompactBallotList({ ballots, onSelect, onNewRound }) {
  const open = (ballots || []).filter(b => b.status === 'open')
  const passed = (ballots || []).filter(b => b.status === 'passed')
  const completed = (ballots || []).filter(b => b.status === 'completed')

  function Section({ title, items }) {
    if (!items.length) return null
    return (
      <div className="mt-3">
        <p className="px-3 text-[10px] font-extrabold tracking-[0.22em] text-voice-text-tertiary">
          {title}
        </p>
        <div className="mt-2 space-y-2">
          {items.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect?.(b.id)}
              className="w-full text-left rounded-xl bg-voice-surface border border-voice-border px-3 py-2 hover:bg-voice-card/20 transition-colors"
            >
              <p className="text-[12px] font-semibold text-voice-text leading-snug line-clamp-2">
                {b.title}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-voice-text-tertiary capitalize">{b.status}</span>
                <span className="text-[10px] text-voice-text-tertiary tabular-nums">{new Date(b.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-voice-border flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.22em] text-voice-text-tertiary">INBOX</p>
          <p className="text-[11px] text-voice-text-secondary">{open.length} open</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewRound}
            className="h-8 px-3 rounded-xl bg-voice-card/30 border border-voice-border text-[11px] font-semibold text-voice-text-secondary hover:text-voice-text hover:bg-voice-card/40 transition-colors"
            title="New round"
          >
            Round
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        <Section title="OPEN" items={open} />
        <Section title="COMPLETED" items={completed.slice(0, 10)} />
        <Section title="PASSED" items={passed.slice(0, 10)} />
      </div>

      <div className="px-3 py-2 border-t border-voice-border">
        <p className="text-[10px] text-voice-text-tertiary">
          Desktop panel mode. Use Single for the calm one-rail view.
        </p>
      </div>
    </div>
  )
}
