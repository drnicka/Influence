export default function MetadataTable({ ballot, items }) {
  return (
    <div className="mt-3 bg-voice-surface rounded-xl border border-voice-border">
      <Row label="Start" value={formatDate(ballot.created)} border />
      {ballot.endsAt && (
        <Row label="Ends" value={formatDate(ballot.endsAt)} border />
      )}
      <Row
        label="Status"
        value={ballot.status}
        valueClass={`capitalize ${
          ballot.status === 'completed' ? 'text-voice-positive'
          : ballot.status === 'passed' ? 'text-voice-text-tertiary'
          : 'text-voice-accent'
        }`}
        border
      />
      {ballot.status === 'completed' && (
        <Row label="Completed" value={formatDate(ballot.votedAt)} border />
      )}
      {ballot.status === 'passed' && (
        <Row label="Passed" value={formatDate(ballot.passedAt)} border />
      )}
      <Row
        label="Votes"
        value={items.reduce((sum, i) => sum + Math.abs(i.votes || 0), 0)}
        valueClass="tabular-nums"
      />
    </div>
  )
}

function Row({ label, value, valueClass = '', border = false }) {
  return (
    <div className={`flex justify-between px-[18px] py-3 ${border ? 'border-b border-voice-border' : ''}`}>
      <span className="text-[11px] text-voice-text-secondary">{label}</span>
      <span className={`text-[11px] text-voice-text font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}
