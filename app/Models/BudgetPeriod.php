<?php

namespace App\Models;

use App\Models\Concerns\HasBudgetWorkflow;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A stretch of time budgets are planned for (a quarter, a financial year).
 *
 * @property int $id
 * @property string $period_name
 * @property int $financial_year
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property string $status
 * @property int|null $approved_by
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['period_name', 'financial_year', 'start_date', 'end_date'])]
class BudgetPeriod extends Model
{
    use HasBudgetWorkflow;

    protected $attributes = ['status' => 'draft'];

    /**
     * @return HasMany<Budget, $this>
     */
    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    protected function casts(): array
    {
        return ['start_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d', 'financial_year' => 'integer'];
    }
}
