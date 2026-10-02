<?php

namespace Tests\Feature\Goal;

use App\Models\Goal;
use App\Models\GoalCategory;
use App\Models\GoalContribution;
use App\Models\GoalMilestone;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class GoalTest extends TestCase
{
    use RefreshDatabase;

    private User $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = $this->userWithRole();
        $this->actingAs($this->company);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function goal(array $attributes = []): Goal
    {
        $goal = new Goal([
            'goal_name' => 'Dana Kecemasan Syarikat',
            'goal_type' => 'savings',
            'priority' => 'high',
            'target_amount' => '10000.00',
            'start_date' => '2026-01-01',
            'target_date' => '2026-12-31',
            ...$attributes,
        ]);
        $goal->forceFill(['status' => $attributes['status'] ?? 'active', 'created_by' => $this->company->id])->save();

        return $goal;
    }

    public function test_goals_are_listed_with_their_current_amount_and_stats(): void
    {
        $goal = $this->goal();
        $goal->contributions()->create(['contribution_date' => '2026-03-01', 'amount' => '2500.00', 'contribution_type' => 'manual']);
        $this->goal(['goal_name' => 'Q4 revenue target', 'status' => 'draft']);

        $this->get(route('goal.goals.index'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('goal/goals/index')
            ->has('goals.data', 2)
            ->where('counts.active', 1)
            ->where('stats.total', 2)
            ->where('stats.current', '2500.00')
            ->where('stats.target', '20000.00'));

        $this->get(route('goal.goals.index', ['status' => 'draft']))->assertInertia(fn ($page) => $page->has('goals.data', 1));
        $this->get(route('goal.goals.show', $goal))->assertOk()->assertInertia(fn ($page) => $page
            ->component('goal/goals/show')->where('goal.current_amount', '2500.00')->has('goal.contributions', 1));
    }

    public function test_goals_are_validated_created_updated_and_moved_through_their_statuses(): void
    {
        $this->post(route('goal.goals.store'), ['goal_type' => 'lottery', 'target_amount' => '0', 'start_date' => '2026-05-01', 'target_date' => '2026-04-01'])
            ->assertSessionHasErrors(['goal_name', 'goal_type', 'priority', 'target_amount', 'target_date']);

        $category = GoalCategory::query()->create(['category_name' => 'Financial', 'category_code' => 'FINANCE']);
        $this->post(route('goal.goals.store'), [
            'goal_name' => 'Pay off Maybank term loan', 'category_id' => $category->id, 'goal_type' => 'debt_reduction',
            'priority' => 'critical', 'target_amount' => '80000', 'start_date' => '2026-02-01', 'target_date' => '2026-11-30',
        ])->assertSessionHasNoErrors();

        $goal = Goal::query()->where('goal_name', 'Pay off Maybank term loan')->firstOrFail();
        $this->assertSame('draft', $goal->status);
        $this->assertSame($this->company->id, $goal->created_by);

        $this->put(route('goal.goals.complete', $goal))->assertSessionHasErrors('status');
        $this->put(route('goal.goals.activate', $goal))->assertSessionHasNoErrors();
        $this->assertSame('active', $goal->fresh()?->status);
        $this->put(route('goal.goals.complete', $goal))->assertSessionHasNoErrors();
        $this->assertSame('completed', $goal->fresh()?->status);

        $this->put(route('goal.goals.update', $goal), ['goal_name' => 'Changed'])->assertInertiaFlash('toast.type', 'error');
        $this->delete(route('goal.goals.destroy', $goal))->assertInertiaFlash('toast.type', 'error');
        $this->assertModelExists($goal);

        $draft = $this->goal(['status' => 'draft']);
        $this->delete(route('goal.goals.destroy', $draft))->assertRedirect(route('goal.goals.index'));
        $this->assertModelMissing($draft);
    }

    public function test_contributions_need_an_active_goal_and_redate_its_milestones(): void
    {
        $goal = $this->goal();
        $first = GoalMilestone::query()->create(['goal_id' => $goal->id, 'milestone_name' => 'First RM5,000', 'target_amount' => '5000', 'target_date' => '2026-06-30']);
        $full = GoalMilestone::query()->create(['goal_id' => $goal->id, 'milestone_name' => 'Full target', 'target_amount' => '10000', 'target_date' => '2026-12-31']);

        $this->post(route('goal.contributions.store'), ['goal_id' => $goal->id, 'contribution_date' => '2026-03-01', 'amount' => '3000', 'contribution_type' => 'manual'])
            ->assertSessionHasNoErrors();
        $this->post(route('goal.contributions.store'), ['goal_id' => $goal->id, 'contribution_date' => '2026-04-01', 'amount' => '2500', 'contribution_type' => 'automatic'])
            ->assertSessionHasNoErrors();

        $this->assertSame('2026-04-01', $first->fresh()?->achieved_date?->toDateString());
        $this->assertSame('achieved', $first->fresh()?->status);
        $this->assertNull($full->fresh()?->achieved_date);

        // Removing the contribution that crossed the line un-achieves the milestone.
        $crossing = GoalContribution::query()->where('contribution_date', '2026-04-01')->firstOrFail();
        $this->delete(route('goal.contributions.destroy', $crossing))->assertSessionHasNoErrors();
        $this->assertNull($first->fresh()?->achieved_date);

        $this->post(route('goal.contributions.store'), ['goal_id' => $goal->id, 'amount' => '-5', 'contribution_type' => 'cash'])
            ->assertSessionHasErrors(['contribution_date', 'amount', 'contribution_type']);

        $draft = $this->goal(['status' => 'draft']);
        $this->post(route('goal.contributions.store'), ['goal_id' => $draft->id, 'contribution_date' => '2026-03-01', 'amount' => '100', 'contribution_type' => 'manual'])
            ->assertSessionHasErrors(['goal_id' => 'Contributions can only be added to active goals.']);

        $goal->moveTo('completed');
        $remaining = GoalContribution::query()->where('goal_id', $goal->id)->firstOrFail();
        $this->delete(route('goal.contributions.destroy', $remaining))->assertInertiaFlash('toast.type', 'error');
        $this->assertModelExists($remaining);
    }

    public function test_milestones_cannot_exceed_their_goal_target(): void
    {
        $goal = $this->goal();

        $this->post(route('goal.milestones.store'), ['goal_id' => $goal->id, 'milestone_name' => 'Too far', 'target_amount' => '20000', 'target_date' => '2026-06-30'])
            ->assertSessionHasErrors('target_amount');
        $this->post(route('goal.milestones.store'), ['goal_id' => $goal->id, 'milestone_name' => 'Halfway', 'target_amount' => '5000', 'target_date' => '2020-06-30'])
            ->assertSessionHasNoErrors();

        $this->get(route('goal.milestones.index'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('goal/milestones/index')->where('counts.overdue', 1)->where('milestones.data.0.status', 'overdue'));
    }

    public function test_tracking_shows_each_contribution_with_its_pace(): void
    {
        $this->assertSame('ahead', Goal::pace(60, Carbon::parse('2026-01-01'), Carbon::parse('2026-12-31'), Carbon::parse('2026-07-01')));
        $this->assertSame('on_track', Goal::pace(50, Carbon::parse('2026-01-01'), Carbon::parse('2026-12-31'), Carbon::parse('2026-07-01')));
        $this->assertSame('behind', Goal::pace(35, Carbon::parse('2026-01-01'), Carbon::parse('2026-12-31'), Carbon::parse('2026-07-01')));
        $this->assertSame('critical', Goal::pace(10, Carbon::parse('2026-01-01'), Carbon::parse('2026-12-31'), Carbon::parse('2026-07-01')));

        $goal = $this->goal();
        $goal->contributions()->create(['contribution_date' => '2026-01-15', 'amount' => '1000', 'contribution_type' => 'manual']);
        $goal->contributions()->create(['contribution_date' => '2026-10-01', 'amount' => '1000', 'contribution_type' => 'manual']);

        $this->get(route('goal.tracking.index'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('goal/tracking/index')
            ->where('counts.all', 2)
            ->where('counts.ahead', 1)
            ->where('counts.critical', 1)
            ->where('trackings.data.0.running_total', '2000.00')
            ->where('trackings.data.0.progress', 20)
            ->where('stats.total_contributions', '2000.00'));

        $this->get(route('goal.tracking.index', ['status' => 'critical']))->assertInertia(fn ($page) => $page->has('trackings.data', 1));
        $this->get(route('goal.tracking.index', ['search' => 'nothing like it']))->assertInertia(fn ($page) => $page->where('counts.all', 0));
    }

    public function test_categories_are_managed_and_kept_while_goals_use_them(): void
    {
        $this->post(route('goal.categories.store'), ['category_name' => 'Financial', 'category_code' => 'FINANCE', 'is_active' => true])->assertSessionHasNoErrors();
        $this->post(route('goal.categories.store'), ['category_name' => 'Again', 'category_code' => 'FINANCE'])->assertSessionHasErrors('category_code');

        $category = GoalCategory::query()->firstOrFail();
        $this->goal(['category_id' => $category->id]);
        $this->delete(route('goal.categories.destroy', $category))->assertInertiaFlash('toast.type', 'error');
        $this->assertModelExists($category);
        $this->get(route('goal.categories.index'))->assertOk()->assertInertia(fn ($page) => $page->where('categories.0.goals_count', 1));
    }

    public function test_users_without_goal_permissions_are_refused(): void
    {
        $goal = $this->goal();
        $this->actingAs($this->userWithRole('staff'));

        $this->get(route('goal.goals.index'))->assertForbidden();
        $this->get(route('goal.goals.show', $goal))->assertForbidden();
        $this->get(route('goal.tracking.index'))->assertForbidden();
        $this->post(route('goal.contributions.store'), [])->assertForbidden();
        $this->get(route('goal.categories.index'))->assertForbidden();
    }
}
