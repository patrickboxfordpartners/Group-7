'use client';

export function IntegrationPill({
  name,
  connected,
  lastStatus,
}: {
  name: string;
  connected: boolean;
  lastStatus?: 'ok' | 'failed' | 'skipped';
}) {
  const dotColor = !connected
    ? 'bg-muted-foreground/30'
    : lastStatus === 'failed'
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px]">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span className={connected ? 'text-foreground/80' : 'text-muted-foreground/50'}>
        {name}
      </span>
    </span>
  );
}
