<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Groups permission names ("create-sales-invoices", "manage-any-goals") by the resource they act on, for the
 * role editor. The resource is the name after its leading action word.
 */
class PermissionGroups
{
    /** Action words, longest first so "manage-any" wins over "manage". */
    private const ACTIONS = [
        'convert-to-invoice', 'change-password', 'toggle-status', 'manage-any', 'manage-own', 'cancelled', 'signatures',
        'reconcile', 'duplicate', 'finalize', 'download', 'complete', 'convert', 'process', 'cleared', 'approve', 'manage',
        'create', 'delete', 'accept', 'reject', 'return', 'active', 'upload', 'cancel', 'print', 'close', 'clear', 'start',
        'renew', 'apply', 'test', 'edit', 'view', 'send', 'sent', 'post',
    ];

    /**
     * @param  iterable<string>  $names
     * @return list<array{resource: string, label: string, permissions: list<array{name: string, label: string}>}>
     */
    public static function group(iterable $names): array
    {
        $groups = [];

        foreach ($names as $name) {
            $action = collect(self::ACTIONS)->first(fn (string $a) => str_starts_with($name, "{$a}-"));
            $resource = $action === null ? $name : substr($name, strlen($action) + 1);
            $groups[$resource][] = ['name' => $name, 'label' => Str::headline($action ?? $name)];
        }

        ksort($groups);

        return array_map(fn (string $resource, array $permissions) => [
            'resource' => $resource,
            'label' => Str::headline($resource),
            'permissions' => $permissions,
        ], array_keys($groups), $groups);
    }
}
