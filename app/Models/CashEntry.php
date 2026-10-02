<?php

namespace App\Models;

use App\Support\Ledger;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Revenue received or an expense paid straight through a bank account: draft → approved → posted.
 * Revenue posts Dr bank / Cr revenue account; an expense posts Dr expense account / Cr bank.
 *
 * @property int $id
 * @property string $kind
 * @property string|null $entry_number
 * @property Carbon $entry_date
 * @property int $category_id
 * @property int $bank_account_id
 * @property int $chart_of_account_id
 * @property string $amount
 * @property string|null $description
 * @property string|null $reference_number
 * @property string $status
 * @property int|null $approved_by
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TransactionCategory $category
 * @property-read BankAccount $bankAccount
 * @property-read ChartOfAccount $chartOfAccount
 */
#[Fillable(['entry_date', 'category_id', 'bank_account_id', 'chart_of_account_id', 'amount', 'description', 'reference_number'])]
class CashEntry extends Model
{
    public const STATUSES = ['draft', 'approved', 'posted'];

    public const PREFIX = ['revenue' => 'REV', 'expense' => 'EXP'];

    protected $attributes = ['status' => 'draft'];

    /**
     * @return BelongsTo<TransactionCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class);
    }

    /**
     * @return BelongsTo<BankAccount, $this>
     */
    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * @return BelongsTo<ChartOfAccount, $this>
     */
    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function assignNumber(): void
    {
        $this->forceFill(['entry_number' => sprintf('%s-%s-%03d', self::PREFIX[$this->kind], $this->entry_date->format('Y-m'), $this->id)])->save();
    }

    public function approve(User $approver): void
    {
        $this->expect('draft');
        $this->forceFill(['status' => 'approved', 'approved_by' => $approver->id])->save();
    }

    /**
     * Approved → posted: the money moves in the ledger.
     */
    public function post(): void
    {
        $this->expect('approved');

        DB::transaction(function () {
            $this->load('bankAccount', 'category');
            $bank = $this->bankAccount->gl_account_id;
            $revenue = $this->kind === 'revenue';
            $description = $this->description ?: $this->category->category_name;

            $title = $revenue
                ? __('Revenue Entry #:number', ['number' => $this->entry_number])
                : __('Expense Entry #:number', ['number' => $this->entry_number]);

            Ledger::post($this->entry_date->format('Y-m-d'), $title, [
                ['account_id' => $revenue ? $bank : $this->chart_of_account_id, 'debit' => $this->amount, 'description' => $revenue ? __('Revenue received') : $description],
                ['account_id' => $revenue ? $this->chart_of_account_id : $bank, 'credit' => $this->amount, 'description' => $revenue ? $description : __('Payment made')],
            ], $this);

            $this->forceFill(['status' => 'posted'])->save();
        });
    }

    private function expect(string $status): void
    {
        if ($this->status !== $status) {
            throw ValidationException::withMessages(['status' => __('This entry is :status and cannot be changed that way.', ['status' => __($this->status)])]);
        }
    }

    protected function casts(): array
    {
        return [
            'entry_date' => 'date:Y-m-d',
            'amount' => 'decimal:2',
        ];
    }
}
