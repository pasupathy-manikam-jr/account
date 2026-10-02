<?php

namespace App\Http\Controllers;

use App\Support\Settings;
use EInvoiceSdk\Models\EInvoiceSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Settings: company details, system formats, currency and email. Each section saves on its own.
 */
class SettingsController extends Controller
{
    public const DATE_FORMATS = ['d M Y', 'd/m/Y', 'd-m-Y', 'Y-m-d', 'm/d/Y', 'M d, Y'];

    public const TIME_FORMATS = ['h:i A', 'H:i'];

    public function index(): Response
    {
        $values = collect(Settings::all())->except(Settings::SECRET)->all();

        return Inertia::render('company-settings/index', [
            'values' => $values,
            'hasMailPassword' => Settings::get('mail_password') !== null,
            'dateFormats' => self::DATE_FORMATS,
            'timeFormats' => self::TIME_FORMATS,
            'einvoice' => $this->einvoiceSettings(),
        ]);
    }

    /**
     * The MyInvois credentials in use for the company TIN; secrets only report whether they are set.
     *
     * @return array<string, mixed>|null
     */
    private function einvoiceSettings(): ?array
    {
        $setting = rescue(fn () => EInvoiceSetting::where('tin', Settings::get('company_tin'))->where('active', true)->first(), null, report: false);

        return $setting ? [
            'environment' => $setting->environment->value,
            'unsigned' => $setting->unsigned,
            'client_id' => $setting->client_id,
            'has_client_secret' => $setting->client_secret !== '',
            'has_certificate' => (bool) $setting->certificate,
        ] : null;
    }

    public function update(Request $request, string $section): RedirectResponse
    {
        abort_unless($request->user()?->can("edit-{$section}-settings"), 403);

        Settings::put($request->validate($this->rules($section)));

        return $this->done(__('Settings saved.'));
    }

    /** Send a test message through the saved email settings. */
    public function testEmail(Request $request): RedirectResponse
    {
        $to = $request->validate(['test_email' => ['required', 'email']])['test_email'];

        try {
            Mail::raw(__('This is a test email from :company. Your email settings work.', ['company' => Settings::company()]), fn ($m) => $m->to($to)->subject(__('Test email from :company', ['company' => Settings::company()])));
        } catch (Throwable $e) {
            return $this->toast('error', __('The test email could not be sent: :error', ['error' => $e->getMessage()]));
        }

        return $this->done(__('Test email sent to :email.', ['email' => $to]));
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(string $section): array
    {
        return match ($section) {
            'company' => [
                'company_name' => ['required', 'string', 'max:255'],
                'company_registration_no' => ['nullable', 'string', 'max:50'],
                'sst_registration_no' => ['nullable', 'string', 'max:50'],
                'company_address' => ['nullable', 'string', 'max:500'],
                'company_city' => ['nullable', 'string', 'max:100'],
                'company_state' => ['nullable', 'string', 'max:100'],
                'company_postcode' => ['nullable', 'string', 'max:20'],
                'company_country' => ['nullable', 'string', 'max:100'],
                'company_phone' => ['nullable', 'string', 'max:30'],
                'company_email' => ['nullable', 'email', 'max:255'],
                'company_tin' => ['nullable', 'string', 'max:20'],
                'company_id_type' => ['sometimes', Rule::in(['BRN', 'NRIC'])],
                'company_msic_code' => ['nullable', 'digits:5'],
                'company_msic_description' => ['nullable', 'string', 'max:255'],
            ],
            'system' => [
                'date_format' => ['required', Rule::in(self::DATE_FORMATS)],
                'time_format' => ['required', Rule::in(self::TIME_FORMATS)],
                'default_language' => ['required', Rule::in(array_keys(config('app.locales')))],
            ],
            'currency' => [
                'currency_symbol' => ['required', 'string', 'max:10'],
                'currency_symbol_position' => ['required', Rule::in(['before', 'after'])],
                'currency_symbol_space' => ['required', 'boolean'],
                'decimal_format' => ['required', 'integer', 'between:0,4'],
                'decimal_separator' => ['required', Rule::in(['.', ','])],
                'thousands_separator' => ['required', Rule::in([',', '.', ' ', '']), 'different:decimal_separator'],
            ],
            'email' => [
                'mail_host' => ['nullable', 'string', 'max:255'],
                'mail_port' => ['required_with:mail_host', 'nullable', 'integer', 'between:1,65535'],
                'mail_username' => ['nullable', 'string', 'max:255'],
                'mail_password' => ['nullable', 'string', 'max:255'],
                'mail_encryption' => ['required', Rule::in(['tls', 'ssl', 'none'])],
                'mail_from_address' => ['required_with:mail_host', 'nullable', 'email', 'max:255'],
                'mail_from_name' => ['nullable', 'string', 'max:255'],
            ],
            default => abort(404),
        };
    }
}
