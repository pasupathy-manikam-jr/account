<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

/**
 * The draft → approved → active → closed workflow shared by budget periods and budgets.
 */
trait HasBudgetWorkflow
{
    public const STATUSES = ['draft', 'approved', 'active', 'closed'];

    /** action => [from, to] */
    public const TRANSITIONS = ['approve' => ['draft', 'approved'], 'activate' => ['approved', 'active'], 'close' => ['active', 'closed']];

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function transition(string $action, User $by): void
    {
        [$from, $to] = self::TRANSITIONS[$action];

        if ($this->status !== $from) {
            throw ValidationException::withMessages(['status' => __('Only :from records can be moved to :to.', ['from' => __($from), 'to' => __($to)])]);
        }

        $this->forceFill(['status' => $to] + ($action === 'approve' ? ['approved_by' => $by->id] : []))->save();
    }
}
