<?php

namespace App\Http\Controllers;

use App\Models\CreditNote;
use App\Models\SalesInvoice;
use App\Support\Settings;
use EInvoiceSdk\Contracts\EInvoiceable;
use EInvoiceSdk\EInvoice;
use EInvoiceSdk\Enums\Environment;
use EInvoiceSdk\Enums\Status;
use EInvoiceSdk\Exceptions\EInvoiceException;
use EInvoiceSdk\Models\EInvoiceDocument;
use EInvoiceSdk\Models\EInvoiceSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * LHDN MyInvois: send sales invoices and credit notes, cancel them, check buyer TINs, and keep the company's
 * MyInvois credentials. Everything runs when the user clicks (QUEUE_CONNECTION=sync); the show pages read the result from the e-invoice record.
 */
class EInvoiceController extends Controller
{
    /** Route segment => [model, permission that may submit and cancel it]. */
    private const DOCUMENTS = [
        'sales-invoices' => [SalesInvoice::class, 'post-sales-invoices'],
        'credit-notes' => [CreditNote::class, 'approve-credit-notes'],
    ];

    public function __construct(private EInvoice $einvoice) {}

    public function submit(Request $request, string $type, int $id): RedirectResponse
    {
        [$class, $permission] = self::DOCUMENTS[$type];
        abort_unless($request->user()?->can($permission), 403);

        /** @var SalesInvoice|CreditNote $document */
        $document = $class::query()->findOrFail($id);

        if (! $document->canSubmitEInvoice()) {
            return $this->toast('error', __('Only posted or approved documents can be sent to LHDN.'));
        }

        try {
            $preview = $document->toEInvoiceDocument();
        } catch (EInvoiceException $e) {
            return $this->toast('error', $e->getMessage());
        }

        if ($document instanceof CreditNote && ! $preview->originalUuid) {
            return $this->toast('error', __('Send the original invoice to LHDN first; a credit note must reference its validated e-invoice.'));
        }

        if (! $preview->buyer->tin) {
            return $this->toast('error', __('This customer has no TIN. Add it on the customer, or leave the sale for the monthly consolidated e-invoice.'));
        }

        try {
            $this->einvoice->submit($document);
        } catch (ValidationException $e) {
            return $this->toast('error', __('LHDN needs more details: :errors', ['errors' => implode(' ', $e->errors()['einvoice'] ?? [])]));
        } catch (EInvoiceException $e) {
            return $this->toast('error', $e->getMessage());
        } catch (Throwable $e) {
            // The send runs in this request; the e-invoice is already marked failed and logged.
            report($e);

            return $this->toast('error', __('Could not reach LHDN. Please try sending again in a few minutes.'));
        }

        return $this->done(__('Sent to LHDN. Use "Check status" in a few seconds if it still shows submitted.'));
    }

    public function cancel(Request $request, EInvoiceDocument $einvoice): RedirectResponse
    {
        $this->authorizeDocument($request, $einvoice);

        $reason = $request->validate(['reason' => ['required', 'string', 'max:300']])['reason'];

        try {
            $this->einvoice->cancel($einvoice, $reason);
        } catch (EInvoiceException $e) {
            return $this->toast('error', $e->getMessage());
        }

        return $this->done(__('Cancellation sent to LHDN.'));
    }

    /** Ask LHDN once whether a submitted e-invoice has been validated yet. */
    public function poll(Request $request, EInvoiceDocument $einvoice): RedirectResponse
    {
        $this->authorizeDocument($request, $einvoice);

        try {
            $this->einvoice->poll($einvoice);
        } catch (Throwable $e) {
            report($e);

            return $this->toast('error', __('Could not reach LHDN. Please try again in a few minutes.'));
        }

        return back();
    }

    /** Check a buyer's TIN against their ID with LHDN before saving the customer. */
    public function validateTin(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tin' => ['required', 'string', 'max:20'],
            'id_type' => ['required', Rule::in(['BRN', 'NRIC', 'PASSPORT', 'ARMY'])],
            'id_number' => ['required', 'string', 'max:30'],
        ]);

        try {
            $valid = $this->einvoice->validateTin((string) Settings::get('company_tin'), $data['tin'], $data['id_type'], $data['id_number']);
        } catch (Throwable $e) {
            report($e);

            return $this->toast('error', __('Could not reach LHDN to check the TIN: :error', ['error' => $e->getMessage()]));
        }

        return $valid
            ? $this->done(__('LHDN confirms this TIN matches the ID.'))
            : $this->toast('error', __('LHDN does not recognise this TIN with that ID.'));
    }

    /** Save the MyInvois credentials for the company TIN and make them the ones used for new submissions. */
    public function saveSettings(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->can('edit-company-settings'), 403);

        $tin = Settings::get('company_tin');
        if (! $tin) {
            return $this->toast('error', __('Enter the company TIN under Company settings first.'));
        }

        $data = $request->validate([
            'environment' => ['required', Rule::enum(Environment::class)],
            'client_id' => ['nullable', 'string', 'max:100'],
            'client_secret' => ['nullable', 'string', 'max:100'],
            'unsigned' => ['boolean', Rule::excludeIf($request->input('environment') === 'production')],
            'certificate' => ['nullable', 'string', 'max:20000'],
            'private_key' => ['nullable', 'string', 'max:20000'],
        ]);

        $setting = EInvoiceSetting::firstOrNew(['tin' => $tin, 'environment' => $data['environment']]);
        // Secrets left blank keep their saved value.
        $setting->fill(array_filter($data, fn ($value) => $value !== null && $value !== ''));
        $setting->unsigned = $data['environment'] === 'sandbox' && ($data['unsigned'] ?? false);

        if (! $setting->client_id || ! $setting->client_secret) {
            throw ValidationException::withMessages(['client_id' => __('Client ID and secret are required.')]);
        }

        $setting->save();
        $setting->activate();

        return $this->done(__('MyInvois settings saved.'));
    }

    /** The user may act on this e-invoice when they hold the permission for its document type. */
    private function authorizeDocument(Request $request, EInvoiceDocument $einvoice): void
    {
        $type = array_search($einvoice->einvoiceable_type, array_map(fn (array $d) => (new $d[0])->getMorphClass(), self::DOCUMENTS), true);
        abort_unless($type !== false && $request->user()?->can(self::DOCUMENTS[$type][1]), 403);
    }

    /**
     * What the show pages need about a document's e-invoice.
     *
     * @return array<string, mixed>|null
     */
    public static function summary(Model&EInvoiceable $document): ?array
    {
        /** @var EInvoiceDocument|null $einvoice */
        $einvoice = $document->getRelationValue('einvoice');

        return $einvoice ? [
            'id' => $einvoice->id,
            'status' => $einvoice->status->value,
            'environment' => $einvoice->environment->value,
            'uuid' => $einvoice->uuid,
            'validation_url' => $einvoice->validationUrl(),
            'validated_at' => $einvoice->validated_at?->toIso8601String(),
            'cancel_until' => $einvoice->canCancel() ? $einvoice->validated_at?->copy()->addHours(EInvoiceDocument::CANCEL_WINDOW_HOURS)->toIso8601String() : null,
            // LHDN's own rejection reasons are shown; technical failures stay in the log (einvoice_logs) and get a plain message.
            'errors' => match ($einvoice->status) {
                Status::Invalid => $einvoice->logs()->latest('id')->first()->errors ?? [],
                Status::Failed => [__('Could not reach LHDN. Please try sending again in a few minutes.')],
                default => [],
            },
        ] : null;
    }
}
