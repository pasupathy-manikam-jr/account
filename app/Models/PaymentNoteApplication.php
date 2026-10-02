<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $payment_id
 * @property string $note_type
 * @property int $note_id
 * @property string $applied_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['note_type', 'note_id', 'applied_amount'])]
class PaymentNoteApplication extends Model
{
    /**
     * @return MorphTo<Model, $this>
     */
    public function note(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return ['applied_amount' => 'decimal:2'];
    }
}
