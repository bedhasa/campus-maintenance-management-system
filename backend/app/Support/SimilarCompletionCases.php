<?php

namespace App\Support;

use App\Models\TechnicianCompletionReport;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class SimilarCompletionCases
{
    /**
     * Reference-only historical completion cases for knowledge transfer.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function forWorkOrder(WorkOrder $workOrder, int $limit = 8): array
    {
        try {
            return self::querySimilarReports($workOrder, $limit);
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function querySimilarReports(WorkOrder $workOrder, int $limit): array
    {
        $currentRequest = $workOrder->relationLoaded('request')
            ? $workOrder->getRelation('request')
            : $workOrder->request()->first();

        $assetId = $currentRequest?->asset_id;
        $categoryId = $currentRequest?->category_id;

        $haystack = trim(implode(' ', array_filter([
            $currentRequest?->title,
            $currentRequest?->description,
        ])));
        $keywords = self::keywordsFromText($haystack);

        if (!$assetId && !$categoryId && $keywords === []) {
            return [];
        }

        $hasIssueReported = Schema::hasColumn('technician_completion_reports', 'issue_reported');
        $hasResolutionSummary = Schema::hasColumn('technician_completion_reports', 'resolution_summary');
        $requestHasAsset = Schema::hasColumn('maintenance_requests', 'asset_id');
        $requestHasCategory = Schema::hasColumn('maintenance_requests', 'category_id');

        $reports = TechnicianCompletionReport::query()
            ->with([
                'technician:id,fname,lname',
                'spareParts.sparePart:id,name,part_code',
            ])
            ->where('work_order_id', '!=', $workOrder->id)
            ->whereNotNull('submitted_at')
            ->whereHas('workOrder', function ($q) {
                $q->where('work_status', 'completed');
            })
            ->where(function ($q) use ($assetId, $categoryId, $keywords, $hasIssueReported, $hasResolutionSummary, $requestHasAsset, $requestHasCategory) {
                if ($assetId && $requestHasAsset) {
                    $q->orWhereHas('workOrder.request', function ($r) use ($assetId) {
                        $r->where('asset_id', $assetId);
                    });
                }
                if ($categoryId && $requestHasCategory) {
                    $q->orWhereHas('workOrder.request', function ($r) use ($categoryId) {
                        $r->where('category_id', $categoryId);
                    });
                }
                foreach ($keywords as $kw) {
                    $safe = addcslashes($kw, '%_\\');
                    $q->orWhere(function ($qq) use ($safe, $hasIssueReported, $hasResolutionSummary) {
                        $qq->where('problem_found', 'like', '%'.$safe.'%')
                            ->orWhere('action_taken', 'like', '%'.$safe.'%');
                        if ($hasIssueReported) {
                            $qq->orWhere('issue_reported', 'like', '%'.$safe.'%');
                        }
                        if ($hasResolutionSummary) {
                            $qq->orWhere('resolution_summary', 'like', '%'.$safe.'%');
                        }
                    });
                }
            })
            ->orderByDesc('submitted_at')
            ->limit($limit)
            ->get();

        return $reports->map(function (TechnicianCompletionReport $report) {
            $parts = $report->spareParts->map(function ($row) {
                return [
                    'name' => $row->sparePart?->name ?? 'Unknown part',
                    'part_code' => $row->sparePart?->part_code,
                    'quantity_used' => (int) $row->quantity_used,
                ];
            })->values()->all();

            $cause = trim((string) ($report->probable_cause ?? ''));
            $custom = trim((string) ($report->probable_cause_custom ?? ''));
            $rootLabel = trim(implode(' — ', array_filter([$cause !== '' ? $cause : null, $custom !== '' ? $custom : null])));

            return [
                'work_order_id' => $report->work_order_id,
                'previous_problem' => $report->issue_reported
                    ?: $report->problem_found,
                'root_cause' => $rootLabel !== '' ? $rootLabel : null,
                'action_taken' => $report->action_taken,
                'spare_parts' => $parts,
                'completed_at' => $report->submitted_at?->toIso8601String(),
            ];
        })->all();
    }

    /**
     * @return list<string>
     */
    private static function keywordsFromText(string $text): array
    {
        $text = strtolower($text);
        $tokens = preg_split('/[^a-z0-9]+/i', $text) ?: [];
        $out = [];
        foreach ($tokens as $token) {
            $token = trim((string) $token);
            if (Str::length($token) < 4) {
                continue;
            }
            // Skip very common words
            if (in_array($token, ['maintenance', 'repair', 'request', 'please', 'that', 'with', 'this', 'from'], true)) {
                continue;
            }
            $out[$token] = $token;
            if (count($out) >= 8) {
                break;
            }
        }

        return array_values($out);
    }
}
