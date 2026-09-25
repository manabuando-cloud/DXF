import { motion } from 'framer-motion';
import { Archive, Trash2 } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { UploadingBatch } from '@/lib/types';
import { FileRow, FormatBadge, StatusBadge } from './FileRow';

export function BatchCard({ entry, onRemove }: { entry: UploadingBatch; onRemove: () => void }) {
    const { t } = useI18n();
    const batch = entry.batch;
    const total = batch?.counts.total ?? entry.files.length;
    const finished = batch ? batch.counts.done + batch.counts.failed : 0;
    const ratio = batch ? finished / Math.max(total, 1) : entry.progress;

    return (
        <motion.section
            layout
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40 }}
            className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5"
        >
            <div className="flex items-center gap-4">
                <ProgressRing ratio={ratio} done={!!batch?.finished} failed={!!entry.error} />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-ink">{t.batchTitle(entry.target, total)}</h3>
                    <p className="font-mono text-[11px] text-mute">
                        {entry.error
                            ? entry.error
                            : batch
                              ? t.batchProgress(batch.counts.done, total)
                              : `${t.uploading} ${Math.round(entry.progress * 100)}%`}
                    </p>
                </div>
                {batch?.zip_url && batch.counts.done > 1 && (
                    <a
                        href={batch.zip_url}
                        className="flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-xs font-semibold text-violet transition hover:bg-violet/20 hover:shadow-[0_0_20px_-4px] hover:shadow-violet"
                    >
                        <Archive className="h-4 w-4" />
                        <span className="hidden sm:inline">{t.downloadAll}</span>
                    </a>
                )}
                <button type="button" onClick={onRemove} className="icon-btn" title={t.remove} aria-label={t.remove}>
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <ul className="mt-4 space-y-2">
                {batch
                    ? batch.conversions.map((c) => <FileRow key={c.id} item={c} />)
                    : entry.files.map((f) => (
                          <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                              <FormatBadge format={f.name.split('.').pop()?.toLowerCase() ?? ''} />
                              <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm text-ink">{f.name}</div>
                                  <div className="font-mono text-[11px] text-mute">{formatBytes(f.size)}</div>
                              </div>
                              {!entry.error && <StatusBadge status="uploading" />}
                          </li>
                      ))}
            </ul>
        </motion.section>
    );
}

function ProgressRing({ ratio, done, failed }: { ratio: number; done: boolean; failed: boolean }) {
    const r = 20;
    const c = 2 * Math.PI * r;
    const color = failed ? '#fb7185' : done ? '#a3e635' : 'url(#ring-g)';
    return (
        <div className="relative h-12 w-12 shrink-0">
            <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
                <defs>
                    <linearGradient id="ring-g">
                        <stop offset="0" stopColor="#22d3ee" />
                        <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                </defs>
                <circle cx="24" cy="24" r={r} fill="none" stroke="rgb(148 163 184 / .15)" strokeWidth="4" />
                <motion.circle
                    cx="24"
                    cy="24"
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0.02, ratio))) }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-mono text-[11px] text-ink">{Math.round(ratio * 100)}</span>
        </div>
    );
}
