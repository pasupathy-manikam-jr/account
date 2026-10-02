export type GoalStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type Goal = {
    id: number;
    goal_name: string;
    description: string | null;
    category_id: number | null;
    goal_type: string;
    priority: string;
    target_amount: string;
    current_amount: string | null;
    start_date: string;
    target_date: string;
    chart_of_account_id: number | null;
    status: GoalStatus;
    category: { id: number; category_name: string } | null;
};

export type GoalOptions = {
    categories: { id: number; category_name: string }[];
    chartOfAccounts: {
        id: number;
        account_code: string;
        account_name: string;
    }[];
};

export const GOAL_TYPES = [
    'savings',
    'debt_reduction',
    'expense_reduction',
    'revenue',
] as const;

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

/** "debt_reduction" -> "Debt Reduction" */
export const titleCase = (value: string) =>
    value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Share of the target reached, capped at 100. */
export const progressOf = (
    goal: Pick<Goal, 'current_amount' | 'target_amount'>,
) =>
    Math.min(
        100,
        Math.round(
            (Number(goal.current_amount ?? 0) /
                Math.max(Number(goal.target_amount), 0.01)) *
                100,
        ),
    );
