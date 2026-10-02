<?php

namespace Database\Seeders;

use App\Models\MessageTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class MessageTemplateSeeder extends Seeder
{
    /**
     * The system's email and notification templates, in every language (database/demo/message_templates.json).
     * Existing wording is kept, so re-seeding never overwrites a user's edits.
     */
    public function run(): void
    {
        /** @var list<array{channel: string, slug: string, name: string, module: string, from_name: string|null, variables: list<string>, contents: array<string, array{subject: string|null, body: string}>}> $templates */
        $templates = File::json(database_path('demo/message_templates.json'), JSON_THROW_ON_ERROR);

        foreach ($templates as $row) {
            $template = MessageTemplate::query()->firstOrNew(['channel' => $row['channel'], 'slug' => $row['slug']]);
            $template->forceFill(['name' => $row['name'], 'module' => $row['module'], 'variables' => $row['variables'], 'from_name' => $template->from_name ?? $row['from_name']])->save();

            foreach ($row['contents'] as $locale => $content) {
                $template->contents()->firstOrCreate(['locale' => $locale], $content);
            }
        }
    }
}
