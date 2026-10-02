<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocaleController extends Controller
{
    /**
     * Switch the interface language.
     */
    public function update(Request $request): RedirectResponse
    {
        $locale = $request->validate([
            'locale' => ['required', Rule::in(array_keys(config('app.locales')))],
        ])['locale'];

        $request->user()?->update(['lang' => $locale]);
        $request->session()->put('locale', $locale);

        return back();
    }

    /**
     * Serve a locale's translation strings; the browser caches them per file version.
     */
    public function translations(string $locale): JsonResponse
    {
        abort_unless(array_key_exists($locale, config('app.locales')), 404);

        $path = lang_path("{$locale}.json");
        $strings = is_file($path) ? json_decode((string) file_get_contents($path), flags: JSON_THROW_ON_ERROR) : (object) [];

        return response()->json($strings)->header('Cache-Control', 'public, max-age=31536000, immutable');
    }
}
