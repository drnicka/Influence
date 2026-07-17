export default function ImageCard({ item }) {
  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      <div className="bg-black/20 flex items-center justify-center">
        <img
          src={item.imageUrl}
          alt={item.title || ''}
          className="max-h-[420px] w-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="px-[18px] py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-voice-text leading-snug truncate">{item.title}</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-voice-card/70 text-voice-text-secondary border border-voice-border flex-shrink-0">
            IMAGE
          </span>
        </div>
        {item.body && (
          <p className="mt-1.5 text-[12px] text-voice-text-secondary leading-relaxed">{item.body}</p>
        )}
      </div>
    </div>
  )
}
