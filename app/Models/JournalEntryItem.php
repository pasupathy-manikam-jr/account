<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $journal_entry_id
 * @property int $account_id
 * @property string|null $description
 * @property string $debit_amount
 * @property string $credit_amount
 * @property Carbon|null $reconciled_at
 * @property int|null $reconciled_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read JournalEntry $journalEntry
 * @property-read ChartOfAccount $account
 */
#[Fillable(['account_id', 'description', 'debit_amount', 'credit_amount'])]
class JournalEntryItem extends Model
{
    /**
     * @return BelongsTo<JournalEntry, $this>
     */
    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
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
        return [
            'debit_amount' => 'decimal:2',
            'credit_amount' => 'decimal:2',
            'reconciled_at' => 'datetime',
        ];
    }
}
