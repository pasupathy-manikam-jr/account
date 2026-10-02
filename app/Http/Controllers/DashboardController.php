<?php

namespace App\Http\Controllers;

use App\Models\CashEntry;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Like the demo, the company lands on its Account Dashboard; staff, clients and vendors
     * get a welcome page until their own dashboards are built.
     */
    public function __invoke(Request $request): Response|RedirectResponse
    {
        if ($request->user()?->type === 'company' && $request->user()->can('manage-account-dashboard')) {
            return to_route('account.dashboard');
        }

        return Inertia::render('dashboard');
    }

    /**
     * The demo's Account Dashboard: client and vendor counts, payment totals, six months of
     * payments, and the latest posted revenue and expenses.
     */
    public function account(): Response
    {
        $months = collect(range(5, 0))->map(fn (int $ago) => Carbon::now()->startOfMonth()->subMonths($ago));

        return Inertia::render('account/dashboard', [
            'stats' => [
                'total_clients' => User::query()->where('type', 'client')->count(),
                'total_vendors' => User::query()->where('type', 'vendor')->count(),
                'total_customer_payment' => self::paid('customer'),
                'total_vendor_payment' => self::paid('vendor'),
            ],
            'monthlyCustomerPayments' => self::monthly('customer', $months),
            'monthlyVendorPayments' => self::monthly('vendor', $months),
            'recentRevenues' => self::latest('revenue'),
            'recentExpenses' => self::latest('expense'),
        ]);
    }

    /**
     * The five most recent posted revenue or expense entries.
     *
     * @return list<array{id: int, title: string|null, description: string|null, amount: string, date: string}>
     */
    private static function latest(string $kind): array
    {
        return array_values(CashEntry::query()->where('kind', $kind)->where('status', 'posted')
            ->latest('entry_date')->latest('id')->limit(5)->get()
            ->map(fn (CashEntry $e) => [
                'id' => $e->id,
                'title' => $e->entry_number,
                'description' => $e->description,
                'amount' => $e->amount,
                'date' => $e->entry_date->format('Y-m-d'),
            ])->all());
    }

    /** Everything received from customers (or paid to vendors) through cleared payments. */
    private static function paid(string $kind): string
    {
        return Money::format(Money::toCents((string) Payment::query()->where('kind', $kind)->where('status', 'cleared')->sum('payment_amount')));
    }

    /**
     * Cleared payments per month for the given months (oldest first).
     *
     * @param  Collection<int, Carbon>  $months
     * @return list<array{month: string, amount: float}>
     */
    private static function monthly(string $kind, Collection $months): array
    {
        $payments = Payment::query()->where('kind', $kind)->where('status', 'cleared')
            ->where('payment_date', '>=', $months->first()?->format('Y-m-d'))
            ->get(['payment_date', 'payment_amount']);

        return array_values($months->map(fn (Carbon $month) => [
            'month' => $month->format('M'),
            'amount' => Money::toCents((string) $payments->filter(fn (Payment $p) => $p->payment_date->isSameMonth($month))->sum('payment_amount')) / 100,
        ])->all());
    }
}
