import { useState, useEffect } from 'react'
import { Users, Plus, Send } from 'lucide-react'
import { apiGet, apiPost } from '../api'

export default function RoomPanel({ onClose, onCreateRoomBallot }) {
  const [rooms, setRooms] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRoom, setActiveRoom] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [inviteHandle, setInviteHandle] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [joinRequests, setJoinRequests] = useState([])

  useEffect(() => { fetchRooms(); fetchMembers() }, [])
  useEffect(() => {
    if (!activeRoom) {
      setJoinRequests([])
      return
    }
    fetchJoinRequests(activeRoom.id)
  }, [activeRoom?.id])

  async function fetchRooms() {
    try {
      const res = await apiGet('/rooms')
      if (res.ok) setRooms(await res.json())
    } catch (err) {
      console.error('Failed to fetch rooms:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMembers() {
    try {
      const res = await apiGet('/members')
      if (res.ok) setAllMembers(await res.json())
    } catch (err) {
      console.error('Failed to fetch members:', err)
    }
  }

  async function handleCreateRoom(e) {
    e.preventDefault()
    if (!newRoomName.trim()) return
    setError(null)
    setBusy(true)
    try {
      const res = await apiPost('/rooms', { name: newRoomName.trim() })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create room')
      setRooms(prev => [...prev, data])
      setActiveRoom(data)
      setNewRoomName('')
      setShowCreate(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteHandle.trim() || !activeRoom) return
    setError(null)
    setBusy(true)
    try {
      const res = await apiPost(`/rooms/${activeRoom.id}/invite`, { handle: inviteHandle.trim() })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to invite')
      setActiveRoom(data)
      setRooms(prev => prev.map(r => r.id === data.id ? data : r))
      setInviteHandle('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function fetchJoinRequests(roomId) {
    try {
      const res = await apiGet(`/rooms/${roomId}/join-requests`)
      if (!res.ok) return
      const data = await res.json()
      setJoinRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch join requests:', err)
    }
  }

  async function handleDecision(requestId, action) {
    if (!activeRoom) return
    setError(null)
    setBusy(true)
    try {
      const res = await apiPost(`/rooms/${activeRoom.id}/join-requests/${requestId}/decision`, {
        action,
        reason: action === 'reject' ? 'owner_rejected' : null,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to apply decision')
      await fetchJoinRequests(activeRoom.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-[18px] pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-voice-text">Rooms</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCreate(!showCreate); setActiveRoom(null); setError(null) }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-voice-accent/90 hover:bg-voice-accent text-white text-[11px] font-semibold transition-colors"
          >
            <Plus size={12} /> New room
          </button>
          <button
            onClick={onClose}
            className="text-[11px] text-voice-text-tertiary hover:text-voice-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg border border-red-500/40 bg-red-500/5 text-[11px] text-red-300">
          {error}
        </div>
      )}

      {/* Create room form */}
      {showCreate && (
        <form onSubmit={handleCreateRoom} className="mb-4 bg-voice-surface rounded-xl border border-voice-border p-4">
          <p className="text-[11px] font-semibold text-voice-text-secondary mb-2">Create a room</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              placeholder="Room name (e.g. design-council)"
              className="flex-1 h-[36px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[12px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 h-[36px] rounded-lg bg-voice-accent/90 hover:bg-voice-accent text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Room list */}
      {loading ? (
        <p className="text-[12px] text-voice-text-secondary">Loading rooms...</p>
      ) : rooms.length === 0 && !showCreate ? (
        <div className="bg-voice-surface rounded-xl p-6 border border-voice-border text-center">
          <Users size={24} className="mx-auto text-voice-text-tertiary mb-2" />
          <p className="text-[12px] text-voice-text-secondary">No rooms yet</p>
          <p className="text-[10px] text-voice-text-tertiary mt-1">Create a room to start multiplayer voting</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => { setActiveRoom(activeRoom?.id === room.id ? null : room); setError(null) }}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                activeRoom?.id === room.id
                  ? 'bg-voice-card border-voice-accent/30'
                  : 'bg-voice-surface border-voice-border hover:border-voice-border-hover'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-voice-text-secondary" />
                  <span className="text-[13px] font-semibold text-voice-text">{room.name}</span>
                </div>
                <span className="text-[10px] text-voice-text-tertiary">{room.members.length} members</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Active room detail */}
      {activeRoom && (
        <div className="mt-3 bg-voice-surface rounded-xl border border-voice-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-voice-text">{activeRoom.name}</h3>
            <span className="text-[10px] text-voice-text-tertiary">{activeRoom.members.length} members</span>
          </div>

          {/* Members */}
          <div className="flex flex-wrap gap-1.5">
            {(activeRoom.memberDetails || []).map(m => (
              <span key={m.id} className="px-2 py-0.5 rounded-md bg-voice-card border border-voice-border text-[10px] text-voice-text font-medium">
                {m.handle}
              </span>
            ))}
          </div>

          {/* Invite — member picker */}
          {(() => {
            const currentMemberIds = new Set(activeRoom.members || [])
            const invitable = allMembers.filter(m => !currentMemberIds.has(m.id))
            if (invitable.length === 0) return (
              <p className="text-[10px] text-voice-text-tertiary">All registered members are in this room.</p>
            )
            return (
              <div>
                <p className="text-[10px] font-semibold text-voice-text-secondary mb-1.5">Invite members</p>
                <div className="flex flex-wrap gap-1.5">
                  {invitable.map(m => (
                    <button
                      key={m.id}
                      disabled={busy}
                      onClick={() => {
                        setInviteHandle(m.handle)
                        // Auto-submit invite
                        setError(null)
                        setBusy(true)
                        apiPost(`/rooms/${activeRoom.id}/invite`, { handle: m.handle })
                          .then(async res => {
                            const data = await res.json()
                            if (!res.ok) throw new Error(data?.error || 'Failed to invite')
                            setActiveRoom(data)
                            setRooms(prev => prev.map(r => r.id === data.id ? data : r))
                            setInviteHandle('')
                          })
                          .catch(err => setError(err.message))
                          .finally(() => setBusy(false))
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-voice-card/40 border border-voice-border hover:border-voice-accent/40 hover:bg-voice-accent/10 text-[11px] text-voice-text transition-all disabled:opacity-50"
                    >
                      <span className="w-5 h-5 rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-[9px] font-bold text-voice-text">
                        {(m.handle || '?')[0].toUpperCase()}
                      </span>
                      {m.handle}
                      <Plus size={10} className="text-voice-text-tertiary" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Join requests moderation */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-voice-text-secondary">Join requests</p>
            {joinRequests.length === 0 ? (
              <p className="text-[10px] text-voice-text-tertiary">No join requests for this room.</p>
            ) : joinRequests.map(req => (
              <div key={req.requestId} className="rounded-lg border border-voice-border bg-voice-card/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-voice-text font-medium">{req.requester?.displayName || req.requester?.handle || 'Unknown'}</p>
                    <p className="text-[10px] text-voice-text-tertiary">{req.requestId} · {req.status}</p>
                  </div>
                  {req.status === 'requested' && (
                    <div className="flex gap-1.5">
                      <button
                        disabled={busy}
                        onClick={() => handleDecision(req.requestId, 'approve')}
                        className="px-2 py-1 rounded bg-voice-positive/20 border border-voice-positive/40 text-[10px] text-voice-positive disabled:opacity-50"
                      >Approve</button>
                      <button
                        disabled={busy}
                        onClick={() => handleDecision(req.requestId, 'reject')}
                        className="px-2 py-1 rounded bg-voice-negative/20 border border-voice-negative/40 text-[10px] text-voice-negative disabled:opacity-50"
                      >Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create room ballot button */}
          <button
            onClick={() => onCreateRoomBallot?.(activeRoom)}
            className="w-full flex items-center justify-center gap-2 h-[38px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[11px] font-semibold transition-colors"
          >
            <Send size={12} /> Send ballot to room
          </button>
        </div>
      )}
    </div>
  )
}
