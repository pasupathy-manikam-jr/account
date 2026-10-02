<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A balanced set of debit and credit lines. Create them only through App\Support\Ledger::post().
 *
 * @property int $id
 * @property string|null $journal_number
 * @property Carbon $journal_date
 * @property string $description
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['journal_date', 'description'])]
class JournalEntry extends Model
{
    /**
     * @return HasMany<JournalEntryItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(JournalEntryItem::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    protected function casts(): array
    {
        return [
            'journal_date' => 'date:Y-m-d',
        ];
    }
}
