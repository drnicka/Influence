import ReactMarkdown from 'react-markdown'

function formatOntologyKind(kind) {
  const raw = String(kind || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'obligation') return 'Obligation'
  if (raw === 'intent') return 'Intent'
  if (raw === 'experiment') return 'Experiment'
  return kind
}

function formatWorkstreamLabel(workstream) {
  const raw = String(workstream || '').trim()
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatCostOfDrop(level) {
  const raw = String(level || '').trim().toLowerCase()
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatDoneScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return ''
  const pct = Math.max(0, Math.min(1, score)) * 100
  return `${Math.round(pct)}%`
}

export default function WorkblockCard({ item }) {
  const semanticChips = []
  const chipKeys = new Set()
  const addChip = (value) => {
    const label = String(value || '').trim()
    if (!label) return
    const key = label.toLowerCase()
    if (chipKeys.has(key)) return
    chipKeys.add(key)
    semanticChips.push(label)
  }

  if (item?.workstream) addChip(`Workblock/${formatWorkstreamLabel(item.workstream)}`)
  if (item?.ontologyKind) addChip(formatOntologyKind(item.ontologyKind))
  if (item?.semanticTag) addChip(item.semanticTag)

  const costOfDropLabel = item?.costOfDrop !== undefined ? formatCostOfDrop(item.costOfDrop) : ''
  const doneScoreLabel = item?.doneScore !== undefined ? formatDoneScore(item.doneScore) : ''
  const hasMetaRow = Boolean(costOfDropLabel || doneScoreLabel)

  return (
    <div className="bg-voice-surface rounded-xl border border-voice-border overflow-hidden">
      <div className="px-[18px] py-3.5 flex items-center gap-3">
        <div className="w-[45px] h-[45px] rounded-full bg-voice-card border border-voice-border flex items-center justify-center text-sm font-semibold text-voice-text-secondary flex-shrink-0">
          {(item.submittedBy || 'A')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-voice-text-secondary leading-relaxed">
            Submitted by <span className="text-voice-text font-medium">{item.submittedBy || 'Agent'}</span>
          </p>
          <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-voice-positive/10 text-voice-positive border border-voice-positive/20">
            WORKBLOCK
          </span>
        </div>
      </div>

      <div className="mx-[18px] border-t border-voice-border" />

      <div className="px-[18px] py-4">
        <h3 className="text-[15px] font-semibold text-voice-text leading-snug">{item.title}</h3>

        {semanticChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {semanticChips.map((chip, idx) => (
              <span
                key={`${chip}-${idx}`}
                className="inline-flex items-center px-2.5 py-1 bg-voice-accent-soft rounded-md text-[10px] text-voice-accent font-medium"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {hasMetaRow && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {costOfDropLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-voice-card/60 border border-voice-border text-voice-text-secondary">
                Drop risk: <span className="ml-1 text-voice-text">{costOfDropLabel}</span>
              </span>
            )}
            {doneScoreLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-voice-card/60 border border-voice-border text-voice-text-secondary">
                Done: <span className="ml-1 text-voice-text">{doneScoreLabel}</span>
              </span>
            )}
          </div>
        )}

        {item?.canonicalPath && (
          <p className="mt-2 text-[11px] text-voice-text-tertiary break-all">
            Path: {item.canonicalPath}
          </p>
        )}

        {item.body && (
          <div className="mt-3 text-[13px] text-voice-text-secondary leading-[1.7]">
            <ReactMarkdown
              components={{
                h1: (props) => <h3 className="mt-3 text-[13px] font-semibold text-voice-text" {...props} />,
                h2: (props) => <h4 className="mt-3 text-[12px] font-semibold text-voice-text" {...props} />,
                h3: (props) => <h4 className="mt-3 text-[12px] font-semibold text-voice-text" {...props} />,
                h4: (props) => <h5 className="mt-3 text-[12px] font-semibold text-voice-text" {...props} />,
                h5: (props) => <h6 className="mt-3 text-[12px] font-semibold text-voice-text" {...props} />,
                p: (props) => <p className="mt-2" {...props} />,
                ul: (props) => <ul className="mt-2 pl-5 list-disc space-y-1" {...props} />,
                ol: (props) => <ol className="mt-2 pl-5 list-decimal space-y-1" {...props} />,
                li: (props) => <li className="" {...props} />,
                strong: (props) => <strong className="text-voice-text font-semibold" {...props} />,
                code: (props) => (
                  <code className="px-1 py-0.5 rounded bg-voice-card/60 border border-voice-border text-[12px]" {...props} />
                ),
                a: (props) => <a className="text-voice-accent underline" target="_blank" rel="noreferrer" {...props} />,
                hr: () => <div className="my-3 border-t border-voice-border" />,
              }}
            >
              {item.body}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
