<?php

namespace App\Support;

/**
 * Exact money maths in integer cents: decimal(15,2) strings in, "1234.50" strings out, no float sums.
 */
class Money
{
    public static function toCents(string|int|float|null $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    public static function format(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /**
     * $percentage (two decimals) of $cents, rounded half-up to the cent.
     */
    public static function percentOf(int $cents, string|float|null $percentage): int
    {
        return intdiv($cents * self::toCents($percentage) + 5000, 10000);
    }
}
