<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use App\Models\Goal;
use App\Models\GoalCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class GoalSeeder extends Seeder
{
    /**
     * Goal categories, goals, milestones and contributions (database/demo/goals.json). Milestones are dated by
     * Goal::refreshMilestones() from the contributions. Goals are matched by name, so it can run again.
     */
    public function run(): void
    {
        /** @var array{categories: list<array<string, mixed>>, goals: list<array<string, mixed>>} $data */
        $data = File::json(database_path('demo/goals.json'), JSON_THROW_ON_ERROR);

        foreach ($data['categories'] as $row) {
            GoalCategory::query()->firstOrNew(['category_code' => $row['category_code']])->fill($row)->save();
        }

        $categories = GoalCategory::query()->pluck('id', 'category_code');
        $accounts = ChartOfAccount::query()->pluck('id', 'account_code');
        $admin = User::query()->where('email', 'admin@example.com')->value('id');

        foreach ($data['goals'] as $row) {
            if (Goal::query()->where('goal_name', $row['goal_name'])->exists()) {
                continue;
            }

            $goal = new Goal([
                'goal_name' => $row['goal_name'],
                'description' => $row['description'],
                'category_id' => $categories[$row['category']] ?? null,
                'goal_type' => $row['goal_type'],
                'priority' => $row['priority'],
                'target_amount' => $row['target_amount'],
                'start_date' => $row['start_date'],
                'target_date' => $row['target_date'],
                'chart_of_account_id' => $row['gl_account'] ? ($accounts[$row['gl_account']] ?? null) : null,
            ]);
            $goal->forceFill(['status' => $row['status'], 'created_by' => $admin])->save();

            $goal->milestones()->createMany($row['milestones']);

            foreach ($row['contributions'] as $c) {
                $goal->contributions()->create([
                    'contribution_date' => $c['date'],
                    'amount' => $c['amount'],
                    'contribution_type' => $c['type'],
                    'notes' => $c['notes'],
                ]);
            }

            $goal->refreshMilestones();
        }
    }
}
