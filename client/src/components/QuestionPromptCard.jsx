export default function QuestionPromptCard({ item }) {
  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      {/* Header */}
      <div className="px-[18px] py-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-voice-text-tertiary">
            QUESTION
          </p>
          <p className="text-[11px] text-voice-text-secondary leading-relaxed">
            Submitted by <span className="text-voice-text font-medium">{item.submittedBy || 'Agent'}</span>
          </p>
        </div>
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-voice-card/60 border border-voice-border flex items-center justify-center">
          <span className="text-[18px] font-black text-voice-accent">?</span>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-[18px] border-t border-voice-border" />

      {/* Prompt */}
      <div className="px-[18px] py-5">
        <h3 className="text-[17px] font-extrabold text-voice-text leading-[1.2]">
          {item.title}
        </h3>

        {item.body && item.body.trim() && (
          <p className="mt-3 text-[13px] text-voice-text-secondary leading-[1.75] whitespace-pre-line">
            {item.body}
          </p>
        )}

        <div className="mt-4 bg-voice-card/30 border border-voice-border rounded-xl p-3">
          <p className="text-[11px] text-voice-text-tertiary">
            Comment guidance: answer in 2–6 bullets. Include (1) definition, (2) edge case, (3) what would change your mind.
          </p>
        </div>
      </div>
    </div>
  )
}
