<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $budget_id
 * @property int $account_id
 * @property string $allocated_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Budget $budget
 * @property-read ChartOfAccount $account
 */
#[Fillable(['budget_id', 'account_id', 'allocated_amount'])]
class BudgetAllocation extends Model
{
    /**
     * @return BelongsTo<Budget, $this>
     */
    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    protected function casts(): array
    {
        return ['allocated_amount' => 'decimal:2'];
    }
}
