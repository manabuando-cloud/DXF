import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useI18n } from '@/lib/i18n';

export function DropZone({
    accept,
    maxFiles,
    maxMb,
    onFiles,
}: {
    accept: string[];
    maxFiles: number;
    maxMb: number;
    onFiles: (files: File[]) => void;
}) {
    const { t } = useI18n();
    const input = useRef<HTMLInputElement>(null);
    const [active, setActive] = useState(false);
    const depth = useRef(0);

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        depth.current = 0;
        setActive(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
    };

    return (
        <div
            data-active={active}
            onDragEnter={(e) => {
                e.preventDefault();
                depth.current++;
                setActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
                depth.current = Math.max(0, depth.current - 1);
                if (depth.current === 0) setActive(false);
            }}
            onDrop={onDrop}
            className="neon-rim glass group relative overflow-hidden rounded-3xl"
        >
            <button
                type="button"
                onClick={() => input.current?.click()}
                className="relative flex w-full flex-col items-center justify-center gap-4 px-6 py-14 text-center sm:py-20"
            >
                {/* scanning beam */}
                <span
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-cyan/10 to-transparent ${active ? 'animate-scan' : 'opacity-0'}`}
                />
                <span aria-hidden className="absolute inset-6 rounded-2xl border border-dashed border-cyan/15 transition group-hover:border-cyan/30" />

                <motion.span
                    animate={active ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="relative grid h-20 w-20 place-items-center rounded-2xl border border-cyan/30 bg-gradient-to-br from-cyan/20 to-violet/20 shadow-[0_0_60px_-10px] shadow-cyan/60"
                >
                    <span aria-hidden className="animate-spin-slow absolute -inset-2 rounded-3xl border border-dashed border-violet/30" />
                    <UploadCloud className="h-9 w-9 text-cyan" />
                </motion.span>

                <span className="relative">
                    <span className="block text-xl font-semibold text-ink sm:text-2xl">{active ? t.dropActive : t.dropTitle}</span>
                    <span className="mt-2 block text-sm text-mute">
                        {t.dropOr}{' '}
                        <span className="font-medium text-cyan underline decoration-cyan/40 underline-offset-4 group-hover:decoration-cyan">
                            {t.dropBrowse}
                        </span>
                    </span>
                </span>

                <span className="relative flex flex-wrap items-center justify-center gap-2">
                    {accept.map((ext) => (
                        <span key={ext} className="rounded-md border border-line bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] uppercase text-mute">
                            .{ext}
                        </span>
                    ))}
                    <span className="font-mono text-[11px] text-mute/80">{t.dropLimits(maxFiles, maxMb)}</span>
                </span>
            </button>
            <input
                ref={input}
                type="file"
                multiple
                hidden
                accept={accept.map((e) => `.${e}`).join(',')}
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) onFiles(files);
                }}
            />
        </div>
    );
}
