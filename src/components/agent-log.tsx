'use client';

interface LogEntry {
  message: string;
  timestamp: string;
  type: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AgentLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="flex flex-col">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Agent Log
      </p>
      <div className="flex-1 space-y-1 overflow-y-auto font-mono text-xs min-h-0">
        {logs.slice(0, 50).map((entry, i) => (
          <div
            key={`${entry.timestamp}-${i}`}
            className={`flex gap-2 leading-relaxed ${
              i === 0
                ? 'border-l-2 border-emerald-500 pl-2'
                : 'border-l-2 border-transparent pl-2'
            }`}
          >
            <span className="shrink-0 tabular-nums text-muted-foreground/50">
              {formatTime(entry.timestamp)}
            </span>
            <span
              className={
                entry.type === 'error'
                  ? 'text-red-400'
                  : entry.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-muted-foreground'
              }
            >
              {entry.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="font-sans text-xs italic text-muted-foreground/50">
            No activity yet.
          </p>
        )}
      </div>
    </div>
  );
}
