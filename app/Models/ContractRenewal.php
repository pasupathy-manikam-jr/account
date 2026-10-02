<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $contract_id
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property string $value
 * @property string|null $notes
 * @property string $status
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['start_date', 'end_date', 'value', 'notes', 'status', 'created_by'])]
class ContractRenewal extends Model
{
    public const STATUSES = ['draft', 'pending', 'approved', 'active', 'expired', 'cancelled'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'value' => 'decimal:2',
        ];
    }
}
