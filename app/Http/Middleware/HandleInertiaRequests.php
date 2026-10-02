<?php

namespace App\Http\Middleware;

use App\Support\Settings;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'permissions' => fn () => $request->user()?->permissionNames() ?? [],
            ],
            // ponytail: fixed formats until the Settings module stores them per company.
            'globalSettings' => [
                'companyName' => Settings::company(),
                'dateFormat' => Settings::get('date_format'),
                'timeFormat' => Settings::get('time_format'),
                'currencySymbol' => Settings::get('currency_symbol'),
                'decimalFormat' => (int) Settings::get('decimal_format'),
                'decimalSeparator' => Settings::get('decimal_separator'),
                'thousandsSeparator' => Settings::get('thousands_separator'),
                'currencySymbolPosition' => Settings::get('currency_symbol_position'),
                'currencySymbolSpace' => Settings::get('currency_symbol_space') === '1',
            ],
            'locale' => app()->getLocale(),
            'locales' => config('app.locales'),
            // Changes whenever a translation file changes, so browsers refetch it.
            'translationsVersion' => fn () => is_file($path = lang_path(app()->getLocale().'.json')) ? (string) filemtime($path) : '',
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
