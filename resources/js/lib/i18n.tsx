import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadLocale, saveLocale } from './storage';

const ja = {
    tagline: 'DWG・DXF・JWW をブラウザだけで一括変換',
    heroTitle: '図面を、ドロップするだけ。',
    heroSub: 'インストール不要・登録不要。CAD図面を印刷用PDFやDXFへまとめて変換します。',
    modePdf: '印刷用 PDF',
    modePdfHint: '用紙に合わせて自動フィット',
    modeDxf: 'DXF へ変換',
    modeDxfHint: 'DWG / JWW を汎用DXFに',
    paper: '用紙サイズ',
    orientation: '向き',
    orientationAuto: '自動',
    landscape: '横',
    portrait: '縦',
    color: '色',
    mono: '白黒',
    colorful: 'カラー',
    layouts: '対象',
    layoutsModel: 'モデル空間',
    layoutsAll: 'レイアウト全て',
    dropTitle: 'ここに図面ファイルをドロップ',
    dropActive: '離すと変換を開始します',
    dropOr: 'または',
    dropBrowse: 'ファイルを選択',
    dropLimits: (n: number, mb: number) => `最大 ${n} ファイル・1ファイル ${mb}MB まで`,
    unsupported: (names: string) => `対応していない形式のため除外しました: ${names}`,
    tooMany: (n: number) => `一度に変換できるのは ${n} ファイルまでです。`,
    tooLarge: (names: string, mb: number) => `${mb}MB を超えるため除外しました: ${names}`,
    uploading: 'アップロード中',
    queued: '待機中',
    processing: '変換中',
    done: '完了',
    failed: '失敗',
    download: 'ダウンロード',
    preview: 'プレビュー',
    downloadAll: 'まとめてZIP',
    remove: '削除',
    pages: (n: number) => `${n}ページ`,
    batchTitle: (target: string, n: number) => `${target.toUpperCase()} 変換 · ${n} ファイル`,
    batchProgress: (done: number, total: number) => `${done} / ${total} 完了`,
    expired: '保存期間が過ぎたため削除されました',
    networkError: 'サーバーに接続できませんでした。ネットワークを確認してください。',
    uploadTooLarge: 'アップロードサイズが大きすぎます。ファイル数を減らしてください。',
    emptyTitle: '変換結果はここに表示されます',
    emptySub: '変換したファイルは一定時間後にサーバーから自動で削除されます。',
    privacy: (m: number) => `アップロードされた図面と変換結果は ${m} 分後に自動削除されます。`,
    engine: 'エンジン',
    online: 'オンライン',
    offline: 'オフライン',
    howTitle: '使い方',
    how1: '変換モードを選ぶ（PDF / DXF）',
    how2: 'ファイルをドロップ（複数可）',
    how3: '完了したらダウンロード',
    formats: '対応形式',
    chromeTip: 'Chromeで「安全でないダウンロード」と表示される場合は、HTTPSで公開するか、サイトの設定で許可してください。',
    warnings: '注意',
};

type Dict = typeof ja;

const en: Dict = {
    tagline: 'Batch convert DWG, DXF and JWW right in your browser',
    heroTitle: 'Just drop your drawings.',
    heroSub: 'No install, no sign-up. Convert CAD drawings to print-ready PDF or DXF in bulk.',
    modePdf: 'Print PDF',
    modePdfHint: 'Auto-fit to paper',
    modeDxf: 'To DXF',
    modeDxfHint: 'DWG / JWW to standard DXF',
    paper: 'Paper',
    orientation: 'Orientation',
    orientationAuto: 'Auto',
    landscape: 'Landscape',
    portrait: 'Portrait',
    color: 'Color',
    mono: 'Mono',
    colorful: 'Color',
    layouts: 'Source',
    layoutsModel: 'Model space',
    layoutsAll: 'All layouts',
    dropTitle: 'Drop drawing files here',
    dropActive: 'Release to start converting',
    dropOr: 'or',
    dropBrowse: 'Browse files',
    dropLimits: (n, mb) => `Up to ${n} files · ${mb} MB each`,
    unsupported: (names) => `Skipped unsupported files: ${names}`,
    tooMany: (n) => `You can convert up to ${n} files at once.`,
    tooLarge: (names, mb) => `Skipped files over ${mb} MB: ${names}`,
    uploading: 'Uploading',
    queued: 'Queued',
    processing: 'Converting',
    done: 'Done',
    failed: 'Failed',
    download: 'Download',
    preview: 'Preview',
    downloadAll: 'Download ZIP',
    remove: 'Remove',
    pages: (n) => `${n} page${n === 1 ? '' : 's'}`,
    batchTitle: (target, n) => `${target.toUpperCase()} · ${n} file${n === 1 ? '' : 's'}`,
    batchProgress: (done, total) => `${done} / ${total} done`,
    expired: 'Removed after the retention period',
    networkError: 'Could not reach the server. Check your connection.',
    uploadTooLarge: 'Upload is too large. Try fewer files.',
    emptyTitle: 'Your results will appear here',
    emptySub: 'Converted files are deleted from the server automatically.',
    privacy: (m) => `Uploaded drawings and results are deleted after ${m} minutes.`,
    engine: 'Engine',
    online: 'online',
    offline: 'offline',
    howTitle: 'How it works',
    how1: 'Pick a mode (PDF / DXF)',
    how2: 'Drop your files (many at once)',
    how3: 'Download the results',
    formats: 'Formats',
    chromeTip: 'If Chrome blocks the download as insecure, serve the app over HTTPS or allow the site in settings.',
    warnings: 'Notes',
};

const dictionaries = { ja, en };
export type Locale = keyof typeof dictionaries;

const I18nContext = createContext<{ t: Dict; locale: Locale; setLocale: (l: Locale) => void }>({
    t: ja,
    locale: 'ja',
    setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
    const initial = (loadLocale() as Locale | null) ?? (navigator.language.startsWith('ja') ? 'ja' : 'en');
    const [locale, setLocaleState] = useState<Locale>(initial in dictionaries ? initial : 'ja');
    const value = useMemo(
        () => ({
            t: dictionaries[locale],
            locale,
            setLocale: (l: Locale) => {
                setLocaleState(l);
                saveLocale(l);
                document.documentElement.lang = l;
            },
        }),
        [locale],
    );
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
