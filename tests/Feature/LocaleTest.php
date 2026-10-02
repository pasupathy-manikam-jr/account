<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_in_users_language_is_saved_and_applied()
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('locale.update'), ['locale' => 'ar'])->assertRedirect();

        $this->assertSame('ar', $user->fresh()->lang);
        $this->followingRedirects()->get(route('dashboard'))->assertInertia(fn ($page) => $page->where('locale', 'ar'));
    }

    public function test_guests_language_is_kept_in_the_session()
    {
        $this->post(route('locale.update'), ['locale' => 'ms']);

        $this->get(route('login'))->assertInertia(fn ($page) => $page->where('locale', 'ms'));
    }

    public function test_unknown_locales_are_rejected()
    {
        $this->post(route('locale.update'), ['locale' => 'xx'])->assertSessionHasErrors('locale');
        $this->get(route('translations.show', '..%2F..%2F.env'))->assertNotFound();
        $this->get(route('translations.show', 'xx'))->assertNotFound();
    }

    public function test_translations_are_served_for_known_locales()
    {
        $this->get(route('translations.show', 'ar'))
            ->assertOk()
            ->assertJsonPath('Dashboard', 'لوحة التحكم');

        $this->get(route('translations.show', 'en'))->assertOk()->assertExactJson([]);
    }
}
