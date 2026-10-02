<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Company-wide settings (Settings page): stored key/value, falling back to the defaults below.
 * Read once per request and cached until the next save.
 */
class Settings
{
    public const DEFAULTS = [
        // Company: printed on every PDF.
        'company_name' => null,
        'company_registration_no' => null,
        'sst_registration_no' => null,
        'company_address' => null,
        'company_city' => null,
        'company_state' => null,
        'company_postcode' => null,
        'company_country' => 'Malaysia',
        'company_phone' => null,
        'company_email' => null,
        // LHDN e-invoice identity. The ID number is company_registration_no (SSM no. for BRN, IC no. for NRIC).
        'company_tin' => null,
        'company_id_type' => 'BRN',
        'company_msic_code' => null,
        'company_msic_description' => null,
        // System.
        'date_format' => 'd M Y',
        'time_format' => 'h:i A',
        'default_language' => 'en',
        // Currency.
        'currency_symbol' => 'RM',
        'currency_symbol_position' => 'before',
        'currency_symbol_space' => '0',
        'decimal_format' => '2',
        'decimal_separator' => '.',
        'thousands_separator' => ',',
        // Email (SMTP). Empty host = keep the mailer from .env.
        'mail_host' => null,
        'mail_port' => '587',
        'mail_username' => null,
        'mail_password' => null,
        'mail_encryption' => 'tls',
        'mail_from_address' => null,
        'mail_from_name' => null,
    ];

    /** Stored encrypted; never sent to the browser. */
    public const SECRET = ['mail_password'];

    private const CACHE_KEY = 'settings';

    /**
     * @return array<string, string|null>
     */
    public static function all(): array
    {
        // Kept on the container, so it lives for one request (or test) and never leaks into the next.
        if (! app()->bound(self::CACHE_KEY)) {
            app()->instance(self::CACHE_KEY, [
                ...self::DEFAULTS,
                ...Cache::rememberForever(self::CACHE_KEY, fn () => rescue(fn () => DB::table('settings')->pluck('value', 'key')->all(), [], report: false)),
            ]);
        }

        /** @var array<string, string|null> */
        return app(self::CACHE_KEY);
    }

    public static function get(string $key): ?string
    {
        $value = self::all()[$key] ?? null;

        return $value !== null && in_array($key, self::SECRET, true) ? rescue(fn () => Crypt::decryptString($value), null, report: false) : $value;
    }

    /**
     * Save some settings. A secret left blank keeps its current value.
     *
     * @param  array<string, string|int|bool|null>  $values
     */
    public static function put(array $values): void
    {
        $now = now();

        foreach ($values as $key => $value) {
            if (in_array($key, self::SECRET, true)) {
                if ($value === null || $value === '') {
                    continue;
                }

                $value = Crypt::encryptString((string) $value);
            }

            DB::table('settings')->updateOrInsert(['key' => $key], ['value' => is_bool($value) ? (string) (int) $value : $value, 'updated_at' => $now, 'created_at' => $now]);
        }

        self::flush();
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
        app()->forgetInstance(self::CACHE_KEY);
    }

    public static function company(): string
    {
        return self::get('company_name') ?: (string) config('app.name');
    }

    public static function date(CarbonInterface|string|null $date): string
    {
        return $date === null ? '' : Carbon::parse($date)->format((string) self::get('date_format'));
    }

    /** An amount (decimal string or number) in the company's currency format; the minus sign leads. */
    public static function money(string|int|float|null $amount): string
    {
        $value = (float) $amount;
        $number = number_format(abs($value), (int) self::get('decimal_format'), (string) self::get('decimal_separator'), (string) self::get('thousands_separator'));
        $space = self::get('currency_symbol_space') === '1' ? ' ' : '';
        $symbol = (string) self::get('currency_symbol');
        $sign = $value < 0 && (float) $number !== 0.0 ? '-' : '';

        return $sign.(self::get('currency_symbol_position') === 'after' ? $number.$space.$symbol : $symbol.$space.$number);
    }

    /** Point the mailer at the saved SMTP server, when one is set. */
    public static function applyMailConfig(): void
    {
        if (! self::get('mail_host')) {
            return;
        }

        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => self::get('mail_host'),
            'mail.mailers.smtp.port' => (int) self::get('mail_port'),
            'mail.mailers.smtp.username' => self::get('mail_username'),
            'mail.mailers.smtp.password' => self::get('mail_password'),
            'mail.mailers.smtp.scheme' => self::get('mail_encryption') === 'ssl' ? 'smtps' : null,
            'mail.from.address' => self::get('mail_from_address') ?: config('mail.from.address'),
            'mail.from.name' => self::get('mail_from_name') ?: self::company(),
        ]);
    }
}
