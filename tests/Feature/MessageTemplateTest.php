<?php

namespace Tests\Feature;

use App\Models\MessageTemplate;
use Database\Seeders\MessageTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageTemplateTest extends TestCase
{
    use RefreshDatabase;

    public function test_templates_render_in_the_locale_and_fall_back_to_english(): void
    {
        $this->seed(MessageTemplateSeeder::class);
        $this->assertSame(7, MessageTemplate::query()->where('channel', 'email')->count());
        $this->assertSame(11, MessageTemplate::query()->where('channel', 'notification')->count());

        $values = ['app_name' => 'Akaun', 'name' => 'Puan Aisyah', 'email' => 'aisyah@example.com', 'password' => 'Zx123456', 'app_url' => 'https://akaun.test', 'company_name' => 'Lim Group'];
        $ms = MessageTemplate::render('email', 'new_user', $values, 'ms');
        $this->assertSame('Selamat datang ke Akaun', $ms['subject']);
        $this->assertStringContainsString('Salam Puan Aisyah', $ms['body']);

        // A language without wording falls back to English.
        MessageTemplate::query()->where('slug', 'new_user')->where('channel', 'email')->sole()->contents()->where('locale', 'zh')->delete();
        $this->assertSame('Welcome to Akaun', MessageTemplate::render('email', 'new_user', $values, 'zh')['subject']);
    }

    public function test_the_company_edits_wording_per_language_with_laravel_validation(): void
    {
        $this->seed(MessageTemplateSeeder::class);
        $this->actingAs($this->userWithRole());
        $email = MessageTemplate::query()->where('channel', 'email')->where('slug', 'payment_reminder')->sole();
        $note = MessageTemplate::query()->where('channel', 'notification')->where('slug', 'new_vendor')->sole();

        $this->get(route('email-templates.index'))->assertOk()->assertInertia(fn ($page) => $page->where('channel', 'email')->has('templates.data', 7));
        $this->get(route('email-templates.edit', $email))->assertOk()->assertInertia(fn ($page) => $page->has('contents.ar'));
        // A notification template is not reachable through the email routes.
        $this->get(route('email-templates.edit', $note))->assertNotFound();

        $this->put(route('email-templates.update', $email), ['locale' => 'ms', 'subject' => '', 'body' => 'x'])->assertSessionHasErrors('subject');
        $this->put(route('email-templates.update', $email), ['locale' => 'fr', 'subject' => 'S', 'body' => 'x'])->assertSessionHasErrors('locale');
        $this->put(route('email-templates.update', $email), ['locale' => 'ms', 'from_name' => 'Akaun Lim', 'subject' => 'Peringatan {invoice_number}', 'body' => 'Sila bayar {balance_due}.'])
            ->assertSessionHasNoErrors();
        $this->assertSame('Peringatan SI-1', MessageTemplate::render('email', 'payment_reminder', ['invoice_number' => 'SI-1'], 'ms')['subject']);
        $this->assertSame('Akaun Lim', $email->refresh()->from_name);

        $this->put(route('notification-templates.update', $note), ['locale' => 'en', 'subject' => 'No', 'body' => 'x'])->assertSessionHasErrors('subject');
        $this->put(route('notification-templates.update', $note), ['locale' => 'en', 'body' => 'Vendor {vendor_name} joined.'])->assertSessionHasNoErrors();

        // Re-seeding keeps edits.
        $this->seed(MessageTemplateSeeder::class);
        $this->assertSame('Vendor X joined.', MessageTemplate::render('notification', 'new_vendor', ['vendor_name' => 'X'], 'en')['body']);

        $this->actingAs($this->userWithRole('staff'))->get(route('email-templates.index'))->assertForbidden();
    }
}
