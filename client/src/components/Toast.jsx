export default function Toast({ toast, onClose }) {
  if (!toast) return null

  const color =
    toast.kind === 'ok'
      ? 'border-emerald-500/40 text-emerald-200'
      : toast.kind === 'err'
      ? 'border-red-500/40 text-red-200'
      : toast.kind === 'info'
      ? 'border-sky-500/40 text-sky-200'
      : 'border-voice-border text-voice-text'

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-50 w-[min(720px,calc(100vw-24px))]">
      <div className={`bg-voice-surface/95 backdrop-blur border ${color} rounded-xl px-4 py-3 shadow-xl flex items-center gap-3`}>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] leading-snug truncate">{toast.text}</div>
        </div>

        {toast.actionLabel && toast.onAction && (
          <button
            onClick={toast.onAction}
            className="px-3 py-1.5 rounded-lg bg-voice-accent text-voice-bg text-[12px] font-semibold"
          >
            {toast.actionLabel}
          </button>
        )}

        <button
          onClick={onClose}
          className="px-2 py-1 rounded-lg border border-voice-border text-voice-text-secondary text-[12px]"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}
