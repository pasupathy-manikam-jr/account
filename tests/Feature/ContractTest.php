<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Models\ContractNote;
use App\Models\ContractType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ContractTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private ContractType $type;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client = $this->userWithRole('client');
        $this->type = ContractType::create(['name' => 'Software Development Agreement']);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'subject' => 'Payroll System Upgrade',
            'user_id' => $this->client->id,
            'type_id' => $this->type->id,
            'value' => '125000.50',
            'start_date' => '2026-10-01',
            'end_date' => '2027-09-30',
            'status' => 'pending',
            'description' => 'Upgrade of the payroll platform with EPF and SOCSO reporting.',
            ...$overrides,
        ];
    }

    private function contract(array $overrides = []): Contract
    {
        $contract = new Contract([...$this->payload(), ...$overrides]);
        $contract->forceFill(['created_by' => $overrides['created_by'] ?? null])->save();
        $contract->forceFill(['contract_number' => sprintf('CON%04d', $contract->id)])->save();

        return $contract;
    }

    public function test_creates_updates_duplicates_and_deletes_contracts(): void
    {
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('contracts.store'), $this->payload())->assertSessionHasNoErrors();
        $contract = Contract::query()->sole();
        $this->assertSame(sprintf('CON%04d', $contract->id), $contract->contract_number);
        $this->assertSame('125000.50', $contract->value);

        $this->actingAs($user)->put(route('contracts.update', $contract), $this->payload(['status' => 'accepted']))->assertSessionHasNoErrors();
        $this->actingAs($user)->put(route('contracts.status', $contract), ['status' => 'closed'])->assertSessionHasNoErrors();
        $this->assertSame('closed', $contract->fresh()->status);

        $this->actingAs($user)->post(route('contracts.duplicate', $contract));
        $copy = Contract::query()->latest('id')->firstOrFail();
        $this->assertNotSame($contract->id, $copy->id);
        $this->assertSame('pending', $copy->status);
        $this->assertSame($contract->subject, $copy->subject);

        $this->actingAs($user)->delete(route('contracts.destroy', $contract));
        $this->assertModelMissing($contract);
    }

    public function test_validates_input(): void
    {
        $company = User::factory()->create(['type' => 'company']);

        $this->actingAs($this->userWithRole())
            ->post(route('contracts.store'), $this->payload(['subject' => '', 'end_date' => '2026-09-01', 'value' => '-5', 'status' => 'active', 'user_id' => $company->id]))
            ->assertSessionHasErrors(['subject', 'end_date', 'value', 'status', 'user_id']);

        $this->assertDatabaseCount('contracts', 0);
    }

    public function test_lists_with_counts_and_shows_the_detail_page(): void
    {
        $this->contract(['status' => 'accepted']);
        $this->contract(['status' => 'declined']);
        $user = $this->userWithRole();

        $this->actingAs($user)->get(route('contracts.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('contracts/index')
                ->where('counts', ['all' => 2, 'pending' => 0, 'accepted' => 1, 'declined' => 1, 'closed' => 0]));

        $this->actingAs($user)->get(route('contracts.show', Contract::query()->first()))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('contracts/show')->where('hasSigned', false));
    }

    public function test_users_without_manage_any_only_see_their_own_contracts(): void
    {
        $mine = $this->contract();
        $other = $this->contract(['user_id' => User::factory()->create(['type' => 'client'])->id]);
        $created = $this->contract(['user_id' => User::factory()->create(['type' => 'vendor'])->id, 'created_by' => $this->client->id]);

        $this->actingAs($this->client)->get(route('contracts.index'))
            ->assertInertia(fn ($page) => $page->has('contracts.data', 2));
        $this->actingAs($this->client)->get(route('contracts.show', $mine))->assertOk();
        $this->actingAs($this->client)->get(route('contracts.show', $created))->assertOk();
        $this->actingAs($this->client)->get(route('contracts.show', $other))->assertNotFound();
        $this->actingAs($this->client)->post(route('contracts.duplicate', $other))->assertNotFound();
    }

    public function test_the_printable_preview_follows_the_same_visibility(): void
    {
        $mine = $this->contract();
        $other = $this->contract(['user_id' => User::factory()->create(['type' => 'client'])->id]);

        $this->actingAs($this->userWithRole())->get(route('contracts.preview', $other))->assertOk()
            ->assertInertia(fn ($page) => $page->component('contracts/preview')->where('contract.id', $other->id)->has('contract.signatures'));
        $this->actingAs($this->client)->get(route('contracts.preview', $mine))->assertOk();
        $this->actingAs($this->client)->get(route('contracts.preview', $other))->assertNotFound();
    }

    public function test_permission_denials(): void
    {
        $contract = $this->contract();

        $this->actingAs($this->userWithRole('vendor'))->get(route('contracts.index'))->assertForbidden();
        $this->actingAs($this->client)->put(route('contracts.update', $contract), $this->payload())->assertForbidden();
        $this->actingAs($this->client)->delete(route('contracts.destroy', $contract))->assertForbidden();
        $this->actingAs($this->userWithRole('staff'))->post(route('contracts.store'), $this->payload())->assertForbidden();
    }

    public function test_attachments_upload_download_and_delete(): void
    {
        Storage::fake('public');
        $contract = $this->contract();
        $user = $this->userWithRole();

        $this->actingAs($user)->post(route('contracts.attachments.store', $contract), [
            'file' => UploadedFile::fake()->create('scope.pdf', 120, 'application/pdf'),
        ])->assertSessionHasNoErrors();
        $attachment = $contract->attachments()->sole();
        Storage::disk('public')->assertExists($attachment->file_path);
        $this->assertSame('scope.pdf', $attachment->file_name);

        $this->actingAs($user)->get(route('contracts.attachments.download', ['contract' => $contract, 'attachment' => $attachment]))->assertOk();

        $this->actingAs($user)->post(route('contracts.attachments.store', $contract), [
            'file' => UploadedFile::fake()->create('virus.exe', 10),
        ])->assertSessionHasErrors('file');
        $this->actingAs($user)->post(route('contracts.attachments.store', $contract), [
            'file' => UploadedFile::fake()->create('huge.pdf', 11000, 'application/pdf'),
        ])->assertSessionHasErrors('file');

        $this->actingAs($user)->delete(route('contracts.attachments.destroy', ['contract' => $contract, 'attachment' => $attachment]));
        $this->assertModelMissing($attachment);
        Storage::disk('public')->assertMissing($attachment->file_path);
    }

    public function test_each_user_signs_once(): void
    {
        $contract = $this->contract();

        $this->actingAs($this->client)->post(route('contracts.sign', $contract), ['signer_name' => 'Dato\' Seri Mohd Nazri'])->assertSessionHasNoErrors();
        $this->actingAs($this->client)->post(route('contracts.sign', $contract), ['signer_name' => 'Again']);
        $this->actingAs($this->client)->post(route('contracts.sign', $contract), ['signer_name' => ''])->assertSessionHasErrors('signer_name');

        $signature = $contract->signatures()->sole();
        $this->assertStringStartsWith('data:image/svg+xml;base64,', $signature->signature_data);
        $this->assertStringContainsString('Nazri', base64_decode(substr($signature->signature_data, 26)));
        $this->actingAs($this->client)->get(route('contracts.show', $contract))->assertInertia(fn ($page) => $page->where('hasSigned', true));
    }

    public function test_comments_notes_and_renewals(): void
    {
        $contract = $this->contract();
        $user = $this->userWithRole();

        $this->actingAs($this->client)->post(route('contracts.notes.store', ['contract' => $contract, 'type' => 'comment']), ['body' => 'Please add a maintenance clause.'])->assertSessionHasNoErrors();
        $comment = $contract->comments()->sole();
        $this->actingAs($this->client)->put(route('contracts.notes.update', ['contract' => $contract, 'note' => $comment]), ['body' => 'Please add a 12-month maintenance clause.']);
        $this->assertTrue($comment->fresh()->is_edited);

        // Clients cannot write internal notes; the company can.
        $this->actingAs($user)->post(route('contracts.notes.store', ['contract' => $contract, 'type' => 'note']), ['body' => 'Check SST on the licence fee.'])->assertSessionHasNoErrors();
        $this->assertSame(1, $contract->notes()->count());

        $this->actingAs($user)->post(route('contracts.renewals.store', $contract), [
            'start_date' => '2027-10-01', 'end_date' => '2028-09-30', 'value' => '130000', 'status' => 'draft', 'notes' => 'Annual renewal.',
        ])->assertSessionHasNoErrors();
        $renewal = $contract->renewals()->sole();
        $this->actingAs($user)->put(route('contracts.renewals.update', ['contract' => $contract, 'renewal' => $renewal]), [
            'start_date' => '2027-10-01', 'end_date' => '2028-09-30', 'value' => '135000', 'status' => 'approved',
        ])->assertSessionHasNoErrors();
        $this->assertSame('approved', $renewal->fresh()->status);
        $this->actingAs($user)->post(route('contracts.renewals.store', $contract), [
            'start_date' => '2027-10-01', 'end_date' => '2027-01-01', 'value' => '1', 'status' => 'renewed',
        ])->assertSessionHasErrors(['end_date', 'status']);

        $this->actingAs($user)->delete(route('contracts.renewals.destroy', ['contract' => $contract, 'renewal' => $renewal]));
        $this->assertModelMissing($renewal);
        $this->actingAs($user)->delete(route('contracts.notes.destroy', ['contract' => $contract, 'note' => $comment]));
        $this->assertModelMissing($comment);
    }

    public function test_cannot_reach_another_contracts_items_through_a_visible_one(): void
    {
        $visible = $this->contract();
        $hidden = $this->contract(['user_id' => User::factory()->create(['type' => 'client'])->id]);
        $note = $hidden->hasMany(ContractNote::class)->create(['type' => 'comment', 'body' => 'Private', 'user_id' => null]);

        $this->actingAs($this->client)->delete(route('contracts.notes.destroy', ['contract' => $visible, 'note' => $note]))->assertNotFound();
        $this->assertModelExists($note);
    }
}
