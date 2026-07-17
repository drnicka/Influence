import ReactMarkdown from 'react-markdown'

export default function EditCard({ item }) {
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
          <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-voice-muted/20 text-voice-text-secondary border border-voice-border">
            EDIT
          </span>
        </div>
      </div>

      <div className="mx-[18px] border-t border-voice-border" />

      <div className="px-[18px] py-4">
        <h3 className="text-[15px] font-semibold text-voice-text leading-snug">{item.title}</h3>

        {item.semanticTag && (
          <span className="inline-block mt-2 px-2.5 py-1 bg-voice-accent-soft rounded-md text-[10px] text-voice-accent font-medium">
            {item.semanticTag}
          </span>
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
