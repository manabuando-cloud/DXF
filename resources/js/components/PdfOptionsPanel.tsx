import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import type { PdfOptions } from '@/lib/types';

const PAPERS = ['A4', 'A3', 'A2', 'A1', 'A0', 'B4', 'LETTER'];

export function PdfOptionsPanel({
    open,
    value,
    onChange,
}: {
    open: boolean;
    value: PdfOptions;
    onChange: (v: PdfOptions) => void;
}) {
    const { t } = useI18n();
    const set = <K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) => onChange({ ...value, [k]: v });

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="glass mt-3 grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
                        <Field label={t.paper} className="sm:col-span-2">
                            {PAPERS.map((p) => (
                                <Chip key={p} active={value.paper === p} onClick={() => set('paper', p)}>
                                    {p === 'LETTER' ? 'Letter' : p}
                                </Chip>
                            ))}
                        </Field>
                        <Field label={t.orientation}>
                            <Chip active={value.orientation === 'auto'} onClick={() => set('orientation', 'auto')}>{t.orientationAuto}</Chip>
                            <Chip active={value.orientation === 'landscape'} onClick={() => set('orientation', 'landscape')}>{t.landscape}</Chip>
                            <Chip active={value.orientation === 'portrait'} onClick={() => set('orientation', 'portrait')}>{t.portrait}</Chip>
                        </Field>
                        <Field label={t.color}>
                            <Chip active={value.color === 'mono'} onClick={() => set('color', 'mono')}>{t.mono}</Chip>
                            <Chip active={value.color === 'color'} onClick={() => set('color', 'color')}>{t.colorful}</Chip>
                        </Field>
                        <Field label={t.layouts} className="sm:col-span-2">
                            <Chip active={value.layouts === 'model'} onClick={() => set('layouts', 'model')}>{t.layoutsModel}</Chip>
                            <Chip active={value.layouts === 'all'} onClick={() => set('layouts', 'all')}>{t.layoutsAll}</Chip>
                        </Field>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{label}</div>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                active
                    ? 'border-cyan/60 bg-cyan/15 text-cyan shadow-[0_0_16px_-4px] shadow-cyan/70'
                    : 'border-line bg-white/[0.02] text-mute hover:border-cyan/30 hover:text-ink'
            }`}
        >
            {children}
        </button>
    );
}
