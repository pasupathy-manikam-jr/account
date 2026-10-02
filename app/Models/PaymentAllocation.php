<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $payment_id
 * @property string $invoice_type
 * @property int $invoice_id
 * @property string $allocated_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['invoice_type', 'invoice_id', 'allocated_amount'])]
class PaymentAllocation extends Model
{
    /**
     * @return MorphTo<Model, $this>
     */
    public function invoice(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return ['allocated_amount' => 'decimal:2'];
    }
}
