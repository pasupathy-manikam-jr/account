<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $payment_id
 * @property int $retainer_id
 * @property string $allocated_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Retainer $retainer
 * @property-read RetainerPayment $payment
 */
#[Fillable(['retainer_id', 'allocated_amount'])]
class RetainerPaymentAllocation extends Model
{
    /**
     * @return BelongsTo<Retainer, $this>
     */
    public function retainer(): BelongsTo
    {
        return $this->belongsTo(Retainer::class);
    }

    /**
     * @return BelongsTo<RetainerPayment, $this>
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(RetainerPayment::class, 'payment_id');
    }

    protected function casts(): array
    {
        return ['allocated_amount' => 'decimal:2'];
    }
}
