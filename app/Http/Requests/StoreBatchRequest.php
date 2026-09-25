<?php

namespace App\Http\Requests;

use App\Services\DrawingConverter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreBatchRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'target' => ['required', Rule::in(['pdf', 'dxf'])],
            'files' => ['required', 'array', 'min:1', 'max:'.config('converter.max_files')],
            // Extension is checked by name: CAD files have no reliable MIME type.
            'files.*' => ['required', 'file', 'max:'.config('converter.max_file_kb')],
            'paper' => ['nullable', Rule::in(DrawingConverter::PAPERS)],
            'orientation' => ['nullable', Rule::in(DrawingConverter::ORIENTATIONS)],
            'color' => ['nullable', Rule::in(DrawingConverter::COLORS)],
            'layouts' => ['nullable', Rule::in(DrawingConverter::LAYOUTS)],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $allowed = config('converter.extensions');
                foreach ((array) $this->file('files', []) as $i => $file) {
                    $ext = strtolower($file->getClientOriginalExtension());
                    if (! in_array($ext, $allowed, true)) {
                        $validator->errors()->add(
                            "files.$i",
                            sprintf('%s は対応していない形式です（%s のみ）。', $file->getClientOriginalName(), implode(' / ', $allowed)),
                        );
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'files.required' => 'ファイルを選択してください。',
            'files.max' => 'ファイルは一度に:max件までです。',
            'files.*.max' => '1ファイルあたりの上限サイズを超えています。',
            'files.*.file' => 'ファイルのアップロードに失敗しました。',
        ];
    }

    public function pdfOptions(): array
    {
        return array_filter($this->only(['paper', 'orientation', 'color', 'layouts']));
    }
}
