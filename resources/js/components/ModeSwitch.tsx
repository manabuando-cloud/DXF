import { motion } from 'framer-motion';
import { FileOutput, Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Target } from '@/lib/types';

export function ModeSwitch({ value, onChange }: { value: Target; onChange: (t: Target) => void }) {
    const { t } = useI18n();
    const modes = [
        { id: 'pdf' as const, label: t.modePdf, hint: t.modePdfHint, Icon: Printer },
        { id: 'dxf' as const, label: t.modeDxf, hint: t.modeDxfHint, Icon: FileOutput },
    ];

    return (
        <div role="radiogroup" className="glass grid grid-cols-2 gap-1 rounded-2xl p-1.5">
            {modes.map(({ id, label, hint, Icon }) => {
                const active = value === id;
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(id)}
                        className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${active ? 'text-ink' : 'text-mute hover:text-ink'}`}
                    >
                        {active && (
                            <motion.span
                                layoutId="mode-pill"
                                className="absolute inset-0 rounded-xl border border-cyan/40 bg-gradient-to-br from-cyan/15 to-violet/15 shadow-[0_0_30px_-8px] shadow-cyan/60"
                                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                            />
                        )}
                        <Icon className={`relative h-5 w-5 shrink-0 ${active ? 'text-cyan' : ''}`} />
                        <span className="relative">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="block text-xs text-mute">{hint}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
