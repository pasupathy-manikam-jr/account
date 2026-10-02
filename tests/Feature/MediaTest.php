<?php

namespace Tests\Feature;

use App\Models\Media;
use App\Models\MediaFolder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_organise_download_and_delete_files(): void
    {
        Storage::fake('public');
        $this->actingAs($admin = $this->userWithRole());
        $folder = new MediaFolder(['name' => 'Receipts']);
        $folder->forceFill(['created_by' => $admin->id])->save();

        $this->post(route('media.store'), ['files' => [UploadedFile::fake()->image('resit-tnb.png'), UploadedFile::fake()->create('invois.pdf', 120, 'application/pdf')], 'folder_id' => $folder->id])
            ->assertSessionHasNoErrors();
        $this->assertSame(2, $folder->media()->count());
        $png = Media::query()->where('name', 'resit-tnb')->sole();
        Storage::disk('public')->assertExists($png->path);

        // Scriptable or oversized files are refused.
        $this->post(route('media.store'), ['files' => [UploadedFile::fake()->create('logo.svg', 5, 'image/svg+xml')]])->assertSessionHasErrors('files.0');
        $this->post(route('media.store'), ['files' => [UploadedFile::fake()->create('big.pdf', 6000, 'application/pdf')]])->assertSessionHasErrors('files.0');

        $this->get(route('media-library', ['folder' => $folder->id]))->assertOk()
            ->assertInertia(fn ($page) => $page->has('files.data', 2)->where('stats.count', 2)->where('folders.0.media_count', 2));

        $this->put(route('media.update', $png), ['name' => 'Bil TNB Ogos', 'folder_id' => null])->assertSessionHasNoErrors();
        $this->assertNull($png->refresh()->folder_id);
        $this->get(route('media.download', $png))->assertOk()->assertDownload('Bil TNB Ogos.png');

        // Deleting a folder keeps its files; deleting a file removes it from disk.
        $this->delete(route('media.folders.destroy', $folder));
        $this->assertSame(0, Media::query()->whereNotNull('folder_id')->count());
        $this->delete(route('media.destroy', $png));
        Storage::disk('public')->assertMissing($png->path);

        // Other roles only ever see, use or touch their own files and folders.
        $pdf = Media::query()->where('name', 'invois')->sole();
        $this->actingAs($vendor = $this->userWithRole('vendor'));
        $this->get(route('media-library'))->assertOk()->assertInertia(fn ($page) => $page->has('files.data', 0)->where('stats.count', 0));
        $this->get(route('media.download', $pdf))->assertNotFound();
        $this->delete(route('media.destroy', $pdf))->assertNotFound();
        $this->post(route('media.folders.store'), ['name' => 'Receipts'])->assertSessionHasNoErrors(); // same name, own folder
        $theirs = MediaFolder::query()->where('created_by', $vendor->id)->sole();
        $this->post(route('media.store'), ['files' => [UploadedFile::fake()->image('do.png')], 'folder_id' => MediaFolder::query()->whereKeyNot($theirs->id)->value('id') ?? 999])
            ->assertSessionHasErrors('folder_id');
        $this->post(route('media.store'), ['files' => [UploadedFile::fake()->image('do.png')], 'folder_id' => $theirs->id])->assertSessionHasNoErrors();
        $this->get(route('media-library'))->assertInertia(fn ($page) => $page->has('files.data', 1)->has('folders', 1));
        $this->assertModelExists($pdf);
    }
}
