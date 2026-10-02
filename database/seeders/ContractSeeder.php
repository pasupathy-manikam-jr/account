<?php

namespace Database\Seeders;

use App\Models\Contract;
use App\Models\ContractNote;
use App\Models\ContractSignature;
use App\Models\ContractType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ContractSeeder extends Seeder
{
    /**
     * The demo's contracts (database/demo/contracts.json) with their comments, notes, renewals and
     * signatures, for our Malaysian users. Runs after UserSeeder and ContractTypeSeeder; skipped once
     * contracts exist. No attachments: the demo's files aren't ours to copy.
     */
    public function run(): void
    {
        if (Contract::query()->exists()) {
            return;
        }

        /** @var list<array<string, mixed>> $rows */
        $rows = File::json(database_path('demo/contracts.json'), JSON_THROW_ON_ERROR);
        $users = User::query()->pluck('id', 'email');
        $names = User::query()->pluck('name', 'id');
        $types = ContractType::query()->pluck('id', 'name');
        $company = $users['admin@example.com'] ?? null;

        foreach ($rows as $row) {
            $userId = $users[$row['user']] ?? null;
            $typeId = $types[$row['type']] ?? $types->first();

            if ($userId === null || $typeId === null) {
                continue;
            }

            $contract = new Contract([
                'subject' => $row['subject'],
                'value' => $row['value'],
                'start_date' => $row['start_date'],
                'end_date' => $row['end_date'],
                'description' => $row['description'],
                'status' => $row['status'],
                'type_id' => $typeId,
                'user_id' => $userId,
            ]);
            $contract->forceFill(['created_by' => $company])->save();
            $contract->forceFill(['contract_number' => sprintf('CON%04d', $contract->id)])->save();

            foreach (['comments' => 'comment', 'notes' => 'note'] as $key => $type) {
                foreach ($row[$key] as $item) {
                    $contract->hasMany(ContractNote::class)->create([
                        'type' => $type,
                        'body' => $item['text'],
                        'user_id' => $users[$item['user']] ?? $company,
                    ]);
                }
            }

            foreach ($row['renewals'] as $renewal) {
                $contract->renewals()->create([...$renewal, 'created_by' => $company]);
            }

            foreach (array_unique($row['signed_by']) as $who) {
                $signerId = $who === 'company' ? $company : $userId;

                if ($signerId !== null) {
                    $contract->signatures()->create([
                        'user_id' => $signerId,
                        'signer_name' => $names[$signerId],
                        'signature_data' => ContractSignature::render($names[$signerId]),
                        'signed_at' => $contract->start_date->copy()->subDays(7)->setTime(10, 0),
                    ]);
                }
            }
        }
    }
}
