import { Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ServerStatus } from '@/lib/types';

export function Header({ status }: { status: ServerStatus | null }) {
    const { t, locale, setLocale } = useI18n();
    const c = status?.converter;
    const online = !!c && !c.error;

    return (
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <a href="/" className="group flex items-center gap-3">
                <Logo />
                <div className="leading-tight">
                    <div className="font-mono text-[11px] tracking-[0.3em] text-cyan/80">CAD//CONVERT</div>
                    <div className="text-sm font-semibold text-ink">{t.tagline}</div>
                </div>
            </a>

            <div className="flex items-center gap-2">
                <div className="glass hidden items-center gap-3 rounded-full px-3 py-1.5 font-mono text-[11px] text-mute md:flex">
                    <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-lime shadow-[0_0_8px] shadow-lime' : 'bg-rose'}`} />
                        {t.engine} {online ? t.online : t.offline}
                    </span>
                    {online && (
                        <>
                            <Cap on={!!c?.dwg} label="DWG" />
                            <Cap on label="DXF" />
                            <Cap on={!!c?.jww} label="JWW" />
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setLocale(locale === 'ja' ? 'en' : 'ja')}
                    className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs text-mute transition hover:text-ink"
                    aria-label="Switch language"
                >
                    <Languages className="h-3.5 w-3.5" />
                    {locale === 'ja' ? 'EN' : '日本語'}
                </button>
            </div>
        </header>
    );
}

function Cap({ on, label }: { on: boolean; label: string }) {
    return <span className={on ? 'text-cyan' : 'text-mute/50 line-through'}>{label}</span>;
}

export function Logo() {
    return (
        <svg viewBox="0 0 64 64" className="h-10 w-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.45)] transition group-hover:rotate-6">
            <defs>
                <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
            </defs>
            <rect x="2" y="2" width="60" height="60" rx="14" fill="#0a0f1c" stroke="url(#logo-g)" strokeOpacity=".5" />
            <path d="M14 44 32 12l18 32H14Z" fill="none" stroke="url(#logo-g)" strokeWidth="3.5" strokeLinejoin="round" />
            <circle cx="32" cy="34" r="6" fill="none" stroke="url(#logo-g)" strokeWidth="3.5" />
        </svg>
    );
}
