<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $appName }} Notification</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">{{ $appName }}</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Hello {{ $displayName ?? $user->display_name ?? $user->email }},</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155;">
                {{ $messageBody }}
            </p>
            <div style="margin-top:24px;">
                <a href="{{ $loginUrl }}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;">
                    Open System
                </a>
            </div>
            <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#475569;">
                This message was sent from the {{ $appName }} system.
            </p>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#64748b;">
                System link: <a href="{{ $loginUrl }}" style="color:#1d4ed8;text-decoration:none;">{{ $loginUrl }}</a>
            </p>
        </div>
    </div>
</body>
</html>
