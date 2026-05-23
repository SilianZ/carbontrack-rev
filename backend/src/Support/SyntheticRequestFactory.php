<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Headers;
use Slim\Psr7\Request;
use Slim\Psr7\Stream;
use Slim\Psr7\Uri;

class SyntheticRequestFactory
{
    public static function fromContext(
        ?string $Silian_path = '/',
        string $Silian_method = 'GET',
        ?string $Silian_requestId = null,
        array $Silian_queryParams = [],
        mixed $Silian_parsedBody = null,
        array $Silian_serverParams = []
    ): ServerRequestInterface {
        $Silian_normalizedPath = self::normalizePath($Silian_path);
        $Silian_headers = [];

        if (is_string($Silian_requestId) && $Silian_requestId !== '') {
            $Silian_headers['X-Request-ID'] = [$Silian_requestId];
            $Silian_serverParams['HTTP_X_REQUEST_ID'] = $Silian_requestId;
            $Silian_serverParams['REQUEST_ID'] = $Silian_requestId;
        }

        $Silian_serverParams['REQUEST_METHOD'] = strtoupper($Silian_method);
        $Silian_serverParams['REQUEST_URI'] = $Silian_normalizedPath;
        $Silian_serverParams['SCRIPT_NAME'] = $Silian_normalizedPath;

        $Silian_uri = new Uri('http', 'localhost', null, $Silian_normalizedPath);
        $Silian_stream = new Stream(fopen('php://temp', 'r+'));
        $Silian_request = new Request(strtoupper($Silian_method), $Silian_uri, new Headers($Silian_headers), [], $Silian_serverParams, $Silian_stream);
        $Silian_request = $Silian_request->withQueryParams($Silian_queryParams);

        if ($Silian_parsedBody !== null) {
            $Silian_request = $Silian_request->withParsedBody($Silian_parsedBody);
        }

        if (is_string($Silian_requestId) && $Silian_requestId !== '') {
            $Silian_request = $Silian_request->withAttribute('request_id', $Silian_requestId);
        }

        return $Silian_request;
    }

    private static function normalizePath(?string $Silian_path): string
    {
        $Silian_candidate = trim((string) $Silian_path);
        if ($Silian_candidate === '') {
            return '/';
        }

        if (preg_match('#^https?://#i', $Silian_candidate) === 1) {
            $Silian_parts = parse_url($Silian_candidate);
            $Silian_candidate = is_array($Silian_parts) ? (string) ($Silian_parts['path'] ?? '/') : '/';
        }

        if ($Silian_candidate[0] !== '/') {
            $Silian_candidate = '/' . $Silian_candidate;
        }

        return $Silian_candidate;
    }
}