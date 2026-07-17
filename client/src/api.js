const BASE = '/api'

/** Get stored API key from localStorage */
export function getApiKey() {
  return localStorage.getItem('voice_api_key') || null
}

/** Store API key */
export function setApiKey(key) {
  if (key) localStorage.setItem('voice_api_key', key)
  else localStorage.removeItem('voice_api_key')
}

/** Get stored member info */
export function getStoredMember() {
  try {
    const raw = localStorage.getItem('voice_member')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Store member info */
export function setStoredMember(member) {
  if (member) localStorage.setItem('voice_member', JSON.stringify(member))
  else localStorage.removeItem('voice_member')
}

/** Authenticated fetch wrapper */
export async function apiFetch(path, opts = {}) {
  const key = getApiKey()
  const headers = { ...opts.headers }
  if (key) headers['X-Voice-Key'] = key
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  return res
}

/** JSON POST helper */
export async function apiPost(path, body) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** JSON GET helper */
export async function apiGet(path) {
  return apiFetch(path)
}
