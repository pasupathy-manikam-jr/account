<?php

namespace App\Http\Controllers\Contracts;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\ContractAttachment;
use App\Models\ContractNote;
use App\Models\ContractRenewal;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Attachments, comments, notes and renewals on a contract. Every action needs the contract to be
 * visible to the user; editing or deleting someone else's item also needs the demo's manage-any-* permission.
 */
class ContractActivityController extends Controller
{
    public function storeAttachment(Request $request, Contract $contract): RedirectResponse
    {
        $this->visible($request, $contract);

        $file = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,png,jpg,jpeg,gif,webp,zip'],
        ])['file'];

        $contract->attachments()->create([
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $file->store('contracts', 'public') ?: throw new RuntimeException('The attachment could not be stored.'),
            'file_size' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        return $this->done(__('Attachment uploaded successfully.'));
    }

    public function downloadAttachment(Request $request, Contract $contract, ContractAttachment $attachment): StreamedResponse
    {
        $this->visible($request, $contract, $attachment->contract_id);

        return Storage::disk('public')->download($attachment->file_path, $attachment->file_name);
    }

    public function destroyAttachment(Request $request, Contract $contract, ContractAttachment $attachment): RedirectResponse
    {
        $this->visible($request, $contract, $attachment->contract_id);
        $this->owns($request, 'contract-attachments', $attachment->uploaded_by);

        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

        return $this->done(__('Attachment deleted successfully.'));
    }

    public function storeNote(Request $request, Contract $contract, string $type): RedirectResponse
    {
        $this->visible($request, $contract);
        $this->allowed($request, 'create', $type);

        $contract->hasMany(ContractNote::class)->create([
            'type' => $type,
            'body' => $request->validate(['body' => ['required', 'string', 'max:5000']])['body'],
            'user_id' => $request->user()->id,
        ]);

        return $this->done($type === 'comment' ? __('Comment added successfully.') : __('Note added successfully.'));
    }

    public function updateNote(Request $request, Contract $contract, ContractNote $note): RedirectResponse
    {
        $this->visible($request, $contract, $note->contract_id);
        $this->allowed($request, 'edit', $note->type);
        $this->owns($request, "contract-{$note->type}s", $note->user_id);

        $note->update([
            'body' => $request->validate(['body' => ['required', 'string', 'max:5000']])['body'],
            'is_edited' => true,
        ]);

        return $this->done($note->type === 'comment' ? __('Comment updated successfully.') : __('Note updated successfully.'));
    }

    public function destroyNote(Request $request, Contract $contract, ContractNote $note): RedirectResponse
    {
        $this->visible($request, $contract, $note->contract_id);
        $this->allowed($request, 'delete', $note->type);
        $this->owns($request, "contract-{$note->type}s", $note->user_id);

        $note->delete();

        return $this->done($note->type === 'comment' ? __('Comment deleted successfully.') : __('Note deleted successfully.'));
    }

    public function storeRenewal(Request $request, Contract $contract): RedirectResponse
    {
        $this->visible($request, $contract);

        $contract->renewals()->create([...$this->renewal($request), 'created_by' => $request->user()->id]);

        return $this->done(__('Renewal added successfully.'));
    }

    public function updateRenewal(Request $request, Contract $contract, ContractRenewal $renewal): RedirectResponse
    {
        $this->visible($request, $contract, $renewal->contract_id);
        $this->owns($request, 'contract-renewals', $renewal->created_by);

        $renewal->update($this->renewal($request));

        return $this->done(__('Renewal updated successfully.'));
    }

    public function destroyRenewal(Request $request, Contract $contract, ContractRenewal $renewal): RedirectResponse
    {
        $this->visible($request, $contract, $renewal->contract_id);
        $this->owns($request, 'contract-renewals', $renewal->created_by);

        $renewal->delete();

        return $this->done(__('Renewal deleted successfully.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function renewal(Request $request): array
    {
        return $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'value' => ['required', 'numeric', 'min:0', 'max:9999999999999.99', 'decimal:0,2'],
            'status' => ['required', Rule::in(ContractRenewal::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    /** The contract must be visible, and the child item must belong to it. */
    private function visible(Request $request, Contract $contract, ?int $childContractId = null): void
    {
        abort_unless($contract->isVisibleTo($request->user()), 404);
        abort_if($childContractId !== null && $childContractId !== $contract->id, 404);
    }

    /** create/edit/delete-contract-comments or -notes, depending on the type. */
    private function allowed(Request $request, string $action, string $type): void
    {
        abort_unless(in_array($type, ContractNote::TYPES, true), 404);
        abort_unless($request->user()->can("{$action}-contract-{$type}s"), 403);
    }

    /** Someone else's item needs manage-any-*; your own is fine. */
    private function owns(Request $request, string $module, ?int $ownerId): void
    {
        abort_unless($request->user()->can("manage-any-{$module}") || $ownerId === $request->user()->id, 403);
    }
}
