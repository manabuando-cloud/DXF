import { AnimatePresence, motion } from 'framer-motion';
import { Info, Layers, ShieldCheck, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, deleteBatch, fetchBatch, fetchStatus, uploadBatch } from './lib/api';
import { extensionOf } from './lib/format';
import { useI18n } from './lib/i18n';
import { loadBatchIds, saveBatchIds } from './lib/storage';
import type { PdfOptions, ServerStatus, Target, UploadingBatch } from './lib/types';
import { Background } from './components/Background';
import { BatchCard } from './components/BatchCard';
import { DropZone } from './components/DropZone';
import { Header } from './components/Header';
import { ModeSwitch } from './components/ModeSwitch';
import { PdfOptionsPanel } from './components/PdfOptionsPanel';

const DEFAULT_LIMITS = { max_files: 50, max_file_mb: 50, retention_minutes: 60, extensions: ['dwg', 'dxf', 'jww'] };
const POLL_MS = 1200;

export default function App() {
    const { t } = useI18n();
    const [status, setStatus] = useState<ServerStatus | null>(null);
    const [target, setTarget] = useState<Target>('pdf');
    const [pdf, setPdf] = useState<PdfOptions>({ paper: 'A4', orientation: 'auto', color: 'mono', layouts: 'model' });
    const [entries, setEntries] = useState<UploadingBatch[]>([]);
    const [notices, setNotices] = useState<string[]>([]);
    const entriesRef = useRef(entries);
    entriesRef.current = entries;

    const limits = status?.limits ?? DEFAULT_LIMITS;

    const patch = useCallback((key: string, update: Partial<UploadingBatch>) => {
        setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...update } : e)));
    }, []);

    // Server capabilities + restore batches from a previous visit.
    useEffect(() => {
        fetchStatus().then(setStatus).catch(() => setStatus(null));
        loadBatchIds().forEach((id) =>
            fetchBatch(id)
                .then((batch) =>
                    setEntries((list) =>
                        list.some((e) => e.key === id) ? list : [...list, { key: id, target: batch.target, files: [], progress: 1, batch }],
                    ),
                )
                .catch(() => {}),
        );
    }, []);

    useEffect(() => {
        saveBatchIds(entries.filter((e) => e.batch).map((e) => e.batch!.id));
    }, [entries]);

    // Poll every batch that still has work in flight.
    useEffect(() => {
        const timer = setInterval(() => {
            entriesRef.current
                .filter((e) => e.batch && !e.batch.finished)
                .forEach((e) =>
                    fetchBatch(e.batch!.id)
                        .then((batch) => patch(e.key, { batch }))
                        .catch((err) => err instanceof ApiError && err.status === 410 && patch(e.key, { error: t.expired })),
                );
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [patch, t.expired]);

    const onFiles = (incoming: File[]) => {
        const messages: string[] = [];
        const unsupported = incoming.filter((f) => !limits.extensions.includes(extensionOf(f.name)));
        const tooBig = incoming.filter((f) => f.size > limits.max_file_mb * 1024 * 1024);
        let files = incoming.filter((f) => !unsupported.includes(f) && !tooBig.includes(f));
        if (unsupported.length) messages.push(t.unsupported(unsupported.map((f) => f.name).join(', ')));
        if (tooBig.length) messages.push(t.tooLarge(tooBig.map((f) => f.name).join(', '), limits.max_file_mb));
        if (files.length > limits.max_files) {
            messages.push(t.tooMany(limits.max_files));
            files = files.slice(0, limits.max_files);
        }
        setNotices(messages);
        if (!files.length) return;

        const key = crypto.randomUUID?.() ?? String(Date.now() + Math.random());
        setEntries((list) => [{ key, target, files, progress: 0 }, ...list]);

        uploadBatch(target, files, pdf, (progress) => patch(key, { progress }))
            .then((batch) => patch(key, { batch, progress: 1 }))
            .catch((err: ApiError) =>
                patch(key, {
                    error: err.message === 'network' ? t.networkError : err.message === 'too_large' ? t.uploadTooLarge : err.message,
                }),
            );
    };

    const remove = (entry: UploadingBatch) => {
        setEntries((list) => list.filter((e) => e.key !== entry.key));
        if (entry.batch) deleteBatch(entry.batch.id).catch(() => {});
    };

    return (
        <div className="relative min-h-dvh overflow-x-clip">
            <Background />
            <Header status={status} />

            <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
                <section className="pt-8 pb-10 text-center sm:pt-14">
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-cyan"
                    >
                        <Zap className="h-3 w-3" /> DWG · DXF · JWW → PDF / DXF
                    </motion.p>
                    <motion.h1
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="text-holo text-4xl font-bold tracking-tight sm:text-6xl"
                    >
                        {t.heroTitle}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mx-auto mt-4 max-w-xl text-balance text-mute"
                    >
                        {t.heroSub}
                    </motion.p>
                </section>

                <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div>
                        <ModeSwitch value={target} onChange={setTarget} />
                        <PdfOptionsPanel open={target === 'pdf'} value={pdf} onChange={setPdf} />
                        <div className="mt-4">
                            <DropZone accept={limits.extensions} maxFiles={limits.max_files} maxMb={limits.max_file_mb} onFiles={onFiles} />
                        </div>

                        <AnimatePresence>
                            {notices.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    role="alert"
                                    className="mt-3 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber"
                                >
                                    <Info className="mt-px h-4 w-4 shrink-0" />
                                    <div className="flex-1 space-y-1">
                                        {notices.map((n) => (
                                            <p key={n}>{n}</p>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setNotices([])} aria-label="close">
                                        <X className="h-4 w-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <HowTo retention={limits.retention_minutes} />
                    </div>

                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {entries.map((entry) => (
                                <BatchCard key={entry.key} entry={entry} onRemove={() => remove(entry)} />
                            ))}
                        </AnimatePresence>
                        {entries.length === 0 && <EmptyState />}
                    </div>
                </div>
            </main>

            <footer className="border-t border-line/60 py-6 text-center font-mono text-[11px] text-mute/70">
                CAD//CONVERT {status?.converter.version ? `v${status.converter.version}` : ''} · Laravel × React
            </footer>
        </div>
    );
}

function EmptyState() {
    const { t } = useI18n();
    return (
        <div className="glass grid min-h-[22rem] place-items-center rounded-2xl p-8 text-center">
            <div>
                <div className="relative mx-auto mb-5 h-24 w-24">
                    <div className="animate-spin-slow absolute inset-0 rounded-full border border-dashed border-cyan/30" />
                    <div className="absolute inset-3 rounded-full border border-violet/20" />
                    <Layers className="absolute inset-0 m-auto h-8 w-8 text-cyan/70" />
                </div>
                <p className="font-semibold text-ink">{t.emptyTitle}</p>
                <p className="mt-1 text-sm text-mute">{t.emptySub}</p>
            </div>
        </div>
    );
}

function HowTo({ retention }: { retention: number }) {
    const { t } = useI18n();
    const steps = [t.how1, t.how2, t.how3];
    return (
        <div className="mt-6 grid gap-3">
            <ol className="grid gap-2 sm:grid-cols-3">
                {steps.map((s, i) => (
                    <li key={s} className="glass flex items-center gap-3 rounded-xl p-3 text-xs text-mute">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan/30 font-mono text-cyan">{i + 1}</span>
                        {s}
                    </li>
                ))}
            </ol>
            <p className="flex items-center gap-2 text-xs text-mute">
                <ShieldCheck className="h-4 w-4 shrink-0 text-lime" /> {t.privacy(retention)}
            </p>
        </div>
    );
}
