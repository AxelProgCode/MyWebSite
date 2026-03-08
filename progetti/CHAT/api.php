<?php
/**
 * api.php — Proxy tra il frontend HTML e il Google Apps Script
 *
 * CONFIGURAZIONE:
 * 1. Pubblica il tuo Apps Script come Web App (vedi SCRIPT.js)
 * 2. Copia l'URL della Web App nella costante APPS_SCRIPT_URL
 * 3. Carica questo file sullo stesso server dell'HTML
 */

// ── CONFIGURAZIONE ────────────────────────────────────────
define('APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbz0z4hF5RMS9fefJ1YYliwHjLwwMsovLHAqKvcmxZt9MJ0ft_zF0pV31kk7H7G6lXYuBA/exec');

// ─────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Leggi il body JSON
$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!$data || !isset($data['action'])) {
    echo json_encode(['ok' => false, 'error' => 'Richiesta non valida']);
    exit;
}

// Inoltra la richiesta ad Apps Script
$response = forwardToAppsScript($data);
echo $response;

// ─── FUNZIONE PROXY ───────────────────────────────────────
function forwardToAppsScript(array $payload): string {
    $url = APPS_SCRIPT_URL;

    $options = [
        'http' => [
            'header'        => "Content-Type: application/json\r\n",
            'method'        => 'POST',
            'content'       => json_encode($payload),
            'timeout'       => 15,
            'ignore_errors' => true,
        ],
        // Segui i redirect di Google (importante per Apps Script)
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ];

    $context  = stream_context_create($options);
    $result   = @file_get_contents($url, false, $context);

    if ($result === false) {
        // Prova con cURL se file_get_contents fallisce
        $result = curlPost($url, $payload);
    }

    if ($result === false || $result === null) {
        return json_encode(['ok' => false, 'error' => 'Impossibile contattare Google Apps Script. Verifica l\'URL nella configurazione.']);
    }

    // Verifica che la risposta sia JSON valido
    $decoded = json_decode($result, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return json_encode(['ok' => false, 'error' => 'Risposta non valida da Apps Script', 'raw' => substr($result, 0, 200)]);
    }

    return $result;
}

function curlPost(string $url, array $payload): string|false {
    if (!function_exists('curl_init')) return false;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_FOLLOWLOCATION => true,   // segui redirect Google
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $result = curl_exec($ch);
    $error  = curl_error($ch);
    curl_close($ch);

    if ($error) return false;
    return $result;
}