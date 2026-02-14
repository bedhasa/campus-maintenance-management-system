<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('specialties')) {
            Schema::create('specialties', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100);
                $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['name', 'category_id']);
            });
        }

        if (!Schema::hasTable('technician_specialties')) {
            Schema::create('technician_specialties', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('specialty_id')->constrained('specialties')->cascadeOnDelete();
                $table->timestamp('created_at')->useCurrent();
                $table->unique(['user_id', 'specialty_id']);
            });
        }

        if (!Schema::hasTable('work_orders')) {
            Schema::create('work_orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('request_id')->nullable()->constrained('maintenance_requests')->nullOnDelete();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->enum('priority', ['low', 'medium', 'high', 'urgent']);
                $table->date('scheduled_date')->nullable();
                $table->time('scheduled_time')->nullable();
                $table->decimal('estimated_hours', 8, 2)->nullable();
                $table->enum('work_status', ['draft', 'assigned', 'in_progress', 'completed'])->default('draft');
                $table->text('completion_note')->nullable();
                $table->text('delay_reason')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index(['assigned_to', 'work_status']);
                $table->index(['request_id', 'work_status']);
            });
        }

        if (!Schema::hasTable('spare_parts')) {
            Schema::create('spare_parts', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('part_code', 80)->unique();
                $table->decimal('unit_price', 12, 2)->default(0);
                $table->unsignedInteger('quantity_available')->default(0);
                $table->unsignedInteger('minimum_stock')->default(0);
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('work_order_spare_parts')) {
            Schema::create('work_order_spare_parts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
                $table->foreignId('spare_part_id')->constrained('spare_parts')->cascadeOnDelete();
                $table->unsignedInteger('quantity_used');
                $table->decimal('unit_price', 12, 2);
                $table->decimal('total_price', 12, 2);
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('technician_ratings')) {
            Schema::create('technician_ratings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('request_id')->constrained('maintenance_requests')->cascadeOnDelete();
                $table->foreignId('technician_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedTinyInteger('rating');
                $table->text('comment')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->unique('request_id');
            });
        }

        if (!Schema::hasTable('system_activity_logs')) {
            Schema::create('system_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('module', 100);
                $table->string('action', 100);
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->text('description')->nullable();
                $table->string('ip_address', 64)->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['module', 'action']);
                $table->index(['user_id', 'created_at']);
            });
        }

        if (!Schema::hasTable('preventive_maintenance_plans')) {
            Schema::create('preventive_maintenance_plans', function (Blueprint $table) {
                $table->id();
                $table->string('title', 150);
                $table->text('description')->nullable();
                $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
                $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
                $table->enum('frequency_type', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
                $table->unsignedInteger('frequency_interval')->default(1);
                $table->date('next_due_date');
                $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
                $table->decimal('estimated_hours', 8, 2)->nullable();
                $table->foreignId('assigned_technician_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->enum('status', ['active', 'paused'])->default('active');
                $table->timestamps();
                $table->index(['status', 'next_due_date']);
            });
        }

        if (!Schema::hasTable('preventive_maintenance_assignments')) {
            Schema::create('preventive_maintenance_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('preventive_maintenance_plans')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('assigned_by')->constrained('users')->cascadeOnDelete();
                $table->timestamp('created_at')->useCurrent();
                $table->unique(['plan_id', 'user_id']);
            });
        }

        if (!Schema::hasTable('preventive_maintenance_logs')) {
            Schema::create('preventive_maintenance_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')->constrained('preventive_maintenance_plans')->cascadeOnDelete();
                $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
                $table->timestamp('performed_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'avg_rating')) {
                    $table->decimal('avg_rating', 3, 2)->default(0)->after('profile_picture');
                }
                if (!Schema::hasColumn('users', 'total_ratings')) {
                    $table->unsignedInteger('total_ratings')->default(0)->after('avg_rating');
                }
                if (!Schema::hasColumn('users', 'is_active')) {
                    $table->boolean('is_active')->default(true)->after('total_ratings');
                }
            });
        }

        if (Schema::hasTable('maintenance_requests')) {
            Schema::table('maintenance_requests', function (Blueprint $table) {
                if (!Schema::hasColumn('maintenance_requests', 'due_date')) {
                    $table->timestamp('due_date')->nullable()->after('status');
                }
                if (!Schema::hasColumn('maintenance_requests', 'sla_hours')) {
                    $table->unsignedInteger('sla_hours')->nullable()->after('due_date');
                }
                if (!Schema::hasColumn('maintenance_requests', 'is_overdue')) {
                    $table->boolean('is_overdue')->default(false)->after('sla_hours');
                }
                if (!Schema::hasColumn('maintenance_requests', 'department_id')) {
                    $table->foreignId('department_id')->nullable()->after('requester_id')->constrained('departments')->nullOnDelete();
                }
            });
        }

        if (Schema::hasTable('notifications')) {
            Schema::table('notifications', function (Blueprint $table) {
                if (!Schema::hasColumn('notifications', 'module')) {
                    $table->string('module', 80)->nullable()->after('type');
                }
                if (!Schema::hasColumn('notifications', 'recipient_role')) {
                    $table->string('recipient_role', 50)->nullable()->after('user_id');
                }
            });
        }

        if (Schema::hasTable('user_settings')) {
            Schema::table('user_settings', function (Blueprint $table) {
                if (!Schema::hasColumn('user_settings', 'default_dashboard_filter')) {
                    $table->string('default_dashboard_filter', 50)->default('all')->after('timezone');
                }
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive for production-safe module rollout.
    }
};
