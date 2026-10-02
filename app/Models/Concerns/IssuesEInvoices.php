<?php

namespace App\Models\Concerns;

use App\Models\Customer;
use App\Models\Tax as TaxModel;
use App\Models\User;
use App\Support\Money;
use App\Support\Settings;
use EInvoiceSdk\Concerns\HasEInvoices;
use EInvoiceSdk\Data\Document;
use EInvoiceSdk\Data\LineItem;
use EInvoiceSdk\Data\Party;
use EInvoiceSdk\Data\Tax;
use EInvoiceSdk\Enums\DocumentType;
use EInvoiceSdk\Exceptions\EInvoiceException;
use EInvoiceSdk\Models\EInvoiceDocument;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;

/**
 * Sales documents sent to LHDN MyInvois (invoices, credit notes). The supplier is the company in Settings,
 * the buyer is the client user's customer profile, and lines come from the priced lines (HasPricedLines shape).
 *
 * The using model has customer() (a User), items() with item(), and subtotal / discount_amount / total_amount.
 */
trait IssuesEInvoices
{
    use HasEInvoices;

    abstract protected function einvoiceType(): DocumentType;

    abstract protected function einvoiceNumber(): string;

    /** The original document's e-invoice, for credit / debit / refund notes. */
    protected function einvoiceOriginal(): ?EInvoiceDocument
    {
        return null;
    }

    /**
     * The latest e-invoice submission for this document.
     *
     * @return MorphOne<EInvoiceDocument, $this>
     */
    public function einvoice(): MorphOne
    {
        return $this->morphOne(EInvoiceDocument::class, 'einvoiceable')->latestOfMany();
    }

    public function toEInvoiceDocument(): Document
    {
        $this->loadMissing(['items.item', 'customer.customer']);

        $lines = array_values($this->items->map(fn (Model $line) => $this->einvoiceLine($line))->all());
        $original = $this->einvoiceOriginal();

        return new Document(
            type: $this->einvoiceType(),
            number: $this->einvoiceNumber(),
            // LHDN rejects issue times more than 72 hours before submission, so the e-invoice is issued when it is submitted.
            issuedAt: now(),
            supplier: self::einvoiceSupplier(),
            buyer: $this->einvoiceBuyer(),
            lines: $lines,
            taxes: self::einvoiceTaxTotals($lines),
            subtotal: Money::toCents($this->subtotal) / 100 - Money::toCents($this->discount_amount) / 100,
            grandTotal: Money::toCents($this->total_amount) / 100,
            originalNumber: $original?->number,
            originalUuid: $original?->uuid,
        );
    }

    public static function einvoiceSupplier(): Party
    {
        $idType = Settings::get('company_id_type');
        $idNumber = Settings::get('company_registration_no');
        $address = self::addressLines(Settings::get('company_address'));

        return new Party(
            name: Settings::company(),
            tin: (string) Settings::get('company_tin'),
            brn: $idType === 'BRN' ? $idNumber : null,
            nric: $idType === 'NRIC' ? $idNumber : null,
            sstNumber: Settings::get('sst_registration_no') ?: null,
            email: Settings::get('company_email'),
            phone: Settings::get('company_phone'),
            addressLine1: $address[0] ?? null,
            addressLine2: $address[1] ?? null,
            addressLine3: $address[2] ?? null,
            postcode: Settings::get('company_postcode'),
            city: Settings::get('company_city'),
            state: Settings::get('company_state'),
            country: Settings::get('company_country') ?: 'MYS',
            msicCode: Settings::get('company_msic_code'),
            msicDescription: Settings::get('company_msic_description'),
        );
    }

