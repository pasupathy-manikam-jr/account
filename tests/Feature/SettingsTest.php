<?php

namespace Tests\Feature;

use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_section_saves_with_laravel_validation_and_drives_formatting(): void
    {
        $this->actingAs($this->userWithRole());

        $this->put(route('company-settings.update', 'company'), ['company_name' => ''])->assertSessionHasErrors('company_name');
        $this->put(route('company-settings.update', 'company'), ['company_name' => 'Syarikat Maju Jaya Sdn. Bhd.', 'company_email' => 'akaun@majujaya.my'])->assertSessionHasNoErrors();
        $this->assertSame('Syarikat Maju Jaya Sdn. Bhd.', Settings::company());

        $this->put(route('company-settings.update', 'currency'), ['currency_symbol' => 'RM', 'currency_symbol_position' => 'before', 'currency_symbol_space' => true, 'decimal_format' => 2, 'decimal_separator' => ',', 'thousands_separator' => ','])
            ->assertSessionHasErrors('thousands_separator');
        $this->put(route('company-settings.update', 'currency'), ['currency_symbol' => 'RM', 'currency_symbol_position' => 'before', 'currency_symbol_space' => true, 'decimal_format' => 2, 'decimal_separator' => ',', 'thousands_separator' => '.'])
            ->assertSessionHasNoErrors();
        $this->assertSame('-RM 1.234,50', Settings::money(-1234.5));

        $this->put(route('company-settings.update', 'system'), ['date_format' => 'Y/m/d', 'time_format' => 'H:i', 'default_language' => 'ms'])->assertSessionHasErrors('date_format');
        $this->put(route('company-settings.update', 'system'), ['date_format' => 'd/m/Y', 'time_format' => 'H:i', 'default_language' => 'ms'])->assertSessionHasNoErrors();
        $this->assertSame('01/10/2026', Settings::date('2026-10-01'));

        $this->get(route('company-settings'))->assertOk()->assertInertia(fn ($page) => $page
            ->where('globalSettings.companyName', 'Syarikat Maju Jaya Sdn. Bhd.')
            ->where('globalSettings.dateFormat', 'd/m/Y')
            ->where('globalSettings.currencySymbolSpace', true));

        // Guests get the default language.
        auth()->logout();
        $this->get(route('login'))->assertInertia(fn ($page) => $page->where('locale', 'ms'));
    }

    public function test_the_smtp_password_is_encrypted_never_shown_and_kept_when_blank(): void
    {
        $this->actingAs($this->userWithRole());
        $email = ['mail_host' => 'smtp.example.com', 'mail_port' => 587, 'mail_username' => 'akaun', 'mail_encryption' => 'tls', 'mail_from_address' => 'akaun@example.com'];

        $this->put(route('company-settings.update', 'email'), [...$email, 'mail_password' => 'rahsia-123'])->assertSessionHasNoErrors();
        $this->assertNotSame('rahsia-123', DB::table('settings')->where('key', 'mail_password')->value('value'));
        $this->put(route('company-settings.update', 'email'), [...$email, 'mail_password' => ''])->assertSessionHasNoErrors();
        $this->assertSame('rahsia-123', Settings::get('mail_password'));

        $this->get(route('company-settings'))->assertInertia(fn ($page) => $page->missing('values.mail_password')->where('hasMailPassword', true));

        Settings::applyMailConfig();
        $this->assertSame(['smtp', 'smtp.example.com', 'rahsia-123'], [config('mail.default'), config('mail.mailers.smtp.host'), config('mail.mailers.smtp.password')]);
    }

    public function test_test_email_and_permissions(): void
    {
        $this->actingAs($this->userWithRole());
        Event::fake([MessageSent::class]);

        $this->post(route('company-settings.test-email'), ['test_email' => 'bukan-emel'])->assertSessionHasErrors('test_email');
        $this->post(route('company-settings.test-email'), ['test_email' => 'ali@example.com'])->assertSessionHasNoErrors();
        Event::assertDispatched(MessageSent::class);

        $this->actingAs($this->userWithRole('staff'))->get(route('company-settings'))->assertForbidden();
        $this->put(route('company-settings.update', 'company'), ['company_name' => 'X'])->assertForbidden();
    }
}
