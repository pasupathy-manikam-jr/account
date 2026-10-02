{{--
    Accounting reports PDF. Pass what ReportController::build() returns ($report, $filters, $data).
--}}
@php
    $money = fn ($v) => \App\Support\Settings::money($v);
    $kind = str_starts_with($report, 'invoice') || str_starts_with($report, 'customer') ? __('Customer') : __('Vendor');
    $titles = [
        'invoice-aging' => __('Invoice Aging Report'),
        'bill-aging' => __('Bill Aging Report'),
        'tax-summary' => __('Tax Summary Report'),
        'customer-balance' => __('Customer Balance Summary'),
        'vendor-balance' => __('Vendor Balance Summary'),
    ];
    $columns = str_ends_with($report, 'aging')
        ? ['current' => __('Current'), '1_30' => __('1-30 Days'), '31_60' => __('31-60 Days'), '61_90' => __('61-90 Days'), 'over_90' => __('>90 Days'), 'total' => __('Total')]
        : ['invoiced' => __('Total Invoiced'), 'notes' => $kind === __('Customer') ? __('Total Returns & Credit Notes') : __('Total Returns & Debit Notes'), 'paid' => __('Total Paid'), 'balance' => __('Balance')];
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $titles[$report] }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 11px; color: #1e293b; margin: 0; }
        .brand { color: #0369a1; font-size: 20px; font-weight: bold; }
        .muted { color: #64748b; }
        h1 { font-size: 16px; margin: 16px 0 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f1f5f9; text-align: left; padding: 7px; font-size: 10px; text-transform: uppercase; color: #475569; }
        td { padding: 7px; border-bottom: 1px solid #e2e8f0; }
        .right { text-align: right; }
        .total td { font-weight: bold; background: #f8fafc; border-top: 2px solid #0369a1; }
        .section td { font-weight: bold; background: #f8fafc; }
    </style>
</head>
<body>
    @include('pdf._company')
    <h1>{{ $titles[$report] }}</h1>
    <div class="muted">
        @if ($report === 'tax-summary')
            {{ \App\Support\Settings::date($filters['date_from']) }} – {{ \App\Support\Settings::date($filters['date_to']) }}
        @else
            {{ __('As of :date', ['date' => \App\Support\Settings::date($filters['as_of'])]) }}
        @endif
    </div>

    @if ($report === 'tax-summary')
        <table>
            @foreach ([['Tax Collected (Sales)', 'collected', 'total_collected', 'Total Tax Collected'], ['Tax Paid (Purchases)', 'paid', 'total_paid', 'Total Tax Paid']] as [$heading, $key, $totalKey, $totalLabel])
                <tr class="section"><td colspan="2">{{ __($heading) }}</td></tr>
                @forelse ($data[$key] as $tax)
                    <tr><td>{{ $tax['name'] }}</td><td class="right">{{ $money($tax['amount']) }}</td></tr>
                @empty
                    <tr><td colspan="2" class="muted">{{ __('No tax in this period.') }}</td></tr>
                @endforelse
                <tr><td><strong>{{ __($totalLabel) }}</strong></td><td class="right"><strong>{{ $money($data[$totalKey]) }}</strong></td></tr>
            @endforeach
            <tr class="total"><td>{{ __('Net Tax Liability') }}</td><td class="right">{{ $money($data['net']) }}</td></tr>
        </table>
    @else
        <table>
            <tr>
                <th>{{ $kind }}</th>
                @unless (str_ends_with($report, 'aging'))<th>{{ __('Email') }}</th>@endunless
                @foreach ($columns as $label)<th class="right">{{ $label }}</th>@endforeach
            </tr>
            @forelse ($data['rows'] as $row)
                <tr>
                    <td>{{ $row['name'] }}</td>
                    @unless (str_ends_with($report, 'aging'))<td>{{ $row['email'] }}</td>@endunless
                    @foreach ($columns as $key => $label)<td class="right">{{ $money($row[$key]) }}</td>@endforeach
                </tr>
            @empty
                <tr><td colspan="{{ count($columns) + 2 }}" class="muted">{{ __('Nothing outstanding.') }}</td></tr>
            @endforelse
            <tr class="total">
                <td @unless (str_ends_with($report, 'aging')) colspan="2" @endunless>{{ __('Total') }}</td>
                @foreach ($columns as $key => $label)<td class="right">{{ $money($data['totals'][$key]) }}</td>@endforeach
            </tr>
        </table>
    @endif
</body>
</html>
