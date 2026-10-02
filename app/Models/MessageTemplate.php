<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An email or in-app notification text, written once per language. The set of templates is fixed by the
 * system; users edit only the wording.
 *
 * @property int $id
 * @property string $channel
 * @property string $slug
 * @property string $name
 * @property string $module
 * @property string|null $from_name
 * @property list<string> $variables
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['from_name'])]
class MessageTemplate extends Model
{
    public const CHANNELS = ['email', 'notification'];

    /**
     * @return HasMany<MessageTemplateContent, $this>
     */
    public function contents(): HasMany
    {
        return $this->hasMany(MessageTemplateContent::class);
    }

    /**
     * The subject and body in the locale (English when it has no wording there), with every {placeholder}
     * filled from $values. Unknown placeholders are left as they are.
     *
     * @param  array<string, string|int|float>  $values
     * @return array{subject: string|null, body: string}
     */
    public static function render(string $channel, string $slug, array $values, ?string $locale = null): array
    {
        $template = self::query()->where('channel', $channel)->where('slug', $slug)->firstOrFail();
        $contents = $template->contents()->whereIn('locale', array_unique([$locale ?? app()->getLocale(), 'en']))->get()->keyBy('locale');
        /** @var MessageTemplateContent $content */
        $content = $contents->get($locale ?? app()->getLocale()) ?? $contents->get('en');
        $fill = fn (?string $text) => $text === null ? null : strtr($text, collect($values)->mapWithKeys(fn ($v, $k) => ['{'.$k.'}' => (string) $v])->all());

        return ['subject' => $fill($content->subject), 'body' => (string) $fill($content->body)];
    }

    protected function casts(): array
    {
        return ['variables' => 'array'];
    }
}
