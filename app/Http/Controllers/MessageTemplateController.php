<?php

namespace App\Http\Controllers;

use App\Models\MessageTemplate;
use App\Support\TableQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Email Templates and Notification Templates; the route's `channel` default says which.
 */
class MessageTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        $channel = $this->channel($request);
        $query = MessageTemplate::query()->where('channel', $channel)->withCount('contents')
            ->when(in_array($request->input('module'), ['general', 'accounting'], true), fn (Builder $q) => $q->where('module', $request->input('module')));
        TableQuery::search($query, $request, ['name', 'slug']);

        return Inertia::render('message-templates/index', [
            'channel' => $channel,
            'templates' => TableQuery::paginate($query, $request, [], ['name', 'module'], 'name', 'asc'),
            'filters' => TableQuery::filters($request, ['module']),
        ]);
    }

    public function edit(Request $request, MessageTemplate $template): Response
    {
        $channel = $this->channel($request);
        abort_unless($template->channel === $channel, 404);

        return Inertia::render('message-templates/edit', [
            'channel' => $channel,
            'template' => $template,
            'contents' => $template->contents()->get(['locale', 'subject', 'body'])->keyBy('locale'),
        ]);
    }

    /** Save the from-name and the wording for one language. */
    public function update(Request $request, MessageTemplate $template): RedirectResponse
    {
        $channel = $this->channel($request);
        abort_unless($template->channel === $channel, 404);
        $email = $channel === 'email';

        $data = $request->validate([
            'locale' => ['required', Rule::in(array_keys(config('app.locales')))],
            'from_name' => ['nullable', 'string', 'max:100'],
            'subject' => [$email ? 'required' : 'prohibited', 'nullable', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
        ]);

        if ($email) {
            $template->update(['from_name' => $data['from_name'] ?? null]);
        }

        $template->contents()->updateOrCreate(['locale' => $data['locale']], ['subject' => $data['subject'] ?? null, 'body' => $data['body']]);

        return $this->done(__('Template saved for :language.', ['language' => config('app.locales')[$data['locale']][0]]));
    }

    /** email or notification, fixed by the route. */
    private function channel(Request $request): string
    {
        return (string) $request->route('channel');
    }
}
