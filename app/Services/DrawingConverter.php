<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Thin wrapper around the Python `cadconv` CLI in /converter.
 */
class DrawingConverter
{
    public const PAPERS = ['A0', 'A1', 'A2', 'A3', 'A4', 'B4', 'B5', 'LETTER'];

    public const ORIENTATIONS = ['auto', 'landscape', 'portrait'];

    public const COLORS = ['mono', 'color'];

    public const LAYOUTS = ['model', 'all'];

    /**
     * @param  array{paper?: string, orientation?: string, color?: string, layouts?: string}  $options
     * @return array{ok: bool, error?: string, warnings?: list<string>, pages?: int, paper?: string, elapsed_ms?: int}
     */
    public function convert(string $input, string $target, string $output, array $options = []): array
    {
        $command = [
            config('converter.python'), '-m', 'cadconv', $input,
            '--to', $target,
            '--out', $output,
        ];

        if ($target === 'pdf') {
            $command = [
                ...$command,
                '--paper', $this->pick($options['paper'] ?? null, self::PAPERS, 'A4'),
                '--orientation', $this->pick($options['orientation'] ?? null, self::ORIENTATIONS, 'auto'),
                '--color', $this->pick($options['color'] ?? null, self::COLORS, 'mono'),
                '--layouts', $this->pick($options['layouts'] ?? null, self::LAYOUTS, 'model'),
            ];
        }

        $result = Process::path(config('converter.path'))
            ->env($this->environment())
            ->timeout(config('converter.timeout'))
            ->run($command);

        $json = $this->lastJsonLine($result->output());

        if ($json === null) {
            throw new RuntimeException('Converter produced no result: '.trim($result->errorOutput()));
        }

        return $json;
    }

    /** Which external converters the server can see (for the status panel). */
    public function capabilities(): array
    {
        $script = 'import json; from cadconv import tools, fonts, __version__ as v; '
            .'print(json.dumps({"version": v, "dwg": bool(tools.dwg2dxf() or tools.oda_converter()), '
            .'"oda": bool(tools.oda_converter()), "jww": bool(tools.jww2jif()), "cjk_font": bool(fonts.cjk_font_path())}))';

        $result = Process::path(config('converter.path'))
            ->env($this->environment())
            ->timeout(20)
            ->run([config('converter.python'), '-c', $script]);

        return $this->lastJsonLine($result->output()) ?? ['error' => 'converter unavailable'];
    }

    private function environment(): array
    {
        // php-fpm and `artisan serve` strip PATH, which hides dwg2dxf / jww2jif.
        $path = implode(PATH_SEPARATOR, array_filter([
            getenv('PATH') ?: null,
            '/usr/local/bin', '/usr/bin', '/bin',
        ]));

        return array_filter([
            'PATH' => $path,
            'PYTHONPATH' => config('converter.path'),
            'PYTHONIOENCODING' => 'utf-8',
            ...config('converter.tools'),
        ]);
    }

    private function pick(?string $value, array $allowed, string $default): string
    {
        return in_array($value, $allowed, true) ? $value : $default;
    }

    private function lastJsonLine(string $output): ?array
    {
        foreach (array_reverse(preg_split('/\r?\n/', trim($output))) as $line) {
            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }
}
