<?php

namespace App\Support;

use App\Models\ChartOfAccount;
use Illuminate\Validation\ValidationException;

/**
 * The system accounts documents post to, by code (seeded in the chart of accounts).
 */
class LedgerAccounts
{
    public const ACCOUNTS_RECEIVABLE = '1100';

    public const INVENTORY = '1200';

    public const TAX_RECEIVABLE = '1500';

    public const ACCOUNTS_PAYABLE = '2000';

    public const SST_PAYABLE = '2210';

    public const CUSTOMER_DEPOSITS = '2350';

    public const RETAINED_EARNINGS = '3200';

    public const SALES_REVENUE = '4100';

    public const SERVICE_REVENUE = '4200';

    public const COST_OF_GOODS_SOLD = '5100';

    public const BANK_CHARGES = '5510';

    /**
     * The id of the account with this code; a missing system account is a validation error, not a crash.
     */
    public static function id(string $code): int
    {
        $id = ChartOfAccount::query()->where('account_code', $code)->value('id');

        if ($id === null) {
            throw ValidationException::withMessages(['lines' => __('The system account :code is missing from the chart of accounts.', ['code' => $code])]);
        }

        return (int) $id;
    }
}
