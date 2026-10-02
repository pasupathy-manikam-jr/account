<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $contract_number
 * @property string $subject
 * @property string $value
 * @property Carbon $start_date
 * @property Carbon $end_date
 * @property string|null $description
 * @property string $status
 * @property int $type_id
 * @property int $user_id
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read ContractType $contractType
 */
#[Fillable(['subject', 'value', 'start_date', 'end_date', 'description', 'status', 'type_id', 'user_id'])]
class Contract extends Model
{
    public const STATUSES = ['pending', 'accepted', 'declined', 'closed'];

    protected $attributes = ['status' => 'pending'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<ContractType, $this>
     */
    public function contractType(): BelongsTo
    {
        return $this->belongsTo(ContractType::class, 'type_id');
    }

    /**
     * @return HasMany<ContractAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(ContractAttachment::class);
    }

    /**
     * @return HasMany<ContractNote, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(ContractNote::class)->where('type', 'comment');
    }

    /**
     * @return HasMany<ContractNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(ContractNote::class)->where('type', 'note');
    }

    /**
     * @return HasMany<ContractRenewal, $this>
     */
    public function renewals(): HasMany
    {
        return $this->hasMany(ContractRenewal::class);
    }

    /**
     * @return HasMany<ContractSignature, $this>
     */
    public function signatures(): HasMany
    {
        return $this->hasMany(ContractSignature::class);
    }

    /**
     * Everything with manage-any-contracts; otherwise contracts with or created by the user.
     *
     * @param  Builder<Contract>  $query
     * @return Builder<Contract>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-contracts')
            ? $query
            : $query->where(fn (Builder $q) => $q->where('user_id', $user->id)->orWhere('created_by', $user->id));
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->can('manage-any-contracts') || $this->user_id === $user->id || $this->created_by === $user->id;
    }

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }
}
