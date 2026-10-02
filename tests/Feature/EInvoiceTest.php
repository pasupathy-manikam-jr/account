<?php

namespace Tests\Feature;

use App\Http\Controllers\Sales\SalesInvoiceController;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Item;
use App\Models\ItemCategory;
use App\Models\SalesInvoice;
use App\Models\Tax;
use App\Models\Unit;
use App\Models\User;
use App\Support\Settings;
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\LedgerSeeder;
use Database\Seeders\RolesSeeder;
use EInvoiceSdk\Contracts\EInvoiceDriver;
use EInvoiceSdk\Drivers\FakeDriver;
use EInvoiceSdk\Drivers\JianniusDriver;
use EInvoiceSdk\Drivers\StatusResult;
use EInvoiceSdk\Enums\Status;
use EInvoiceSdk\Models\EInvoiceDocument;
use EInvoiceSdk\Models\EInvoiceSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private FakeDriver $driver;

    private User $admin;

    private User $client;

    private Item $chair;

    private Tax $sst;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, LedgerSeeder::class]);

        $this->driver = new FakeDriver;
        $this->app->instance(EInvoiceDriver::class, $this->driver);

        Settings::put([
            'company_name' => 'Lim Group Sdn. Bhd.',
            'company_registration_no' => '202301012345',
            'company_tin' => 'C12345678900',
            'company_id_type' => 'BRN',
            'company_msic_code' => '62010',
            'company_msic_description' => 'Computer programming activities',
            'company_address' => "Level 5, Menara A\nJalan Ampang",
            'company_city' => 'Kuala Lumpur',
            'company_state' => 'W.P. Kuala Lumpur',
            'company_postcode' => '50450',
            'company_phone' => '+60321618888',
        ]);
        EInvoiceSetting::create(['tin' => 'C12345678900', 'environment' => 'sandbox', 'unsigned' => true, 'client_id' => 'id', 'client_secret' => 'secret']);

        $this->admin = User::factory()->create(['type' => 'company'])->assignRole('company');
        $this->client = User::factory()->create(['type' => 'client'])->assignRole('client');
        Customer::create([
            'user_id' => $this->client->id, 'company_name' => 'Tan Trading Sdn. Bhd.', 'contact_person_name' => 'Tan', 'contact_person_email' => 'tan@example.com',
            'contact_person_mobile' => '+60123456789', 'tax_number' => 'C98765432100', 'id_type' => 'BRN', 'id_number' => '201901000005',
            'billing_address' => ['address_line_1' => '1 Jalan Tun Razak', 'city' => 'Petaling Jaya', 'state' => 'Selangor', 'country' => 'Malaysia', 'zip_code' => '47300'],
        ]);

        $category = ItemCategory::create(['name' => 'General', 'color' => '#10b981']);
        $unit = Unit::create(['unit_name' => 'Piece']);
        $this->sst = Tax::create(['tax_name' => 'Sales Tax 10%', 'rate' => '10.00', 'type_code' => '01']);
        $this->chair = Item::create(['name' => 'Office Chair', 'sku' => 'CHAIR-1', 'type' => 'service', 'category_id' => $category->id, 'unit_id' => $unit->id, 'classification_code' => '022', 'sale_price' => '250.00', 'purchase_price' => '120.00', 'is_active' => true]);
        $this->chair->taxes()->attach($this->sst);
    }

    private function postedInvoice(): SalesInvoice
    {
        $invoice = new SalesInvoice;
        $invoice->saveWithLines(
            ['type' => 'service', 'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31', 'customer_id' => $this->client->id],
            [['item_id' => $this->chair->id, 'quantity' => 4, 'unit_price' => '250.00', 'discount_percentage' => 10]],
        );
        $invoice->post();

        return $invoice->fresh();
    }

    private function creditNote(SalesInvoice $invoice): CreditNote
    {
        $note = new CreditNote;
        $note->forceFill([
            'credit_note_number' => 'CN-2026-10-001', 'credit_note_date' => '2026-10-02', 'customer_id' => $this->client->id, 'invoice_id' => $invoice->id,
            'reason' => 'Returned', 'subtotal' => '250.00', 'discount_amount' => '25.00', 'tax_amount' => '22.50', 'total_amount' => '247.50', 'status' => 'approved',
        ])->save();
        $note->items()->create(['item_id' => $this->chair->id, 'quantity' => 1, 'unit_price' => '250.00', 'discount_percentage' => 10, 'discount_amount' => '25.00', 'tax_percentage' => '10.00', 'taxes' => [['name' => 'Sales Tax 10%', 'rate' => '10.00', 'code' => '01']], 'tax_amount' => '22.50', 'total_amount' => '247.50']);

        return $note;
    }

    public function test_invoice_maps_to_an_lhdn_document_the_sdk_accepts(): void
    {
        $document = $this->postedInvoice()->toEInvoiceDocument();

        $this->assertSame('C12345678900', $document->supplier->tin);
        $this->assertSame('202301012345', $document->supplier->brn);
        $this->assertSame('Jalan Ampang', $document->supplier->addressLine2);
        $this->assertSame('C98765432100', $document->buyer->tin);
        $this->assertSame('201901000005', $document->buyer->brn);
        $this->assertSame(1000.0, $document->lines[0]->subtotal);
        $this->assertSame(100.0, $document->lines[0]->discount);
        $this->assertSame('01', $document->lines[0]->taxes[0]->code);
        $this->assertSame(90.0, $document->lines[0]->taxes[0]->amount);
        $this->assertSame(900.0, $document->subtotal);
        $this->assertSame(990.0, $document->grandTotal);
        $this->assertSame(['022'], $document->lines[0]->classificationCodes);

        // The real driver's local validation (the SDK's rules), no network.
        $this->assertSame([], (new JianniusDriver)->validate($document));
    }

    public function test_submitting_a_posted_invoice_ends_valid_and_shows_on_the_invoice(): void
    {
        $invoice = $this->postedInvoice();

        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]))->assertSessionHasNoErrors();

        $einvoice = EInvoiceDocument::sole();
        $this->assertSame(Status::Valid, $einvoice->status);
        $this->assertTrue($einvoice->einvoiceable->is($invoice));

        $this->actingAs($this->admin)->get(route('sales-invoices.show', $invoice))->assertInertia(fn ($page) => $page
            ->where('einvoice.status', 'valid')
            ->where('einvoice.validation_url', $einvoice->validationUrl()));
    }

    public function test_drafts_and_buyers_without_tin_are_refused(): void
    {
        $draft = new SalesInvoice;
        $draft->saveWithLines(['type' => 'service', 'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31', 'customer_id' => $this->client->id], [['item_id' => $this->chair->id, 'quantity' => 1, 'unit_price' => '250.00']]);
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $draft->id]));

        Customer::query()->update(['tax_number' => null]);
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $this->postedInvoice()->id]));

        $this->assertSame(0, EInvoiceDocument::count());
        $this->assertSame([], $this->driver->submitted);
    }

    public function test_tax_without_lhdn_type_is_a_clear_error(): void
    {
        $this->sst->update(['type_code' => null]);
        $invoice = $this->postedInvoice();
        $invoice->items()->update(['taxes' => [['name' => 'Sales Tax 10%', 'rate' => '10.00']]]);

        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]))
            ->assertInertiaFlash('toast.message', __('Set the LHDN tax type for ":tax" under Product & Service → Taxes.', ['tax' => 'Sales Tax 10%']));
        $this->assertSame(0, EInvoiceDocument::count());
    }

    public function test_credit_note_needs_the_invoice_validated_first_and_then_references_it(): void
    {
        $invoice = $this->postedInvoice();
        $note = $this->creditNote($invoice);

        $this->actingAs($this->admin)->post(route('einvoice.submit', ['credit-notes', $note->id]));
        $this->assertSame(0, EInvoiceDocument::count());

        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]));
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['credit-notes', $note->id]));

        $original = $invoice->einvoice()->sole();
        $this->assertSame($original->uuid, $this->driver->submitted[1]->originalUuid);
        $this->assertSame(Status::Valid, $note->einvoice()->sole()->status);
    }

    public function test_cancel_within_72_hours(): void
    {
        $invoice = $this->postedInvoice();
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]));
        $einvoice = EInvoiceDocument::sole();

        $this->actingAs($this->client)->put(route('einvoice.cancel', $einvoice), ['reason' => 'Wrong'])->assertForbidden();
        $this->actingAs($this->admin)->put(route('einvoice.cancel', $einvoice), ['reason' => 'Wrong buyer'])->assertSessionHasNoErrors();

        $this->assertSame(Status::Cancelled, $einvoice->fresh()->status);
    }

    public function test_settings_save_credentials_and_refuse_unsigned_production(): void
    {
        $this->actingAs($this->admin)->put(route('einvoice.settings'), ['environment' => 'production', 'client_id' => 'prod-id', 'client_secret' => 'prod-secret', 'unsigned' => true])
            ->assertSessionHasNoErrors();

        $production = EInvoiceSetting::where('environment', 'production')->sole();
        $this->assertFalse($production->unsigned);
        $this->assertTrue($production->active);
        $this->assertFalse(EInvoiceSetting::where('environment', 'sandbox')->sole()->active);

        // Blank secret keeps the saved one.
        $this->actingAs($this->admin)->put(route('einvoice.settings'), ['environment' => 'production', 'client_id' => 'prod-id', 'client_secret' => '']);
        $this->assertSame('prod-secret', $production->fresh()->client_secret);
    }

    public function test_pdf_carries_the_validation_qr_once_valid(): void
    {
        $invoice = $this->postedInvoice();
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]));

        $data = app(SalesInvoiceController::class)->pdfData($invoice);
        $html = view('pdf.document', $data)->render();
        $this->assertStringStartsWith('%PDF', Pdf::loadView('pdf.document', $data)->output());

        $this->assertStringContainsString(EInvoiceDocument::sole()->uuid, $html);
        $this->assertStringContainsString('data:image/svg+xml;base64,', $html);
    }

    public function test_technical_failures_show_a_plain_message_not_the_exception(): void
    {
        $invoice = $this->postedInvoice();
        $this->driver->submitResult = new \RuntimeException('cURL error 28: secret internals');

        // Sent in-request (sync): the transport error becomes a plain toast, not an error page.
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]))
            ->assertRedirect()
            ->assertInertiaFlash('toast.message', __('Could not reach LHDN. Please try sending again in a few minutes.'));

        $this->actingAs($this->admin)->get(route('sales-invoices.show', $invoice))->assertInertia(fn ($page) => $page
            ->where('einvoice.status', 'failed')
            ->where('einvoice.errors', [__('Could not reach LHDN. Please try sending again in a few minutes.')]));
    }

    public function test_check_status_asks_lhdn_again_while_submitted(): void
    {
        $invoice = $this->postedInvoice();
        $this->driver->statusResult = new StatusResult(Status::Submitted);
        $this->actingAs($this->admin)->post(route('einvoice.submit', ['sales-invoices', $invoice->id]));
        $einvoice = EInvoiceDocument::sole();
        $this->assertSame(Status::Submitted, $einvoice->status);

        $this->driver->statusResult = null; // LHDN has validated it by now
        $this->actingAs($this->client)->put(route('einvoice.poll', $einvoice))->assertForbidden();
        $this->actingAs($this->admin)->put(route('einvoice.poll', $einvoice))->assertRedirect();

        $this->assertSame(Status::Valid, $einvoice->fresh()->status);
    }
}
