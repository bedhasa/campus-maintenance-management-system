<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $appName }} OTP Verification</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#1d4ed8;">{{ $appName }}</p>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Your verification code</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
                Hello {{ $displayName ?? $user->display_name ?? $user->email ?? 'there' }}, use the code below to verify your account. It expires in 5 minutes.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:24px;text-align:center;">
                <div style="font-size:36px;font-weight:800;letter-spacing:0.35em;color:#1d4ed8;">{{ $otp }}</div>
            </div>

            <div style="margin-top:24px;text-align:center;">
                <a href="{{ $verifyUrl }}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;">
                    Open Verification Page
                </a>
            </div>

            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#475569;">
                You can also open the system directly and continue from the verification screen.
            </p>

            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                System link: <a href="{{ $loginUrl }}" style="color:#1d4ed8;text-decoration:none;">{{ $loginUrl }}</a>
            </p>

            <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                If you did not request this code, you can ignore this email.
            </p>
        </div>
    </div>
</body>
</html>
