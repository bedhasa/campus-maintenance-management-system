<?php

$configuredFrontendOrigins = array_values(array_filter(array_map(
    static fn (string $value): ?string => ($value = trim($value)) !== '' ? rtrim($value, '/') : null,
    explode(',', (string) env('FRONTEND_URLS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001'))
)));

if ($configuredFrontendOrigins === []) {
    $fallbackOrigin = trim((string) env('FRONTEND_URL', 'http://localhost:3000'));

    if ($fallbackOrigin !== '') {
        $configuredFrontendOrigins[] = rtrim($fallbackOrigin, '/');
    }
}

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $configuredFrontendOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
