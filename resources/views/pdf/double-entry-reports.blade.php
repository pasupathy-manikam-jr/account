{{--
    Double Entry reports PDF (landscape). Pass what DoubleEntry\ReportController::build() returns
    ($report, $filters, $data).
--}}
@php
    $money = fn ($v) => \App\Support\Settings::money($v);
    $cell = fn ($v) => (float) $v == 0 ? '-' : $money($v);
    $day = fn ($d) => \App\Support\Settings::date($d);
    $titles = ['general-ledger' => __('General Ledger'), 'account-statement' => __('Account Statement'), 'journal-entries' => __('Journal Entries'), 'cash-flow' => __('Cash Flow'), 'expense-report' => __('Expense Report')];
    $sections = ['operating' => __('Operating Activities'), 'investing' => __('Investing Activities'), 'financing' => __('Financing Activities')];
    $ledgers = $report === 'general-ledger' ? $data : ($report === 'account-statement' && $data ? [$data] : []);
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $titles[$report] }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 9.5px; color: #1e293b; margin: 0; }
        .brand { color: #0369a1; font-size: 18px; font-weight: bold; }
        .muted { color: #64748b; }
        h1 { font-size: 15px; margin: 12px 0 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f1f5f9; text-align: left; padding: 5px; font-size: 8.5px; text-transform: uppercase; color: #475569; }
        td { padding: 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .right { text-align: right; }
        .group td { font-weight: bold; background: #e0f2fe; color: #0369a1; }
        .sub td { font-weight: bold; background: #f8fafc; }
        .total td { font-weight: bold; background: #f1f5f9; border-top: 2px solid #0369a1; }
    </style>
</head>
<body>
    @include('pdf._company')
    <h1>{{ $titles[$report] }}</h1>
    <div class="muted">{{ $day($filters['date_from']) }} – {{ $day($filters['date_to']) }}</div>

    @if ($ledgers)
        <table>
            <tr><th>{{ __('Date') }}</th><th>{{ __('Journal') }}</th><th>{{ __('Reference') }}</th><th>{{ __('Description') }}</th><th class="right">{{ __('Debit') }}</th><th class="right">{{ __('Credit') }}</th><th class="right">{{ __('Balance') }}</th></tr>
            @foreach ($ledgers as $account)
                <tr class="group"><td colspan="7">{{ $account['code'] }} · {{ $account['name'] }}</td></tr>
                <tr class="sub"><td colspan="6">{{ __('Opening Balance') }}</td><td class="right">{{ $money($account['opening']) }}</td></tr>
                @foreach ($account['lines'] as $l)
                    <tr><td>{{ $day($l['date']) }}</td><td>{{ $l['number'] }}</td><td>{{ $l['reference'] }}</td><td>{{ $l['description'] }}</td><td class="right">{{ $cell($l['debit']) }}</td><td class="right">{{ $cell($l['credit']) }}</td><td class="right">{{ $money($l['balance']) }}</td></tr>
                @endforeach
                <tr class="sub"><td colspan="4">{{ __('Closing Balance') }}</td><td class="right">{{ $money($account['debit']) }}</td><td class="right">{{ $money($account['credit']) }}</td><td class="right">{{ $money($account['closing']) }}</td></tr>
            @endforeach
        </table>
    @elseif ($report === 'journal-entries')
        <table>
            <tr><th>{{ __('Date') }}</th><th>{{ __('Journal') }}</th><th>{{ __('Description') }}</th><th>{{ __('Account') }}</th><th class="right">{{ __('Debit') }}</th><th class="right">{{ __('Credit') }}</th></tr>
            @foreach ($data as $e)
                @foreach ($e['lines'] as $i => $l)
                    <tr>
                        <td>{{ $i === 0 ? $day($e['date']) : '' }}</td><td>{{ $i === 0 ? $e['number'] : '' }}</td><td>{{ $i === 0 ? $e['description'] : '' }}</td>
                        <td>{{ $l['code'] }} · {{ $l['name'] }}</td><td class="right">{{ $cell($l['debit']) }}</td><td class="right">{{ $cell($l['credit']) }}</td>
                    </tr>
                @endforeach
            @endforeach
        </table>
    @elseif ($report === 'cash-flow')
        <table>
            <tr><th>{{ __('Account') }}</th><th class="right">{{ __('Inflow') }}</th><th class="right">{{ __('Outflow') }}</th></tr>
            <tr class="sub"><td colspan="2">{{ __('Opening Cash') }}</td><td class="right">{{ $money($data['opening']) }}</td></tr>
            @foreach ($data['sections'] as $section)
                <tr class="group"><td colspan="3">{{ $sections[$section['key']] }}</td></tr>
                @foreach ($section['rows'] as $r)
                    <tr><td>{{ $r['code'] }} · {{ $r['name'] }}</td><td class="right">{{ (float) $r['amount'] > 0 ? $money($r['amount']) : '' }}</td><td class="right">{{ (float) $r['amount'] < 0 ? $money(-(float) $r['amount']) : '' }}</td></tr>
                @endforeach
                <tr class="sub"><td colspan="2">{{ __('Net Cash from :section', ['section' => $sections[$section['key']]]) }}</td><td class="right">{{ $money($section['net']) }}</td></tr>
            @endforeach
            <tr class="total"><td colspan="2">{{ __('Net Change in Cash') }}</td><td class="right">{{ $money($data['net']) }}</td></tr>
            <tr class="total"><td colspan="2">{{ __('Closing Cash') }}</td><td class="right">{{ $money($data['closing']) }}</td></tr>
        </table>
    @elseif ($report === 'expense-report')
        <table>
            <tr>
                <th>{{ __('Account') }}</th>
                @foreach ($data['months'] as $m)<th class="right">{{ \Illuminate\Support\Carbon::parse($m.'-01')->format('M y') }}</th>@endforeach
                <th class="right">{{ __('Total') }}</th><th class="right">%</th>
            </tr>
            @foreach ($data['rows'] as $r)
                <tr>
                    <td>{{ $r['code'] }} · {{ $r['name'] }}</td>
                    @foreach ($r['months'] as $v)<td class="right">{{ $cell($v) }}</td>@endforeach
                    <td class="right">{{ $money($r['total']) }}</td><td class="right">{{ number_format($r['share'], 1) }}%</td>
                </tr>
            @endforeach
            <tr class="total">
                <td>{{ __('Total') }}</td>
                @foreach ($data['month_totals'] as $v)<td class="right">{{ $cell($v) }}</td>@endforeach
                <td class="right">{{ $money($data['total']) }}</td><td class="right">100%</td>
            </tr>
        </table>
    @else
        <p class="muted">{{ __('No transactions in this period.') }}</p>
    @endif
</body>
</html>
