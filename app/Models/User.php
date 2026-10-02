<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $type
 * @property string|null $lang
 * @property string|null $mobile_no
 * @property bool $is_login_enabled
 * @property-read Customer|null $customer
 * @property-read Vendor|null $vendor
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'mobile_no', 'password', 'lang'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * The customer record of a client login (null for everyone else).
     *
     * @return HasOne<Customer, $this>
     */
    public function customer(): HasOne
    {
        return $this->hasOne(Customer::class);
    }

    /**
     * The vendor record of a vendor login (null for everyone else).
     *
     * @return HasOne<Vendor, $this>
     */
    public function vendor(): HasOne
    {
        return $this->hasOne(Vendor::class);
    }

    /**
     * Names of every permission the user holds, directly or via roles.
     *
     * One plucked query; getAllPermissions() hydrates each model, which is slow for the company role.
     *
     * @return Collection<int, string>
     */
    public function permissionNames(): Collection
    {
        return Permission::query()
            ->where(fn ($query) => $query
                ->whereHas('roles', fn ($roles) => $roles->whereIn('id', $this->roles()->select('id')))
                ->orWhereHas('users', fn ($users) => $users->whereKey($this->getKey())))
            ->orderBy('name')
            ->pluck('name');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    /** Matches the column default, so a user created in this request isn't treated as disabled. */
    protected $attributes = ['is_login_enabled' => true];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_login_enabled' => 'boolean',
        ];
    }
}