    protected function einvoiceBuyer(): Party
    {
        /** @var User $user */
        $user = $this->customer;
        /** @var Customer|null $customer */
        $customer = $user->customer;
        $address = $customer->billing_address ?? [];
        $id = fn (string $type) => $customer?->id_type === $type ? $customer->id_number : null;

        return new Party(
            name: $customer?->company_name ?: $user->name,
            tin: (string) $customer?->tax_number,
            brn: $id('BRN'),
            nric: $id('NRIC'),
            passport: $id('PASSPORT'),
            army: $id('ARMY'),
            email: $customer?->contact_person_email ?: $user->email,
            phone: $customer?->contact_person_mobile ?: $user->mobile_no,
            addressLine1: $address['address_line_1'] ?? null,
            addressLine2: $address['address_line_2'] ?? null,
            postcode: $address['zip_code'] ?? null,
            city: $address['city'] ?? null,
            state: $address['state'] ?? null,
            country: ($address['country'] ?? null) ?: 'MYS',
        );
    }

    /** One priced line: gross = total − tax + discount; its tax is split across the line's taxes by rate. */
    protected function einvoiceLine(Model $line): LineItem
    {
        $total = Money::toCents($line->getAttribute('total_amount'));
        $tax = Money::toCents($line->getAttribute('tax_amount'));
        $discount = Money::toCents($line->getAttribute('discount_amount'));
        $gross = $total - $tax + $discount;
        $taxable = $gross - $discount;
        $item = $line->getRelation('item');

        return new LineItem(
            description: (string) $item->getAttribute('name'),
            quantity: (float) $line->getAttribute('quantity'),
            unitPrice: (float) $line->getAttribute('unit_price'),
            subtotal: $gross / 100,
            classificationCodes: [(string) $item->getAttribute('classification_code')],
            taxes: self::einvoiceLineTaxes($line->getAttribute('taxes') ?? [], $tax, $taxable),
            discount: $discount / 100,
        );
    }

    /**
     * @param  list<array{name: string, rate: string|float, code?: string|null}>  $snapshot
     * @return list<Tax>
     */
    private static function einvoiceLineTaxes(array $snapshot, int $taxCents, int $taxableCents): array
    {
        if ($snapshot === []) {
            return [new Tax('06', 0, $taxableCents / 100)];
        }

        $rates = array_map(fn (array $t) => Money::toCents($t['rate']), $snapshot);
        $totalRate = array_sum($rates);
        $left = $taxCents;

        return array_map(function (array $t, int $i) use ($rates, $totalRate, $taxCents, $taxableCents, &$left, $snapshot) {
            // Split the line's rounded tax by rate; the last tax takes the remainder so the parts add up exactly.
            $amount = $i === count($snapshot) - 1 ? $left : ($totalRate > 0 ? intdiv($taxCents * $rates[$i], $totalRate) : 0);
            $left -= $amount;

            $code = ($t['code'] ?? null) ?: TaxModel::query()->where('tax_name', $t['name'])->value('type_code');
            if (! $code) {
                throw new EInvoiceException(__('Set the LHDN tax type for ":tax" under Product & Service → Taxes.', ['tax' => $t['name']]));
            }

            return new Tax($code, $amount / 100, $taxableCents / 100, (float) $t['rate']);
        }, $snapshot, array_keys($snapshot));
    }

    /**
     * Document-level tax subtotals, one per tax type.
     *
     * @param  list<LineItem>  $lines
     * @return list<Tax>
     */
    private static function einvoiceTaxTotals(array $lines): array
    {
        $totals = [];

        foreach ($lines as $line) {
            foreach ($line->taxes as $tax) {
                $totals[$tax->code] ??= [0, 0];
                $totals[$tax->code][0] += Money::toCents($tax->amount);
                $totals[$tax->code][1] += Money::toCents($tax->taxableAmount);
            }
        }

        return array_map(fn (string $code, array $sum) => new Tax($code, $sum[0] / 100, $sum[1] / 100), array_keys($totals), $totals);
    }

    /** @return list<string> up to three non-empty address lines */
    private static function addressLines(?string $address): array
    {
        return array_slice(array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $address) ?: []))), 0, 3);
    }
}
