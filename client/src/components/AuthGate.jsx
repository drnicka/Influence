import { useState } from 'react'

export default function AuthGate({ onAuth }) {
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [mode, setMode] = useState('register') // 'register' | 'login'
  const [error, setError] = useState(null)
  const [showKey, setShowKey] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim(), displayName: displayName.trim() || handle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Registration failed: ${res.status}`)
      setShowKey(data.apiKey)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function handleSaveKey() {
    if (showKey) {
      onAuth(showKey, { handle: handle.trim(), displayName: displayName.trim() || handle.trim() })
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/members/me', {
        headers: { 'X-Voice-Key': apiKeyInput.trim() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Invalid API key')
      onAuth(apiKeyInput.trim(), data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Show the key after registration — user must save it
  if (showKey) {
    return (
      <div className="min-h-screen bg-voice-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-voice-surface border border-voice-border rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-voice-text mb-2">Your agent key</h2>
          <p className="text-[12px] text-voice-text-secondary mb-4">
            Agents use this key to push ballots to you and read your weighted votes back.
            Copy it somewhere your agents can find it — it will not be shown again.
          </p>
          <div className="bg-voice-card rounded-lg border border-voice-border p-3 mb-4 break-all">
            <code className="text-[12px] text-voice-accent font-mono">{showKey}</code>
          </div>
          <button
            onClick={handleSaveKey}
            className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors"
          >
            I've saved it — take me to my first vote
          </button>
          <p className="mt-3 text-[11px] text-voice-text-tertiary text-center">
            A calibration ballot is waiting in your inbox: vote once to teach your agents how to work with you.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-voice-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-voice-surface border border-voice-border rounded-2xl p-6">
        <h1 className="text-[17px] font-bold text-voice-text mb-1">Influence</h1>
        <p className="text-[12px] text-voice-text-secondary mb-6">
          {mode === 'register'
            ? 'Agents push ballots. You vote. They read your weighted intent back.'
            : 'Enter your API key'}
        </p>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setMode('register'); setError(null) }}
            className={`flex-1 h-[36px] rounded-full text-[12px] font-medium transition-all ${
              mode === 'register'
                ? 'bg-voice-card text-voice-text'
                : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
            }`}
          >
            Register
          </button>
          <button
            onClick={() => { setMode('login'); setError(null) }}
            className={`flex-1 h-[36px] rounded-full text-[12px] font-medium transition-all ${
              mode === 'login'
                ? 'bg-voice-card text-voice-text'
                : 'border border-voice-border text-voice-text-secondary hover:text-voice-text'
            }`}
          >
            Login
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/5 text-[12px] text-red-300">
            {error}
          </div>
        )}

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-[11px] text-voice-text-secondary mb-1">Handle</label>
              <input
                type="text"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                placeholder="nick"
                className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-voice-text-secondary mb-1">Display name (optional)</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Nick"
                className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !handle.trim()}
              className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
            >
              {busy ? 'Registering…' : 'Register'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] text-voice-text-secondary mb-1">API Key</label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="vk_..."
                className="w-full h-[40px] rounded-lg bg-voice-card/40 border border-voice-border px-3 text-[13px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-1 focus:ring-voice-accent/40 font-mono"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy || !apiKeyInput.trim()}
              className="w-full h-[42px] rounded-xl bg-voice-accent/90 hover:bg-voice-accent text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Login'}
            </button>
          </form>
        )}

        <p className="mt-4 text-[10px] text-voice-text-tertiary text-center">
          Where memory holds weight
        </p>
      </div>
    </div>
  )
}
