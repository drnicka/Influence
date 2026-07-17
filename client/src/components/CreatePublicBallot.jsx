import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { apiPost } from '../api'

export default function CreatePublicBallot({ onCreated, onBack }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [endsIn, setEndsIn] = useState('7d')
  const [items, setItems] = useState([
    { statement: 'Influence is collective prioritisation with explicit trade-offs', explanation: 'Influence turns competing preferences into ranked outcomes using quadratic voting, so conviction and cost are visible.' },
    { statement: 'Influence is decision memory with lineage', explanation: 'Influence stores proposals, votes, rationale, and outcomes so teams can trace how and why priorities changed.' },
    { statement: 'Influence is a bridge from conversation to execution', explanation: 'Influence converts discussion into structured ballots, then into concrete next actions that can be owned and shipped.' },
    { statement: 'Influence is transparent governance for builders', explanation: 'Influence makes selected and deferred priorities visible, improving trust and accountability across collaborators.' },
    { statement: 'Influence is structured disagreement that produces clarity', explanation: 'Influence channels disagreement into comparable options, reducing drift and turning friction into sharper decisions.' },
    { statement: 'Influence is participatory strategy under constraints', explanation: 'Finite credits force explicit trade-offs, helping teams focus effort on what matters most right now.' },
    { statement: 'Influence is a shared prioritisation language', explanation: 'Influence gives product, engineering, and operations one surface for evaluating options and aligning direction.' },
    { statement: 'Influence is governance that scales beyond meetings', explanation: 'Asynchronous ballots preserve context and momentum without requiring everyone to be present at once.' },
    { statement: 'Influence is accountable prioritisation', explanation: 'Each decision carries visible rationale, making outcomes easier to review, defend, and iterate.' },
    { statement: 'Influence is an operating layer for collaborative judgment', explanation: 'Influence combines proposal design, weighted voting, and feedback loops into a repeatable decision workflow.' },
  ])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  function addItem() {
    setItems([...items, { statement: '', explanation: '' }])
  }

  function removeItem(i) {
    if (items.length <= 2) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i, key, value) {
    const next = [...items]
    next[i] = { ...next[i], [key]: value }
    setItems(next)
  }

  function computeEndsAt() {
    const now = Date.now()
    const map = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '14d': 1209600000 }
    const ms = map[endsIn] || 604800000
    return new Date(now + ms).toISOString()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const validItems = items
      .map(i => ({ statement: i.statement.trim(), explanation: i.explanation.trim() }))
      .filter(i => i.statement)

    if (!title.trim()) return setError('Title is required')
    if (!password.trim()) return setError('Ballot password is required')
    if (validItems.length < 2) return setError('At least 2 statements required')

    setBusy(true)
    try {
      const res = await apiPost('/ballots', {
        title: title.trim(),
        description: description.trim() || 'Vote on the statements you agree with most strongly.',
        visibility: 'public',
        voteType: 'qv',
        credits: 100,
        password: password.trim(),
        endsAt: computeEndsAt(),
        items: validItems.map((i, idx) => ({
          id: `statement-${idx + 1}`,
          type: 'public_statement',
          title: i.statement,
          body: i.explanation,
          submittedBy: 'Community',
        })),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create public ballot')
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
        <h2 className="text-[15px] font-bold text-voice-text">New public ballot</h2>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg border border-red-500/40 bg-red-500/5 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What should the public vote on?"
            className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short context shown above the public ballot"
            rows={2}
            className="w-full rounded-lg bg-voice-card/40 border border-voice-border px-3 py-2.5 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Ballot password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Required to vote"
            autoComplete="new-password"
            data-1p-ignore="true"
            className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
            required
          />
          <p className="text-[10px] text-voice-text-tertiary mt-1">Public ballots are created with 100 QV credits per voter.</p>
        </div>

        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-1">Time limit</label>
          <div className="flex gap-1.5 flex-wrap">
            {['24h', '48h', '7d', '14d'].map(opt => (
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
        </div>

        <div>
          <label className="block text-[11px] text-voice-text-secondary mb-2">Statements + explanation</label>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-voice-border p-3 bg-voice-card/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-voice-text-tertiary font-semibold tracking-[0.14em]">STATEMENT {i + 1}</p>
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="w-[28px] h-[28px] rounded-lg border border-voice-border flex items-center justify-center text-voice-text-tertiary hover:text-voice-negative hover:border-voice-negative/30 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={item.statement}
                  onChange={e => updateItem(i, 'statement', e.target.value)}
                  placeholder="Statement text (what people are voting on)"
                  className="w-full h-[36px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[12px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
                />
                <textarea
                  value={item.explanation}
                  onChange={e => updateItem(i, 'explanation', e.target.value)}
                  placeholder="Explanation (why this matters, constraints, context)"
                  rows={2}
                  className="mt-2 w-full rounded-lg bg-voice-card/40 border border-voice-border px-3 py-2 text-[12px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40 resize-none"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-2 flex items-center gap-1 text-[11px] text-voice-accent hover:text-voice-accent/80 transition-colors"
          >
            <Plus size={12} /> Add statement
          </button>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          {busy ? 'Creating...' : 'Create public ballot (draft)'}
        </button>
      </form>
    </div>
  )
}
