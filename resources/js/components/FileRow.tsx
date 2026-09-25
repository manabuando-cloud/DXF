import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, XCircle, Clock } from 'lucide-react';
import { formatBytes, formatDuration } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { Conversion, Status } from '@/lib/types';

const FORMAT_COLORS: Record<string, string> = {
    dwg: 'from-cyan/30 to-cyan/5 text-cyan border-cyan/30',
    dxf: 'from-violet/30 to-violet/5 text-violet border-violet/30',
    jww: 'from-lime/30 to-lime/5 text-lime border-lime/30',
};

export function FormatBadge({ format }: { format: string }) {
    return (
        <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-gradient-to-br font-mono text-[11px] font-medium uppercase ${
                FORMAT_COLORS[format] ?? 'border-line text-mute'
            }`}
        >
            {format || '?'}
        </span>
    );
}

export function FileRow({ item }: { item: Conversion }) {
    const { t } = useI18n();
    const meta = [
        formatBytes(item.size),
        item.status === 'done' && item.output_size ? `→ ${formatBytes(item.output_size)}` : null,
        item.pages ? t.pages(item.pages) : null,
        item.paper?.replace('landscape', t.landscape).replace('portrait', t.portrait),
        formatDuration(item.elapsed_ms),
    ].filter(Boolean);

    return (
        <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="flex items-center gap-3">
                <FormatBadge format={item.format} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink" title={item.name}>
                        {item.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-mute">{meta.join(' · ')}</div>
                </div>
                <StatusBadge status={item.status} />
                {item.status === 'done' && (
                    <div className="flex shrink-0 gap-1.5">
                        {item.preview_url && (
                            <a href={item.preview_url} target="_blank" rel="noreferrer" className="icon-btn" title={t.preview} aria-label={t.preview}>
                                <Eye className="h-4 w-4" />
                            </a>
                        )}
                        <a
                            href={item.download_url ?? '#'}
                            download={item.output_name ?? true}
                            className="flex items-center gap-1.5 rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan transition hover:bg-cyan/20 hover:shadow-[0_0_20px_-4px] hover:shadow-cyan"
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">{t.download}</span>
                        </a>
                    </div>
                )}
            </div>

            {(item.status === 'queued' || item.status === 'processing') && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                        className={`h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-cyan to-violet ${
                            item.status === 'processing' ? 'animate-shimmer' : 'opacity-20'
                        }`}
                    />
                </div>
            )}

            {item.error && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-rose">
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {item.error}
                </p>
            )}
            {item.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                    {item.warnings.map((w) => (
                        <li key={w} className="flex items-start gap-1.5 text-xs text-amber/90">
                            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {w}
                        </li>
                    ))}
                </ul>
            )}
        </motion.li>
    );
}

export function StatusBadge({ status }: { status: Status | 'uploading' }) {
    const { t } = useI18n();
    const map = {
        uploading: { Icon: Loader2, cls: 'text-violet', spin: true, label: t.uploading },
        queued: { Icon: Clock, cls: 'text-mute', spin: false, label: t.queued },
        processing: { Icon: Loader2, cls: 'text-cyan', spin: true, label: t.processing },
        done: { Icon: CheckCircle2, cls: 'text-lime', spin: false, label: t.done },
        failed: { Icon: XCircle, cls: 'text-rose', spin: false, label: t.failed },
    }[status];
    const { Icon } = map;
    return (
        <span className={`flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase ${map.cls}`}>
            <Icon className={`h-4 w-4 ${map.spin ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{map.label}</span>
        </span>
    );
}
