import type { Batch, PdfOptions, ServerStatus, Target } from './types';

export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

async function json<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(firstMessage(body) ?? `HTTP ${res.status}`, res.status);
    return body as T;
}

function firstMessage(body: any): string | undefined {
    if (body?.errors) {
        const first = Object.values(body.errors as Record<string, string[]>)[0];
        if (first?.[0]) return first[0];
    }
    return body?.message;
}

export async function fetchStatus(): Promise<ServerStatus> {
    return json(await fetch('/api/status', { headers: { Accept: 'application/json' } }));
}

export async function fetchBatch(id: string): Promise<Batch> {
    const res = await json<{ data: Batch }>(await fetch(`/api/batches/${id}`, { headers: { Accept: 'application/json' } }));
    return res.data;
}

export async function deleteBatch(id: string): Promise<void> {
    await fetch(`/api/batches/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
}

/** XHR instead of fetch so the upload progress can be shown. */
export function uploadBatch(
    target: Target,
    files: File[],
    options: PdfOptions,
    onProgress: (ratio: number) => void,
): Promise<Batch> {
    const form = new FormData();
    form.append('target', target);
    files.forEach((f) => form.append('files[]', f, f.name));
    if (target === 'pdf') {
        (Object.keys(options) as (keyof PdfOptions)[]).forEach((k) => form.append(k, options[k]));
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/batches');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onerror = () => reject(new ApiError('network', 0));
        xhr.onload = () => {
            let body: any = {};
            try {
                body = JSON.parse(xhr.responseText);
            } catch {
                /* non-JSON error page */
            }
            if (xhr.status >= 200 && xhr.status < 300) resolve(body.data);
            else if (xhr.status === 413) reject(new ApiError('too_large', 413));
            else reject(new ApiError(firstMessage(body) ?? `HTTP ${xhr.status}`, xhr.status));
        };
        xhr.send(form);
    });
}
