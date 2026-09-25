// Remembers recent batch ids so results survive a page reload.
// Browser storage can be unavailable (private mode etc.), so never throw.
const KEY = 'cadconv.batches';

export function loadBatchIds(): string[] {
    try {
        const raw = localStorage.getItem(KEY);
        const ids = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string').slice(0, 20) : [];
    } catch {
        return [];
    }
}

export function saveBatchIds(ids: string[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 20)));
    } catch {
        /* ignore */
    }
}

export function loadLocale(): string | null {
    try {
        return localStorage.getItem('cadconv.locale');
    } catch {
        return null;
    }
}

export function saveLocale(locale: string): void {
    try {
        localStorage.setItem('cadconv.locale', locale);
    } catch {
        /* ignore */
    }
}
