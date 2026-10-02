<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * An uploaded file on the public disk. Deleting the record deletes the file.
 *
 * @property int $id
 * @property int|null $folder_id
 * @property string $name
 * @property string $path
 * @property string $mime_type
 * @property int $size
 * @property int|null $uploaded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string $url
 */
class Media extends Model
{
    protected $appends = ['url'];

    protected static function booted(): void
    {
        static::deleted(fn (Media $media) => Storage::disk('public')->delete($media->path));
    }

    /**
     * @return BelongsTo<MediaFolder, $this>
     */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * The company sees every file; everyone else only what they uploaded.
     *
     * @param  Builder<Media>  $query
     * @return Builder<Media>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can('manage-any-media') ? $query : $query->where('uploaded_by', $user->id);
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }
}
