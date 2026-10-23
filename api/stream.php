<?php
/**
 * LenChat - api/stream.php
 * Copyright (c) 2026 Leonard Muia t/a LENTECH DIGIWORKS (https://lentech.co.ke)
 * AGPL-3.0 with additional attribution terms - see LICENSE and NOTICE.md.
 */
declare(strict_types=1);

$cfg   = require dirname(__DIR__) . '/config.php';
$relay = $cfg['relay'];

function lc_fail($status, $message)
{
    if (!headers_sent()) {
        http_response_code((int) $status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    echo json_encode(['error' => ['message' => $message]]);
    exit;
}

function lc_host_allowed($host, array $allowed)
{
    foreach ($allowed as $entry) {
        $entry = strtolower(trim((string) $entry));
        if ($entry === '') {
            continue;
        }
        if ($entry === $host) {
            return true;
        }
        if (strpos($entry, '*.') === 0) {
            $suffix = substr($entry, 1);
            if (strlen($host) > strlen($suffix) && substr($host, -strlen($suffix)) === $suffix) {
                return true;
            }
        }
    }
    return false;
}

header('X-Content-Type-Options: nosniff');

if (empty($relay['enabled'])) {
    lc_fail(403, 'The server relay is disabled in config.php.');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    lc_fail(405, 'POST only.');
}
if (!function_exists('curl_init')) {
    lc_fail(500, 'The PHP cURL extension is not available on this host.');
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $thisHost   = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($originHost !== $thisHost) {
        lc_fail(403, 'Cross-origin requests are not allowed.');
    }
}

$max = (int) $relay['max_body_bytes'];
$raw = file_get_contents('php://input', false, null, 0, $max + 1);
if ($raw === false || $raw === '') {
    lc_fail(400, 'Empty request.');
}
if (strlen($raw) > $max) {
    lc_fail(413, 'Request too large. Attach fewer files or raise relay.max_body_bytes.');
}

$outer = json_decode($raw, true);
if (!is_array($outer)) {
    lc_fail(400, 'Malformed request.');
}

if ((string) $relay['access_token'] !== '') {
    $given = isset($outer['t']) ? (string) $outer['t'] : '';
    if (!hash_equals((string) $relay['access_token'], $given)) {
        lc_fail(401, 'Invalid or missing access token (see Settings).');
    }
}

$decoded = base64_decode(isset($outer['d']) ? (string) $outer['d'] : '', true);
$env     = ($decoded === false) ? null : json_decode($decoded, true);
if (!is_array($env) || empty($env['url']) || !isset($env['body'])) {
    lc_fail(400, 'Malformed envelope.');
}

$parts = parse_url((string) $env['url']);
if (!$parts || empty($parts['host']) || empty($parts['scheme']) || isset($parts['user']) || isset($parts['pass'])) {
    lc_fail(400, 'Invalid target URL.');
}
$scheme = strtolower($parts['scheme']);
$host   = strtolower($parts['host']);
$port   = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);

$allowPrivate = !empty($relay['allow_private_hosts']);
if ($scheme !== 'https' && !($scheme === 'http' && $allowPrivate)) {
    lc_fail(400, 'Only HTTPS targets are allowed.');
}

if (!lc_host_allowed($host, $relay['allowed_hosts']) && empty($relay['allow_custom_hosts'])) {
    lc_fail(403, "Host '{$host}' is not in relay.allowed_hosts (edit config.php).");
}

$ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
if (!filter_var($ip, FILTER_VALIDATE_IP)) {
    lc_fail(502, 'Could not resolve the upstream host.');
}
if (!$allowPrivate && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    lc_fail(403, 'Private or reserved network targets are blocked.');
}

$forwardable = [
    'authorization', 'x-api-key', 'api-key', 'anthropic-version', 'x-goog-api-key',
    'http-referer', 'x-title', 'openai-organization',
];
$headers = ['Content-Type: application/json', 'Accept: text/event-stream'];
if (isset($env['headers']) && is_array($env['headers'])) {
    foreach ($env['headers'] as $name => $value) {
        $n = strtolower(trim((string) $name));
        if (!in_array($n, $forwardable, true)) {
            continue;
        }
        $headers[] = $n . ': ' . str_replace(["\r", "\n"], '', (string) $value);
    }
}
$body = is_string($env['body']) ? $env['body'] : json_encode($env['body']);

@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
@ini_set('implicit_flush', '1');
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
}
while (ob_get_level() > 0) {
    ob_end_clean();
}
ignore_user_abort(false);
set_time_limit(0);

$started = false;
$status  = 0;
$ctype   = '';

$ch = curl_init((string) $env['url']);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_ENCODING       => 'identity',
    CURLOPT_CONNECTTIMEOUT => (int) $relay['connect_timeout'],
    CURLOPT_TIMEOUT        => (int) $relay['timeout'],
    CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS | ($allowPrivate ? CURLPROTO_HTTP : 0),
    CURLOPT_RESOLVE        => ["{$host}:{$port}:{$ip}"],
    CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$status, &$ctype) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
            $status = (int) $m[1];
            $ctype  = '';
        } elseif (stripos($line, 'content-type:') === 0) {
            $ctype = trim(substr($line, 13));
        }
        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION  => function ($ch, $chunk) use (&$started, &$status, &$ctype) {
        if (!$started) {
            $started = true;
            http_response_code($status ?: 200);
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('X-Accel-Buffering: no');
            if ($status >= 200 && $status < 300) {
                header('Content-Type: text/event-stream; charset=utf-8');
                echo ':' . str_repeat(' ', 2048) . "\n\n";
            } else {
                header('Content-Type: ' . ($ctype !== '' ? $ctype : 'application/json'));
            }
        }
        echo $chunk;
        flush();
        return connection_aborted() ? 0 : strlen($chunk);
    },
]);

curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
curl_close($ch);

if (!$started) {
    if ($errno) {
        lc_fail(502, 'Upstream connection failed: ' . $error);
    }
    http_response_code($status ?: 502);
    exit;
}
if ($errno && !connection_aborted()) {
    echo 'data: ' . json_encode(['error' => ['message' => 'Upstream stream interrupted: ' . $error]]) . "\n\n";
    flush();
}