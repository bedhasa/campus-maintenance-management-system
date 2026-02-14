<?php

namespace App\Support;

class SlaResolver
{
    public static function hoursForPriority(string $priority): int
    {
        return match ($priority) {
            'urgent' => 4,
            'high' => 8,
            'medium' => 24,
            default => 48,
        };
    }
}

