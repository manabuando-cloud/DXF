export type Target = 'pdf' | 'dxf';
export type Status = 'queued' | 'processing' | 'done' | 'failed';

export interface PdfOptions {
    paper: string;
    orientation: 'auto' | 'landscape' | 'portrait';
    color: 'mono' | 'color';
    layouts: 'model' | 'all';
}

export interface Conversion {
    id: string;
    name: string;
    format: string;
    size: number;
    status: Status;
    output_name: string | null;
    output_size: number | null;
    pages: number | null;
    paper: string | null;
    elapsed_ms: number | null;
    warnings: string[];
    error: string | null;
    download_url: string | null;
    preview_url: string | null;
}

export interface Batch {
    id: string;
    target: Target;
    options: Partial<PdfOptions>;
    finished: boolean;
    counts: Record<'total' | Status, number>;
    expires_at: string;
    zip_url: string | null;
    conversions: Conversion[];
}

export interface ServerStatus {
    converter: { version?: string; dwg?: boolean; oda?: boolean; jww?: boolean; cjk_font?: boolean; error?: string };
    limits: { max_files: number; max_file_mb: number; retention_minutes: number; extensions: string[] };
}

/** A batch that is still uploading has no server id yet. */
export interface UploadingBatch {
    key: string;
    target: Target;
    files: File[];
    progress: number;
    error?: string;
    batch?: Batch;
}
