{{--
    Shared PDF for sales documents. Pass: $doc (a priced document with customer, warehouse and items),
    $party (the customer or vendor login), $partyRecord (their customer/vendor record),
    $title, $number, $partyLabel, and $facts ([label => value]), optionally $paid (invoices) and $einvoice + $einvoiceQr
    (a validated LHDN e-invoice and its validation-link QR). The letterhead comes from Settings.
--}}
@php
    $money = fn ($v) => \App\Support\Settings::money($v);
    $address = $partyRecord?->billing_address ?? [];
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $number }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 11px; color: #1e293b; margin: 0; }
        .brand { color: #0369a1; font-size: 22px; font-weight: bold; }
        .muted { color: #64748b; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        table { width: 100%; border-collapse: collapse; }
        .meta td { vertical-align: top; padding: 0; }
        .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
        .items th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; }
        .items td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .right { text-align: right; }
        .totals td { padding: 4px 8px; }
        .grand td { font-size: 14px; font-weight: bold; border-top: 2px solid #0369a1; padding-top: 8px; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 10px; background: #e0f2fe; color: #0369a1; font-size: 10px; text-transform: uppercase; }
    </style>
</head>
<body>
    <table class="meta">
        <tr>
            <td>
                @include('pdf._company')
            </td>
            <td class="right">
                <h1>{{ $title }}</h1>
                <div><strong>{{ $number }}</strong></div>
                <div class="status">{{ __(ucfirst($doc->display_status)) }}</div>
            </td>
        </tr>
    </table>

    <table class="meta" style="margin-top: 24px;">
        <tr>
            <td style="width: 55%; padding-right: 12px;">
                <div class="box">
                    <div class="muted">{{ $partyLabel }}</div>
                    <strong>{{ $partyRecord?->company_name ?? $party->name }}</strong><br>
                    {{ $party->name }}<br>
                    {{ $party->email }}<br>
                    @foreach (['address_line_1', 'address_line_2'] as $line)
                        @if (! empty($address[$line])){{ $address[$line] }}<br>@endif
                    @endforeach
                    {{ collect([$address['zip_code'] ?? null, $address['city'] ?? null, $address['state'] ?? null])->filter()->implode(', ') }}
                </div>
            </td>
            <td>
                <div class="box">
                    <table>
                        @foreach ($facts as $label => $value)
                            <tr><td class="muted">{{ $label }}</td><td class="right">{{ $value }}</td></tr>
                        @endforeach
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <table class="items" style="margin-top: 24px;">
        <thead>
            <tr>
                <th>{{ __('Product') }}</th>
                <th class="right">{{ __('Qty') }}</th>
                <th class="right">{{ __('Unit Price') }}</th>
                <th class="right">{{ __('Discount') }}</th>
                <th class="right">{{ __('Tax') }}</th>
                <th class="right">{{ __('Total') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($doc->items as $line)
                <tr>
                    <td><strong>{{ $line->item->name }}</strong><br><span class="muted">{{ $line->item->sku }}</span></td>
                    <td class="right">{{ rtrim(rtrim($line->quantity, '0'), '.') }}</td>
                    <td class="right">{{ $money($line->unit_price) }}</td>
                    <td class="right">{{ (float) $line->discount_amount ? $money($line->discount_amount) : '-' }}</td>
                    <td class="right">
                        @foreach ($line->taxes ?? [] as $tax)
                            <span class="muted">{{ str_contains($tax['name'], '%') ? $tax['name'] : $tax['name'].' ('.(float) $tax['rate'].'%)' }}</span><br>
                        @endforeach
                        {{ (float) $line->tax_amount ? $money($line->tax_amount) : '-' }}
                    </td>
                    <td class="right">{{ $money($line->total_amount) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table style="margin-top: 16px;">
        <tr>
            <td style="width: 55%; vertical-align: top;">
                @if ($doc->notes)
                    <div class="muted">{{ __('Notes') }}</div>
                    <div>{{ $doc->notes }}</div>
                @endif
            </td>
            <td>
                <table class="totals">
                    <tr><td class="muted">{{ __('Subtotal') }}</td><td class="right">{{ $money($doc->subtotal) }}</td></tr>
                    @if ((float) $doc->discount_amount)
                        <tr><td class="muted">{{ __('Discount') }}</td><td class="right">-{{ $money($doc->discount_amount) }}</td></tr>
                    @endif
                    <tr><td class="muted">{{ __('Tax') }}</td><td class="right">{{ $money($doc->tax_amount) }}</td></tr>
                    <tr class="grand"><td>{{ __('Total Amount') }}</td><td class="right">{{ $money($doc->total_amount) }}</td></tr>
                    @isset($paid)
                        <tr><td class="muted">{{ __('Paid Amount') }}</td><td class="right">{{ $money($paid) }}</td></tr>
                        <tr><td><strong>{{ __('Balance Due') }}</strong></td><td class="right"><strong>{{ $money($doc->balance_amount) }}</strong></td></tr>
                    @endisset
                </table>
            </td>
        </tr>
    </table>

    @if (! empty($einvoice))
        <table style="margin-top: 16px;">
            <tr>
                <td style="width: 100px; vertical-align: top;"><img src="{{ $einvoiceQr }}" width="90" height="90" alt="LHDN validation QR"></td>
                <td style="vertical-align: top;">
                    <div><strong>{{ __('Validated e-Invoice (LHDN MyInvois)') }}</strong></div>
                    <div class="muted">{{ __('UUID') }}: {{ $einvoice->uuid }}</div>
                    <div class="muted">{{ __('Validated') }}: {{ \App\Support\Settings::date($einvoice->validated_at) }}</div>
                    <div class="muted">{{ __('Scan to verify with LHDN.') }}</div>
                </td>
            </tr>
        </table>
    @endif
</body>
</html>
