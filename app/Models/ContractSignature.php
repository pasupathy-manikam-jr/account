<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $contract_id
 * @property int $user_id
 * @property string $signer_name
 * @property string $signature_data
 * @property Carbon $signed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'signer_name', 'signature_data', 'signed_at'])]
class ContractSignature extends Model
{
    /**
     * A typed signature drawn as an SVG data URL in a script font, like the demo's.
     */
    public static function render(string $name): string
    {
        $text = htmlspecialchars($name, ENT_XML1 | ENT_QUOTES);
        $svg = '<svg width="240" height="60" xmlns="http://www.w3.org/2000/svg"><text x="10" y="40" font-family="cursive, serif" '
            .'font-size="24" fill="#1a365d" transform="rotate(-2)">'.$text.'</text></svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }

    protected function casts(): array
    {
        return ['signed_at' => 'datetime'];
    }
}
