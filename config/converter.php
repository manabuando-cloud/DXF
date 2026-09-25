<?php

return [
    // Python interpreter that has the converter/requirements.txt packages.
    'python' => env('CONVERTER_PYTHON', 'python3'),

    // Directory that contains the `cadconv` package.
    'path' => env('CONVERTER_PATH', base_path('converter')),

    // Seconds a single file may take before it is marked as failed.
    'timeout' => (int) env('CONVERTER_TIMEOUT', 300),

    // Uploaded drawings and results are deleted after this many minutes.
    'retention_minutes' => (int) env('CONVERTER_RETENTION_MINUTES', 60),

    'max_files' => (int) env('CONVERTER_MAX_FILES', 50),

    // Per-file upload limit in kilobytes (PHP's upload_max_filesize must allow it).
    'max_file_kb' => (int) env('CONVERTER_MAX_FILE_KB', 51200),

    // Upload batches per minute per client IP.
    'rate_limit' => (int) env('CONVERTER_RATE_LIMIT', 20),

    'extensions' => ['dwg', 'dxf', 'jww'],

    'disk' => env('CONVERTER_DISK', 'local'),

    // Optional explicit tool paths, forwarded to the Python converter.
    'tools' => [
        'CADCONV_DWG2DXF' => env('CADCONV_DWG2DXF'),
        'CADCONV_ODA' => env('CADCONV_ODA'),
        'CADCONV_JWW2JIF' => env('CADCONV_JWW2JIF'),
        'CADCONV_FONT' => env('CADCONV_FONT'),
    ],
];
