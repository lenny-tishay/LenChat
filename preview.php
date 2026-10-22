<?php
/**
 * LenChat - preview.php
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 *
 * Host page for the Live Preview frame.
 */
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: SAMEORIGIN');
header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; "
    . "script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
    . "style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; "
    . "connect-src https:; frame-ancestors 'self'");
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview</title>
</head>
<body>
<script>
(function () {
    'use strict';
    window.addEventListener('message', function (e) {
        if (e.source !== window.parent || !e.data || typeof e.data.lenchatPreview !== 'string') { return; }
        document.open();
        document.write(e.data.lenchatPreview);
        document.close();
    }, { once: true });
})();
</script>
</body>
</html>
