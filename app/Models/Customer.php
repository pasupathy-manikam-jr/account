<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A client user's billing profile.
 *
 * @property int $id
 * @property int $user_id
 * @property string|null $customer_code
 * @property string $company_name
 * @property string $contact_person_name
 * @property string $contact_person_email
 * @property string|null $contact_person_mobile
 * @property string|null $tax_number LHDN TIN
 * @property string|null $id_type BRN, NRIC, PASSPORT or ARMY
 * @property string|null $id_number
 * @property string|null $payment_terms
 * @property array<string, string|null> $billing_address
 * @property array<string, string|null>|null $shipping_address
 * @property bool $same_as_billing
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'company_name', 'contact_person_name', 'contact_person_email', 'contact_person_mobile', 'tax_number', 'id_type', 'id_number', 'payment_terms', 'billing_address', 'shipping_address', 'same_as_billing', 'notes'])]
class Customer extends Model
{
    public const ADDRESS_FIELDS = ['name', 'address_line_1', 'address_line_2', 'city', 'state', 'country', 'zip_code'];

    protected static function booted(): void
    {
        static::created(function (Customer $customer) {
            $customer->forceFill(['customer_code' => sprintf('CUST-%04d', $customer->id)])->saveQuietly();
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * manage-any-customers sees every customer; manage-own-customers only the user's own
     * record or the ones they created.
     *
     * @param  Builder<Customer>  $query
     * @return Builder<Customer>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can('manage-any-customers')) {
            return $query;
        }

        if ($user->can('manage-own-customers')) {
            return $query->where(fn (Builder $q) => $q->where('user_id', $user->id)->orWhere('created_by', $user->id));
        }

        return $query->whereRaw('1 = 0');
    }

    protected function casts(): array
    {
        return [
            'billing_address' => 'array',
            'shipping_address' => 'array',
            'same_as_billing' => 'boolean',
        ];
    }
}
