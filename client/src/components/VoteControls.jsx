import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

export default function VoteControls({
  voteType = 'qv',
  voteCount,
  creditsCost,
  creditsRemaining,
  onChange,
  comment,
  onCommentChange,
  onExecute,

  // Optional slide authoring controls
  itemType,
  layout,
  onLayoutChange,
  imagePrompt,
  onImagePromptChange,
}) {
  const [expanded, setExpanded] = useState(false)

  function increment() {
    if (voteType === 'binary') {
      onChange(1)
      return
    }
    const newCount = voteCount + 1
    const newCost = newCount * newCount
    const costDelta = newCost - creditsCost
    if (costDelta <= creditsRemaining) {
      onChange(newCount)
    }
  }

  function decrement() {
    if (voteType === 'binary') {
      onChange(0)
      return
    }
    const newCount = voteCount - 1
    const newCost = newCount * newCount
    const costDelta = newCost - creditsCost
    if (costDelta <= creditsRemaining) {
      onChange(newCount)
    }
  }

  const isExecution = voteType === 'execution'
  const isSlide = (itemType || '').toLowerCase() === 'slide'
  const layoutValue = layout || ''
  const isImageLayout = ['two-col', 'bg-hero', 'hero', 'full-bleed'].includes(layoutValue)

  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      <div className="px-[18px] py-3.5">
        <p className="text-[13px] font-medium text-voice-text">
          {isExecution ? 'Decide' : voteType === 'binary' ? 'Execute' : 'Place your vote'}
        </p>
      </div>

      {isExecution && (
        <div className="px-[18px] pb-3.5 grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange(voteCount === 1 ? 0 : 1)}
            className={`h-11 rounded-xl text-[13px] font-semibold border transition-colors ${
              voteCount === 1
                ? 'bg-voice-positive/20 border-voice-positive text-voice-positive'
                : 'bg-voice-card border-voice-border text-voice-text-secondary hover:text-voice-text hover:bg-voice-card/70'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(voteCount === -1 ? 0 : -1)}
            className={`h-11 rounded-xl text-[13px] font-semibold border transition-colors ${
              voteCount === -1
                ? 'bg-voice-negative/20 border-voice-negative text-voice-negative'
                : 'bg-voice-card border-voice-border text-voice-text-secondary hover:text-voice-text hover:bg-voice-card/70'
            }`}
          >
            No
          </button>
        </div>
      )}

      {/* Votes and Credits — Figma: large numbers with labels below */}
      <div className="px-[18px] pb-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className={`text-[28px] font-bold tabular-nums ${
              voteCount > 0 ? 'text-voice-positive' : voteCount < 0 ? 'text-voice-negative' : 'text-voice-text'
            }`}>{voteCount}</span>
            <p className="text-[11px] text-voice-text-secondary">Votes</p>
          </div>
          <div className="text-right">
            <span className="text-[28px] font-bold text-voice-text tabular-nums">{creditsCost}</span>
            <p className="text-[11px] text-voice-text-secondary">Credits</p>
          </div>
        </div>

        {/* Controls */}
        {!isExecution && (
        <div className="flex items-center gap-3">
          <button
            onClick={decrement}
            className="w-[45px] h-[45px] rounded-full bg-voice-card border border-voice-border flex items-center justify-center hover:bg-voice-negative-soft hover:border-voice-negative/30 transition-all active:scale-95 flex-shrink-0"
            title={voteType === 'binary' ? 'Deselect' : 'Decrement'}
          >
            <Minus size={16} className="text-voice-text" />
          </button>

          {/* Visual bar */}
          <div className="flex-1 h-[45px] bg-voice-card rounded-full border border-voice-border relative overflow-hidden">
            {voteCount !== 0 && (
              <div
                className={`absolute top-0 h-full transition-all duration-300 ${
                  voteType === 'binary'
                    ? 'bg-[#59EB2C] left-0'
                    : (voteCount > 0 ? 'bg-[#59EB2C] left-1/2' : 'bg-voice-negative/40 right-1/2')
                }`}
                style={{
                  width: voteType === 'binary'
                    ? '100%'
                    : `${Math.min(Math.abs(voteCount) * 5, 50)}%`,
                  borderRadius: voteType === 'binary'
                    ? '9999px'
                    : (voteCount > 0
                      ? '0 9999px 9999px 0'
                      : '9999px 0 0 9999px'),
                }}
              />
            )}
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5">
              <span className={`text-[13px] font-semibold ${
                voteCount > 0 ? 'text-voice-positive' : voteCount < 0 ? 'text-voice-negative' : 'text-voice-text-tertiary'
              }`}>
                {voteType === 'binary' ? (voteCount ? 'SELECTED' : '—') : (voteCount > 0 ? `+${voteCount}` : voteCount)}
              </span>
              <span className={`text-[11px] font-medium ml-1 ${voteCount > 0 ? 'text-black' : 'text-voice-text-secondary'}`}>
                {voteType === 'binary' ? 'Choice' : 'Vote'}
              </span>
            </div>
          </div>

          <button
            onClick={increment}
            className="w-[45px] h-[45px] rounded-full bg-voice-card border border-voice-border flex items-center justify-center hover:bg-voice-positive-soft hover:border-voice-positive/30 transition-all active:scale-95 flex-shrink-0"
            title={voteType === 'binary' ? 'Select' : 'Increment'}
          >
            <Plus size={16} className="text-voice-text" />
          </button>
        </div>
        )}

        {/* Binary: Execute means submit immediately */}
        {voteType === 'binary' && onExecute && (
          <div className="mt-4">
            <button
              onClick={onExecute}
              className={`w-full h-[45px] rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center gap-2 tracking-wide ${
                voteCount ? 'bg-voice-accent/90 hover:bg-voice-accent text-white' : 'bg-voice-card border border-voice-border text-voice-text-tertiary'
              }`}
              disabled={!voteCount}
              title={voteCount ? 'Execute this workblock' : 'Select this card to enable Execute'}
            >
              Execute
            </button>
            <p className="mt-2 text-[10px] text-voice-text-tertiary">
              Execute = submit this choice immediately.
            </p>
          </div>
        )}

        {/* Slide layout selector */}
        {isSlide && onLayoutChange && (
          <div className="mt-4">
            <p className="text-[11px] font-medium text-voice-text-secondary mb-2">Layout</p>
            <div className="bg-voice-card/40 rounded-lg border border-voice-border px-3 py-2">
              <select
                value={layoutValue}
                onChange={(e) => onLayoutChange(e.target.value)}
                className="w-full bg-transparent text-[13px] text-voice-text focus:outline-none"
              >
                <option value="">Auto</option>
                <option value="text">Text</option>
                <option value="two-col">Two-panel (text left, image right)</option>
                <option value="bg-hero">Background hero (impact statement)</option>
                <option value="hero">Hero (image-forward)</option>
                <option value="full-bleed">Full-bleed image</option>
              </select>
            </div>
          </div>
        )}

        {/* Share your thoughts — inside vote panel, expandable */}
        {onCommentChange && (
          <div className="mt-4 relative">
            <div className={`bg-voice-card/40 rounded-lg border border-voice-border flex items-start px-[17px] py-4 transition-all ${expanded ? 'min-h-[180px]' : 'h-[77px]'}`}>
              <textarea
                value={comment || ''}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Share your thoughts"
                rows={expanded ? 6 : 2}
                className="w-full h-full bg-transparent text-[13px] text-voice-text placeholder-voice-text-secondary resize-none focus:outline-none leading-relaxed"
              />
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-voice-text-secondary hover:text-voice-text transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <Minus size={12} /> : <Plus size={12} />}
            </button>
          </div>
        )}

        {/* Image prompt (only when an image layout is selected) */}
        {isSlide && isImageLayout && onImagePromptChange && (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-voice-text-secondary mb-2">Image prompt</p>
            <div className="bg-voice-card/40 rounded-lg border border-voice-border flex items-start px-[17px] py-4">
              <textarea
                value={imagePrompt || ''}
                onChange={(e) => onImagePromptChange(e.target.value)}
                placeholder="Describe the image you want for this slide (style, subject, vibe)"
                rows={3}
                className="w-full bg-transparent text-[13px] text-voice-text placeholder-voice-text-secondary resize-none focus:outline-none leading-relaxed"
              />
            </div>
            <p className="mt-2 text-[10px] text-voice-text-tertiary">This will be used to generate an image during export (next step).</p>
          </div>
        )}
      </div>
    </div>
  )
}
