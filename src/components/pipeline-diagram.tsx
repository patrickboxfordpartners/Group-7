'use client';

interface Integrations {
  apify: boolean;
  groq: boolean;
  crm: boolean;
  intercom: boolean;
  redpanda: boolean;
  sentry: boolean;
}

export function PipelineDiagram({
  activeStage,
  integrations,
}: {
  activeStage: string | null;
  integrations: Integrations;
}) {
  const stages = [
    {
      id: 'scout',
      label: 'Scout',
      sub: 'Apify',
      connected: integrations.apify,
    },
    {
      id: 'analyst',
      label: 'Analyst',
      sub: 'Groq LLM',
      connected: integrations.groq,
    },
    {
      id: 'action',
      label: 'Actions',
      sub: 'CRM + Intercom + Redpanda',
      connected: true,
    },
  ];

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Agent Pipeline
      </p>
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex flex-1 items-center">
            <div
              className={`flex-1 rounded-md border px-3 py-2.5 text-center transition-all duration-300 ${
                activeStage === stage.id
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                  : activeStage === 'complete' && stage.connected
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-border bg-secondary/50'
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  activeStage === stage.id
                    ? 'text-emerald-300'
                    : 'text-foreground/80'
                }`}
              >
                {stage.label}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {stage.sub}
              </p>
            </div>
            {i < stages.length - 1 && (
              <div className="relative flex w-6 items-center justify-center">
                <div className="h-px w-full bg-border" />
                {activeStage && (
                  <div className="animate-flow-right absolute h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
                <svg
                  className="absolute right-0 h-2 w-2 text-muted-foreground/50"
                  fill="currentColor"
                  viewBox="0 0 8 8"
                  aria-hidden="true"
                >
                  <path d="M0 0l4 4-4 4z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <div className="h-px w-12 bg-border" />
        <span className="text-[10px] text-muted-foreground/60">
          Human Feedback Loop
        </span>
        <svg
          className="h-3 w-3 text-muted-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
          />
        </svg>
        <div className="h-px w-12 bg-border" />
      </div>
    </div>
  );
}
