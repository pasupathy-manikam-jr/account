{{-- Customer / vendor detail PDF. Pass what ReportController::statementData() returns. --}}
@php
    $money = fn ($v) => \App\Support\Settings::money($v);
    $customer = $kind === 'customer';
    $day = fn ($d) => \App\Support\Settings::date($d);
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $party['name'] }}</title>
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
    </style>
</head>
<body>
    @include('pdf._company')
    <h1>{{ $customer ? __('Customer Detail Report') : __('Vendor Detail Report') }}</h1>
    <div><strong>{{ $party['name'] }}</strong> · {{ $party['email'] }}</div>
    <div class="muted">{{ $day($filters['date_from']) }} – {{ $day($filters['date_to']) }}</div>

    <table>
        <tr>
            <th>{{ __('Date') }}</th>
            <th>{{ __('Journal') }}</th>
            <th>{{ __('Description') }}</th>
            <th class="right">{{ $customer ? __('Charges') : __('Bills') }}</th>
            <th class="right">{{ $customer ? __('Payments & Credits') : __('Payments & Debits') }}</th>
            <th class="right">{{ __('Balance') }}</th>
        </tr>
        <tr><td>{{ $day($filters['date_from']) }}</td><td colspan="4"><strong>{{ __('Opening Balance') }}</strong></td><td class="right">{{ $money($opening) }}</td></tr>
        @foreach ($rows as $row)
            <tr>
                <td>{{ $day($row['date']) }}</td>
                <td>{{ $row['number'] }}</td>
                <td>{{ $row['description'] }}</td>
                <td class="right">{{ $money($customer ? $row['debit'] : $row['credit']) }}</td>
                <td class="right">{{ $money($customer ? $row['credit'] : $row['debit']) }}</td>
                <td class="right">{{ $money($row['balance']) }}</td>
            </tr>
        @endforeach
        <tr class="total">
            <td colspan="3">{{ __('Closing Balance') }}</td>
            <td class="right">{{ $money($customer ? $debits : $credits) }}</td>
            <td class="right">{{ $money($customer ? $credits : $debits) }}</td>
            <td class="right">{{ $money($closing) }}</td>
        </tr>
    </table>
</body>
</html>
