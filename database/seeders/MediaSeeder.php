<?php

namespace Database\Seeders;

use App\Models\Media;
use App\Models\MediaFolder;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaSeeder extends Seeder
{
    /** Folder => [file name => tile colour]. @var array<string, array<string, array{int<0, 255>, int<0, 255>, int<0, 255>}>> */
    private const FILES = [
        'Asset Photos' => ['Proton X70 – WVA 7120' => [3, 105, 161], 'Toyota Forklift – Shah Alam' => [217, 119, 6], 'Server Room Aircond' => [13, 148, 136], 'Dell Latitude Laptops' => [79, 70, 229]],
        'Company Branding' => ['Lim Group Logo' => [2, 132, 199], 'Letterhead Banner' => [15, 23, 42]],
        'Receipts' => ['TNB Bill – August 2026' => [190, 18, 60], 'Petrol Receipt – Shell Glenmarie' => [234, 88, 12]],
        'Contracts' => [],
    ];

    /**
     * Demo folders and small generated images on the public disk. Files already there are left alone.
     */
    public function run(): void
    {
        $admin = User::query()->where('email', 'company@example.com')->value('id');

        foreach (self::FILES as $folderName => $files) {
            $folder = MediaFolder::query()->firstOrNew(['name' => $folderName, 'created_by' => $admin]);
            $folder->forceFill(['created_by' => $admin])->save();

            foreach ($files as $name => $colour) {
                $path = 'media/demo-'.Str::slug($name).'.png';

                if (Media::query()->where('path', $path)->exists()) {
                    continue;
                }

                Storage::disk('public')->put($path, $this->tile($name, $colour));
                $media = new Media;
                $media->forceFill([
                    'folder_id' => $folder->id, 'name' => $name, 'path' => $path, 'mime_type' => 'image/png',
                    'size' => Storage::disk('public')->size($path), 'uploaded_by' => $admin,
                ])->save();
            }
        }
    }

    /**
     * A 480×360 coloured tile with the name on it, as PNG bytes.
     *
     * @param  array{int<0, 255>, int<0, 255>, int<0, 255>}  $rgb
     */
    private function tile(string $text, array $rgb): string
    {
        $image = imagecreatetruecolor(480, 360);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, ...$rgb));
        $white = (int) imagecolorallocate($image, 255, 255, 255);

        foreach (explode("\n", wordwrap(Str::ascii($text), 28)) as $i => $line) {
            imagestring($image, 5, 24, 150 + $i * 22, $line, $white);
        }

        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }
}
