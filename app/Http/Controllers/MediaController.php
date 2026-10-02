<?php

namespace App\Http\Controllers;

use App\Models\Media;
use App\Models\MediaFolder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Media Library: files on the public disk, sorted into flat folders.
 */
class MediaController extends Controller
{
    /** Images, PDFs and office files. No SVG or HTML: they can carry scripts. */
    public const MIMES = 'jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,txt';

    public function index(Request $request): Response
    {
        $folder = $request->input('folder');
        $sort = in_array($request->input('sort'), ['name', 'size'], true) ? $request->input('sort') : 'created_at';

        $user = $request->user();
        $query = Media::query()->visibleTo($user)
            ->when($folder === 'none', fn (Builder $q) => $q->whereNull('folder_id'))
            ->when(is_numeric($folder), fn (Builder $q) => $q->where('folder_id', (int) $folder))
            ->when($search = trim($request->string('search')->toString()), fn (Builder $q) => $q->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'));

        return Inertia::render('media/index', [
            'files' => $query->orderBy($sort, $sort === 'name' ? 'asc' : 'desc')->orderByDesc('id')->paginate(24)->withQueryString(),
            'folders' => MediaFolder::query()->visibleTo($user)->withCount(['media' => fn ($q) => $q->visibleTo($user)])->orderBy('name')->get(),
            'stats' => [
                'count' => Media::query()->visibleTo($user)->count(),
                'unfiled' => Media::query()->visibleTo($user)->whereNull('folder_id')->count(),
                'bytes' => (int) Media::query()->visibleTo($user)->sum('size'),
            ],
            'filters' => ['folder' => $folder, 'search' => $request->input('search'), 'sort' => $sort],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => ['file', 'mimes:'.self::MIMES, 'max:5120'],
            'folder_id' => ['nullable', $this->ownFolder($request)],
        ], [], ['files.*' => __('file')]);

        foreach ($data['files'] as $file) {
            $media = new Media;
            $media->forceFill([
                'folder_id' => $data['folder_id'] ?? null,
                'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'path' => $file->store('media', 'public'),
                'mime_type' => (string) $file->getMimeType(),
                'size' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ])->save();
        }

        return $this->done(trans_choice('{1} :count file uploaded.|[2,*] :count files uploaded.', count($data['files']), ['count' => count($data['files'])]));
    }

    /** Rename and/or move to a folder (null = no folder). */
    public function update(Request $request, Media $media): RedirectResponse
    {
        $this->authorizeFile($request, $media);
        $media->forceFill($request->validate([
            'name' => ['required', 'string', 'max:255'],
            'folder_id' => ['nullable', $this->ownFolder($request)],
        ]))->save();

        return $this->done(__('File updated successfully.'));
    }

    public function download(Request $request, Media $media): StreamedResponse
    {
        $this->authorizeFile($request, $media);

        return Storage::disk('public')->download($media->path, $media->name.'.'.pathinfo($media->path, PATHINFO_EXTENSION));
    }

    public function destroy(Request $request, Media $media): RedirectResponse
    {
        $this->authorizeFile($request, $media);

        $media->delete();

        return $this->done(__('File deleted successfully.'));
    }

    public function storeFolder(Request $request): RedirectResponse
    {
        $folder = new MediaFolder($request->validate(['name' => ['required', 'string', 'max:100', Rule::unique('media_folders')->where('created_by', $request->user()->id)]]));
        $folder->forceFill(['created_by' => $request->user()->id])->save();

        return $this->done(__('Folder created successfully.'));
    }

    public function updateFolder(Request $request, MediaFolder $folder): RedirectResponse
    {
        $this->authorizeFolder($request, $folder);
        $folder->update($request->validate(['name' => ['required', 'string', 'max:100', Rule::unique('media_folders')->where('created_by', $folder->created_by)->ignore($folder)]]));

        return $this->done(__('Folder renamed successfully.'));
    }

    /** The folder goes; its files stay, unfiled. */
    public function destroyFolder(Request $request, MediaFolder $folder): RedirectResponse
    {
        $this->authorizeFolder($request, $folder);

        DB::transaction(function () use ($folder) {
            $folder->media()->update(['folder_id' => null]);
            $folder->delete();
        });

        return $this->done(__('Folder deleted. Its files are now unfiled.'));
    }

    /** A folder id the user may put files in. */
    private function ownFolder(Request $request): Exists
    {
        $user = $request->user();

        return Rule::exists('media_folders', 'id')->when(! $user->can('manage-any-media-directories'), fn (Exists $rule) => $rule->where('created_by', $user->id));
    }

    private function authorizeFile(Request $request, Media $media): void
    {
        abort_unless(Media::query()->visibleTo($request->user())->whereKey($media->id)->exists(), 404);
    }

    private function authorizeFolder(Request $request, MediaFolder $folder): void
    {
        abort_unless(MediaFolder::query()->visibleTo($request->user())->whereKey($folder->id)->exists(), 404);
    }
}
