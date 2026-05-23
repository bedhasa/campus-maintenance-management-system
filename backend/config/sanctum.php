<?php

use Laravel\Sanctum\Sanctum;

$extractHostWithPort = static function (?string $value): ?string {
    $value = trim((string) $value);

    if ($value === '') {
        return null;
    }

    $host = parse_url($value, PHP_URL_HOST);
    $port = parse_url($value, PHP_URL_PORT);

    if ($host !== null && $host !== false) {
        return $port ? "{$host}:{$port}" : $host;
    }

    return $value;
};

$frontendUrls = array_filter(array_map(
    static fn (string $value): string => trim($value),
    explode(',', (string) env('FRONTEND_URLS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001'))
));

$configuredStatefulDomains = array_filter(array_map(
    static fn (string $value): string => trim($value),
    explode(',', (string) env('SANCTUM_STATEFUL_DOMAINS', ''))
));

$defaultStatefulDomains = array_filter([
    Sanctum::currentApplicationUrlWithPort(),
    $extractHostWithPort((string) env('APP_URL')),
    ...array_map($extractHostWithPort, $frontendUrls),
]);

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    |
    | Requests from the following domains / hosts will receive stateful API
    | authentication cookies. Typically, these should include your local
    | and production domains which access your API via a frontend SPA.
    |
    */

    'stateful' => array_values(array_unique([
        ...$configuredStatefulDomains,
        ...$defaultStatefulDomains,
    ])),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Guards
    |--------------------------------------------------------------------------
    |
    | This array contains the authentication guards that will be checked when
    | Sanctum is trying to authenticate a request. If none of these guards
    | are able to authenticate the request, Sanctum will use the bearer
    | token that's present on an incoming request for authentication.
    |
    */

    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration Minutes
    |--------------------------------------------------------------------------
    |
    | This value controls the number of minutes until an issued token will be
    | considered expired. This will override any values set in the token's
    | "expires_at" attribute, but first-party sessions are not affected.
    |
    */

    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    |
    | Sanctum can prefix new tokens in order to take advantage of numerous
    | security scanning initiatives maintained by open source platforms
    | that notify developers if they commit tokens into repositories.
    |
    | See: https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
    |
    */

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Sanctum Middleware
    |--------------------------------------------------------------------------
    |
    | When authenticating your first-party SPA with Sanctum you may need to
    | customize some of the middleware Sanctum uses while processing the
    | request. You may change the middleware listed below as required.
    |
    */

    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
