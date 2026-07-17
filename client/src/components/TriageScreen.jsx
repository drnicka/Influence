import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

const ACTIONS = {
  pass: {
    label: 'Pass',
    signal: 'Weak rejection — not now, not never.',
    placeholder: 'Why is this a pass? (optional, but agents learn from it)',
    requireReason: false,
  },
  return: {
    label: 'Return',
    signal: 'Regenerate — this feedback becomes the next version.',
    placeholder: 'What should change? The agent rebuilds this ballot from your words.',
    requireReason: true,
  },
  burn: {
    label: 'Burn',
    signal: "Didn't meet your standards — say why so agents stop producing it.",
    placeholder: 'What standard did this fail?',
    requireReason: true,
  },
}

export default function TriageScreen({ ballot, onPass, onClose }) {
  const [comment, setComment] = useState('')
  const [selected, setSelected] = useState(null)

  const spec = selected ? ACTIONS[selected] : null
  const canConfirm = spec && (!spec.requireReason || comment.trim().length > 0)

  function confirm() {
    if (!canConfirm) return
    onPass?.(ballot.id, { action: selected, comment: comment.trim() })
  }

  return (
    <div className="pb-8">
      <div className="px-[18px] pt-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-voice-text-secondary hover:text-voice-text transition-colors"
        >
          <ArrowLeft size={13} />
          Back
        </button>
      </div>

      <div className="px-[18px] mt-4">
        <div className="bg-voice-surface rounded-2xl border border-voice-border p-5">
          <h2 className="text-sm font-semibold text-voice-text">Triage this ballot</h2>
          <p className="text-[11px] text-voice-text-secondary mt-1 leading-relaxed">
            Rejection is signal too. Pass = weak rejection · Return = regenerate from feedback · Burn = didn't meet standards.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(ACTIONS).map(([id, a]) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`h-10 rounded-xl text-[11px] font-medium transition-colors border ${
                  selected === id
                    ? id === 'burn'
                      ? 'bg-voice-negative/15 border-voice-negative text-voice-negative'
                      : 'bg-voice-card border-voice-accent/60 text-voice-text'
                    : id === 'burn'
                      ? 'bg-voice-negative/10 border-voice-negative/30 text-voice-negative hover:bg-voice-negative/15'
                      : 'bg-voice-card border-voice-border text-voice-text-secondary hover:text-voice-text hover:bg-voice-card/70'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {spec && (
            <div className="mt-4">
              <p className="text-[11px] text-voice-text-secondary">{spec.signal}</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={spec.placeholder}
                className="mt-2 w-full min-h-[90px] rounded-xl bg-voice-card/40 border border-voice-border px-3 py-2 text-[12px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/50"
              />
              <button
                onClick={confirm}
                disabled={!canConfirm}
                className="mt-3 w-full h-10 rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[11px] font-semibold transition-colors disabled:opacity-40"
              >
                {spec.requireReason && !comment.trim() ? `${spec.label} — reason required` : `Confirm ${spec.label.toLowerCase()}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
