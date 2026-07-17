export default function PublicStatementCard({ item }) {
  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      <div className="px-[18px] py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-voice-text-tertiary">
            PUBLIC STATEMENT
          </p>
          <p className="text-[11px] text-voice-text-secondary leading-relaxed">
            Submitted by <span className="text-voice-text font-medium">{item.submittedBy || 'Community'}</span>
          </p>
        </div>
        {item.semanticTag && (
          <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 bg-voice-accent-soft rounded-md text-[10px] text-voice-accent font-medium">
            {item.semanticTag}
          </span>
        )}
      </div>

      <div className="mx-[18px] border-t border-voice-border" />

      <div className="px-[18px] py-5">
        <h3 className="text-[19px] font-black uppercase tracking-tight text-voice-text leading-[1.15]">
          {item.title}
        </h3>

        {item.body && item.body.trim() && (
          <div className="mt-4 rounded-lg border border-voice-border bg-voice-card/30 p-3">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-voice-text-tertiary mb-1">EXPLANATION</p>
            <p className="text-[13px] text-voice-text-secondary leading-[1.65] whitespace-pre-line">
              {item.body}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
