{{--
    Double Entry statements PDF. Pass $statement (ledger-summary, trial-balance, profit-loss, balance-sheet),
    $filters, and $report (formatted amounts) or $lines for the ledger summary.
--}}
@php
    $money = fn ($v) => \App\Support\Settings::money($v);
    $day = fn ($d) => \App\Support\Settings::date($d);
    $titles = ['ledger-summary' => __('Ledger Summary'), 'trial-balance' => __('Trial Balance'), 'profit-loss' => __('Statement of Profit or Loss'), 'balance-sheet' => __('Statement of Financial Position')];
    $label = fn ($r) => trim(($r['code'] ? $r['code'].' · ' : '').$r['name']);
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $titles[$statement] }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 10.5px; color: #1e293b; margin: 0; }
        .brand { color: #0369a1; font-size: 20px; font-weight: bold; }
        .muted { color: #64748b; }
        h1 { font-size: 16px; margin: 14px 0 2px; }
        h2 { font-size: 12px; margin: 16px 0 0; color: #0369a1; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f1f5f9; text-align: left; padding: 6px; font-size: 9.5px; text-transform: uppercase; color: #475569; }
        td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
        .right { text-align: right; }
        .sub td { font-weight: bold; background: #f8fafc; }
        .total td { font-weight: bold; background: #f1f5f9; border-top: 2px solid #0369a1; }
    </style>
</head>
<body>
    @include('pdf._company')
    <h1>{{ $titles[$statement] }}</h1>
    <div class="muted">
        @isset($filters['date_from']) {{ $day($filters['date_from']) }} – {{ $day($filters['date_to']) }} @else {{ __('As of :date', ['date' => $day($filters['date_to'])]) }} @endisset
    </div>

    @switch($statement)
        @case('ledger-summary')
            <table>
                <tr><th>{{ __('Date') }}</th><th>{{ __('Journal') }}</th><th>{{ __('Account') }}</th><th>{{ __('Reference') }}</th><th>{{ __('Description') }}</th><th class="right">{{ __('Debit') }}</th><th class="right">{{ __('Credit') }}</th></tr>
                @foreach ($lines as $l)
                    <tr>
                        <td>{{ $day($l['journal_date']) }}</td><td>{{ $l['journal_number'] }}</td><td>{{ $l['account_code'] }} · {{ $l['account_name'] }}</td>
                        <td>{{ $l['reference'] }}</td><td>{{ $l['description'] ?? $l['entry_description'] }}</td>
                        <td class="right">{{ (float) $l['debit_amount'] ? $money($l['debit_amount']) : '-' }}</td><td class="right">{{ (float) $l['credit_amount'] ? $money($l['credit_amount']) : '-' }}</td>
                    </tr>
                @endforeach
                <tr class="total"><td colspan="5">{{ __('Total') }}</td><td class="right">{{ $money($lines->sum('debit_amount')) }}</td><td class="right">{{ $money($lines->sum('credit_amount')) }}</td></tr>
            </table>
            @break

        @case('trial-balance')
            <table>
                <tr><th>{{ __('Account Code') }}</th><th>{{ __('Account Name') }}</th><th class="right">{{ __('Debit') }}</th><th class="right">{{ __('Credit') }}</th></tr>
                @foreach ($report['rows'] as $r)
                    <tr><td>{{ $r['code'] }}</td><td>{{ $r['name'] }}</td><td class="right">{{ (float) $r['debit'] ? $money($r['debit']) : '-' }}</td><td class="right">{{ (float) $r['credit'] ? $money($r['credit']) : '-' }}</td></tr>
                @endforeach
                <tr class="total"><td colspan="2">{{ __('Total') }}</td><td class="right">{{ $money($report['debit']) }}</td><td class="right">{{ $money($report['credit']) }}</td></tr>
            </table>
            @break

        @case('profit-loss')
            @foreach (['revenue' => [__('Revenue'), 'total_revenue', __('Total Revenue')], 'expenses' => [__('Expenses'), 'total_expenses', __('Total Expenses')]] as $key => [$heading, $totalKey, $totalLabel])
                <h2>{{ $heading }}</h2>
                <table>
                    @foreach ($report[$key] as $r)<tr><td>{{ $label($r) }}</td><td class="right">{{ $money($r['amount']) }}</td></tr>@endforeach
                    <tr class="sub"><td>{{ $totalLabel }}</td><td class="right">{{ $money($report[$totalKey]) }}</td></tr>
                </table>
            @endforeach
            <table><tr class="total"><td>{{ (float) $report['net'] >= 0 ? __('Net Profit') : __('Net Loss') }}</td><td class="right">{{ $money($report['net']) }}</td></tr></table>
            @break

        @case('balance-sheet')
            @foreach (['assets' => [__('Assets'), 'total_assets'], 'liabilities' => [__('Liabilities'), 'total_liabilities'], 'equity' => [__('Equity'), 'total_equity']] as $key => [$heading, $totalKey])
                <h2>{{ $heading }}</h2>
                <table>
                    @foreach ($report[$key] as $group)
                        <tr><th colspan="2">{{ __($group['type']) }}</th></tr>
                        @foreach ($group['rows'] as $r)<tr><td>{{ $label($r) }}</td><td class="right">{{ $money($r['amount']) }}</td></tr>@endforeach
                        <tr class="sub"><td>{{ __('Total :type', ['type' => __($group['type'])]) }}</td><td class="right">{{ $money($group['total']) }}</td></tr>
                    @endforeach
                    <tr class="total"><td>{{ __('Total :type', ['type' => $heading]) }}</td><td class="right">{{ $money($report[$totalKey]) }}</td></tr>
                </table>
            @endforeach
            <table><tr class="total"><td>{{ __('Total Liabilities & Equity') }}</td><td class="right">{{ $money((float) $report['total_liabilities'] + (float) $report['total_equity']) }}</td></tr></table>
            @break
    @endswitch
</body>
</html>
