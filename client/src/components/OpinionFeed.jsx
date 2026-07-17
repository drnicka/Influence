import { useState, useEffect } from 'react'
import { MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { apiGet, apiPost } from '../api'

/**
 * Threaded opinion feed for results ballots.
 * Root comments come from voter breakdown (seeded at results creation).
 * Replies can be added to any comment.
 */
export default function OpinionFeed({ ballot }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState({})
  const [replyTo, setReplyTo] = useState(null) // comment id being replied to
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)

  const items = ballot.items || []

  useEffect(() => {
    fetchComments()
  }, [ballot.id])

  async function fetchComments() {
    try {
      const res = await apiGet(`/ballots/${ballot.id}/comments`)
      if (res.ok) setComments(await res.json())
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || busy) return
    setBusy(true)
    try {
      const parent = comments.find(c => c.id === replyTo)
      const res = await apiPost(`/ballots/${ballot.id}/comments`, {
        parentId: replyTo,
        itemId: parent?.itemId || null,
        text: replyText.trim(),
      })
      if (res.ok) {
        const reply = await res.json()
        setComments(prev => [...prev, reply])
        setReplyText('')
        setReplyTo(null)
      }
    } catch (err) {
      console.error('Failed to post reply:', err)
    } finally {
      setBusy(false)
    }
  }

  function toggleItem(itemId) {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // Group comments by item
  const commentsByItem = {}
  for (const c of comments) {
    const key = c.itemId || '_general'
    if (!commentsByItem[key]) commentsByItem[key] = []
    commentsByItem[key].push(c)
  }

  // Build thread tree for a set of comments
  function buildThreads(itemComments) {
    const roots = itemComments.filter(c => !c.parentId)
    const repliesMap = {}
    for (const c of itemComments) {
      if (c.parentId) {
        if (!repliesMap[c.parentId]) repliesMap[c.parentId] = []
        repliesMap[c.parentId].push(c)
      }
    }
    return { roots, repliesMap }
  }

  if (loading) {
    return <div className="text-[12px] text-voice-text-secondary px-[18px] mt-4">Loading opinions...</div>
  }

  if (comments.length === 0) {
    return (
      <div className="px-[18px] mt-4">
        <div className="bg-voice-surface rounded-xl p-6 border border-voice-border text-center">
          <MessageCircle size={20} className="mx-auto text-voice-text-tertiary mb-2" />
          <p className="text-sm text-voice-text-secondary">No opinions yet.</p>
          <p className="text-[10px] text-voice-text-tertiary mt-1">Voter comments will appear here when a ballot completes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-[18px] mt-4 space-y-4">
      {items.map((item, idx) => {
        const itemComments = commentsByItem[item.id] || []
        if (itemComments.length === 0) return null

        const { roots, repliesMap } = buildThreads(itemComments)
        const isExpanded = expandedItems[item.id] !== false // default expanded

        return (
          <div key={item.id} className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
            {/* Item header */}
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-voice-card/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-voice-accent">Q{idx + 1}</span>
                <span className="text-[13px] font-semibold text-voice-text">{item.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold ${item.votes > 0 ? 'text-voice-positive' : item.votes < 0 ? 'text-voice-negative' : 'text-voice-text-secondary'}`}>
                  {item.votes > 0 ? '+' : ''}{item.votes} votes
                </span>
                {isExpanded ? <ChevronUp size={14} className="text-voice-text-tertiary" /> : <ChevronDown size={14} className="text-voice-text-tertiary" />}
              </div>
            </button>

            {/* Comments */}
            {isExpanded && (
              <div className="border-t border-voice-border">
                {roots.map(comment => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    replies={repliesMap[comment.id] || []}
                    repliesMap={repliesMap}
                    replyTo={replyTo}
                    replyText={replyText}
                    busy={busy}
                    onStartReply={(id) => { setReplyTo(id); setReplyText('') }}
                    onCancelReply={() => setReplyTo(null)}
                    onReplyTextChange={setReplyText}
                    onSubmitReply={handleReply}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CommentThread({ comment, replies, repliesMap, replyTo, replyText, busy, onStartReply, onCancelReply, onReplyTextChange, onSubmitReply }) {
  const initial = (comment.handle || '?')[0].toUpperCase()
  const isVoteComment = !comment.parentId

  return (
    <div className="border-b border-voice-border/50 last:border-b-0">
      {/* Root comment */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-[10px] font-bold text-voice-text flex-shrink-0 mt-0.5">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[12px] font-semibold text-voice-text">{comment.handle}</span>
              {isVoteComment && comment.votes !== undefined && (
                <span className={`text-[10px] font-medium ${comment.votes > 0 ? 'text-voice-positive' : comment.votes < 0 ? 'text-voice-negative' : 'text-voice-text-tertiary'}`}>
                  {comment.votes > 0 ? '+' : ''}{comment.votes} votes · {comment.creditsCost || 0} credits
                </span>
              )}
            </div>
            <p className="text-[12px] text-voice-text-secondary leading-relaxed">{comment.text}</p>
            <button
              onClick={() => onStartReply(comment.id)}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-voice-text-tertiary hover:text-voice-accent transition-colors"
            >
              <MessageCircle size={10} /> Reply
            </button>
          </div>
        </div>

        {/* Reply input for this comment */}
        {replyTo === comment.id && (
          <form onSubmit={onSubmitReply} className="mt-2 ml-10 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={e => onReplyTextChange(e.target.value)}
              placeholder="Write a reply..."
              autoFocus
              className="flex-1 h-[32px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[11px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
            />
            <button
              type="submit"
              disabled={busy || !replyText.trim()}
              className="px-3 h-[32px] rounded-lg bg-voice-accent/90 hover:bg-voice-accent text-white text-[10px] font-semibold transition-colors disabled:opacity-50"
            >
              <Send size={10} />
            </button>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-[10px] text-voice-text-tertiary hover:text-voice-text"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="ml-10 border-l-2 border-voice-border/30">
          {replies.map(reply => (
            <ReplyComment
              key={reply.id}
              comment={reply}
              childReplies={repliesMap[reply.id] || []}
              repliesMap={repliesMap}
              replyTo={replyTo}
              replyText={replyText}
              busy={busy}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReplyComment({ comment, childReplies, repliesMap, replyTo, replyText, busy, onStartReply, onCancelReply, onReplyTextChange, onSubmitReply }) {
  const initial = (comment.handle || '?')[0].toUpperCase()

  return (
    <div>
      <div className="px-4 py-2">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-[8px] font-bold text-voice-text flex-shrink-0 mt-0.5">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-voice-text">{comment.handle}</span>
            <p className="text-[11px] text-voice-text-secondary leading-relaxed">{comment.text}</p>
            <button
              onClick={() => onStartReply(comment.id)}
              className="mt-1 flex items-center gap-1 text-[9px] text-voice-text-tertiary hover:text-voice-accent transition-colors"
            >
              <MessageCircle size={8} /> Reply
            </button>
          </div>
        </div>

        {replyTo === comment.id && (
          <form onSubmit={onSubmitReply} className="mt-2 ml-7 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={e => onReplyTextChange(e.target.value)}
              placeholder="Write a reply..."
              autoFocus
              className="flex-1 h-[28px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[10px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
            />
            <button
              type="submit"
              disabled={busy || !replyText.trim()}
              className="px-2 h-[28px] rounded-lg bg-voice-accent/90 text-white text-[9px] font-semibold disabled:opacity-50"
            >
              <Send size={9} />
            </button>
            <button type="button" onClick={onCancelReply} className="text-[9px] text-voice-text-tertiary">Cancel</button>
          </form>
        )}
      </div>

      {childReplies.length > 0 && (
        <div className="ml-7 border-l-2 border-voice-border/20">
          {childReplies.map(r => (
            <ReplyComment
              key={r.id}
              comment={r}
              childReplies={repliesMap[r.id] || []}
              repliesMap={repliesMap}
              replyTo={replyTo}
              replyText={replyText}
              busy={busy}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}
