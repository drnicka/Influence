export default function StatementCard({ item }) {
  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      {/* Header */}
      <div className="px-[18px] py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-voice-text-tertiary">
            STATEMENT
          </p>
          <p className="text-[11px] text-voice-text-secondary leading-relaxed">
            Submitted by <span className="text-voice-text font-medium">{item.submittedBy || 'Agent'}</span>
          </p>
        </div>
        {item.semanticTag && (
          <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 bg-voice-accent-soft rounded-md text-[10px] text-voice-accent font-medium">
            {item.semanticTag}
          </span>
        )}
      </div>

      {/* Separator */}
      <div className="mx-[18px] border-t border-voice-border" />

      {/* Title-first content */}
      <div className="px-[18px] py-5">
        <h3 className="text-[19px] font-black uppercase tracking-tight text-voice-text leading-[1.15]">
          {item.title}
        </h3>

        {/* Optional body (rare for statements). Keep subdued. */}
        {item.body && item.body.trim() && (
          <p className="mt-3 text-[13px] text-voice-text-secondary leading-[1.7] whitespace-pre-line">
            {item.body}
          </p>
        )}

        <p className="mt-4 text-[11px] text-voice-text-tertiary">
          Tip: use the comment box to define terms, give a counterexample, or say what would change your mind.
        </p>
      </div>
    </div>
  )
}
