<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A comment (shared with the other party) or a note (internal) on a contract.
 *
 * @property int $id
 * @property int $contract_id
 * @property string $type
 * @property string $body
 * @property bool $is_edited
 * @property int|null $user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'body', 'is_edited', 'user_id'])]
class ContractNote extends Model
{
    public const TYPES = ['comment', 'note'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return ['is_edited' => 'boolean'];
    }
}
