import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { apiPost } from '../api'

export default function CreateRoomBallot({ room, onCreated, onBack }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([{ title: '' }, { title: '' }])
  const [voteType, setVoteType] = useState('qv')
  const [endsIn, setEndsIn] = useState('24h')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  function addItem() {
    setItems([...items, { title: '' }])
  }

  function removeItem(i) {
    if (items.length <= 2) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i, value) {
    const next = [...items]
    next[i] = { title: value }
    setItems(next)
  }

  function computeEndsAt() {
    const now = Date.now()
    const map = { '1h': 3600000, '4h': 14400000, '24h': 86400000, '48h': 172800000, '7d': 604800000 }
    const ms = map[endsIn] || 86400000
    return new Date(now + ms).toISOString()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const validItems = items.filter(i => i.title.trim())
    if (!title.trim()) { setError('Title is required'); return }
    if (validItems.length < 2) { setError('At least 2 items required'); return }

    setBusy(true)
    try {
      const res = await apiPost('/ballots', {
        title: title.trim(),
        description: description.trim(),
        visibility: 'room',
        roomId: room.id,
        voteType,
        endsAt: computeEndsAt(),
        items: validItems.map(i => ({ title: i.title.trim() })),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create ballot')
      onCreated?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-[18px] pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-voice-text-secondary hover:text-voice-text transition-colors"
        >
          <ArrowLeft size={13} /> Back
        </button>
        <h2 className="text-[15px] font-bold text-voice-text">New ballot for {room.name}</h2>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg border border-red-500/40 bg-red-500/5 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What are we deciding?"
            className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Context for voters"
            rows={2}
            className="w-full rounded-lg bg-voice-card/40 border border-voice-border px-3 py-2.5 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40 resize-none"
          />
        </div>

        {/* Vote type */}
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Vote type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVoteType('qv')}
              className={`flex-1 h-[36px] rounded-lg text-[12px] font-medium transition-all ${
                voteType === 'qv'
                  ? 'bg-voice-card text-voice-text border border-voice-accent/30'
                  : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
              }`}
            >
              Quadratic (QV)
            </button>
            <button
              type="button"
              onClick={() => setVoteType('binary')}
              className={`flex-1 h-[36px] rounded-lg text-[12px] font-medium transition-all ${
                voteType === 'binary'
                  ? 'bg-voice-card text-voice-text border border-voice-accent/30'
                  : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
              }`}
            >
              Binary (pick one)
            </button>
          </div>
        </div>

        {/* Time limit */}
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Time limit</label>
          <div className="flex gap-1.5 flex-wrap">
            {['1h', '4h', '24h', '48h', '7d'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setEndsIn(opt)}
                className={`px-3 h-[32px] rounded-lg text-[11px] font-medium transition-all ${
                  endsIn === opt
                    ? 'bg-voice-card text-voice-text border border-voice-accent/30'
                    : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-voice-text-tertiary mt-1">
            Ballot closes when time expires or all {room.members.length} members vote.
          </p>
        </div>

        {/* Items */}
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Items to vote on</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateItem(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 h-[36px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[12px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
                />
                {items.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="w-[36px] h-[36px] rounded-lg border border-voice-border flex items-center justify-center text-voice-text-tertiary hover:text-voice-negative hover:border-voice-negative/30 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 flex items-center gap-1 text-[11px] text-voice-accent hover:text-voice-accent/80 transition-colors"
          >
            <Plus size={12} /> Add item
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          {busy ? 'Creating...' : `Send to ${room.name} (${room.members.length} members)`}
        </button>
      </form>
    </div>
  )
}
