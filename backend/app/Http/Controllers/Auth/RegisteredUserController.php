<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;

class RegisteredUserController extends Controller
{
    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): Response
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $nameParts = preg_split('/\s+/', trim($request->string('name')->toString()), 2) ?: [];
        $fname = $nameParts[0] ?? trim($request->string('name')->toString());
        $lname = $nameParts[1] ?? '';
        $baseUsername = Str::slug(Str::before($request->string('email')->toString(), '@')) ?: 'user';
        $username = $baseUsername;
        $suffix = 1;

        while (User::where('username', $username)->exists()) {
            $username = $baseUsername.$suffix;
            $suffix++;
        }

        $departmentId = Department::query()->value('id');
        if (!$departmentId) {
            $departmentId = Department::create([
                'name' => 'General',
                'faculty' => 'General',
            ])->id;
        }

        $user = User::create([
            'fname' => $fname,
            'lname' => $lname,
            'username' => $username,
            'email' => $request->string('email')->lower()->toString(),
            'password' => Hash::make($request->string('password')),
            'university_id_number' => 'REG-'.Str::upper(Str::random(10)),
            'dept_id' => $departmentId,
            'phone' => '0000000000',
        ]);

        event(new Registered($user));

        Auth::login($user);

        return response()->noContent();
    }
}
