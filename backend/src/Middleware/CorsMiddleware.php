<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CorsMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $Silian_request, RequestHandlerInterface $Silian_handler): ResponseInterface
    {
        // Read config from env with sensible defaults
        $Silian_allowedOriginsEnv = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '*';
        $Silian_allowedMethods = $_ENV['CORS_ALLOWED_METHODS'] ?? 'GET,POST,PUT,DELETE,OPTIONS';
    // 默认允许常见自定义头，覆盖时使用 CORS_ALLOWED_HEADERS
    $Silian_allowedHeadersDefault = $_ENV['CORS_ALLOWED_HEADERS'] ?? 'Content-Type,Authorization,X-Request-ID,X-Requested-With,X-Turnstile-Token';
    $Silian_exposeHeaders = $_ENV['CORS_EXPOSE_HEADERS'] ?? 'Content-Type,Authorization,X-Request-ID';
        $Silian_allowCredentials = filter_var($_ENV['CORS_ALLOW_CREDENTIALS'] ?? 'true', FILTER_VALIDATE_BOOLEAN);

        // Parse and trim allowed origins list, and add localhost for dev env
        $Silian_allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $Silian_allowedOriginsEnv))));
        if (($_ENV['APP_ENV'] ?? 'production') !== 'production') {
            $Silian_localOrigins = [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:3000'
            ];
            $Silian_allowedOrigins = array_unique(array_merge($Silian_allowedOrigins, $Silian_localOrigins));
        }

        $Silian_origin = $Silian_request->getHeaderLine('Origin');
        $Silian_method = strtoupper($Silian_request->getMethod());

        // Helper to check wildcard origins like https://*.example.com
        $Silian_isOriginAllowed = function (?string $Silian_origin) use ($Silian_allowedOrigins): bool {
            if (!$Silian_origin) {
                return false;
            }
            // 允许特殊的 "null" 源（如 file:// 场景）当配置为通配或显式包含 null
            if ($Silian_origin === 'null') {
                foreach ($Silian_allowedOrigins as $Silian_allowed) {
                    if ($Silian_allowed === '*' || strcasecmp($Silian_allowed, 'null') === 0) {
                        return true;
                    }
                }
                return false;
            }
            foreach ($Silian_allowedOrigins as $Silian_allowed) {
                if ($Silian_allowed === '*') {
                    return true;
                }
                if (strcasecmp($Silian_allowed, $Silian_origin) === 0) {
                    return true;
                }
                // Wildcard subdomain match: https://*.example.com
                if (strpos($Silian_allowed, '*.') !== false) {
                    $Silian_pattern = '/^' . str_replace(['*.', '.', '/'], ['([^.]+)\.', '\\.', '\/'], preg_quote($Silian_allowed, '/')) . '$/i';
                    if (preg_match($Silian_pattern, $Silian_origin)) {
                        return true;
                    }
                }
            }
            return false;
        };

        // Determine headers for CORS (used for both preflight and actual responses)
        $Silian_varyValues = ['Origin'];
        $Silian_headersToSet = [
            'Access-Control-Allow-Methods' => $Silian_allowedMethods,
            'Access-Control-Expose-Headers' => $Silian_exposeHeaders,
            'Access-Control-Max-Age' => '86400',
        ];

        // Access-Control-Allow-Headers: echo request headers if present, else use default
        $Silian_requestHeaders = $Silian_request->getHeaderLine('Access-Control-Request-Headers');
        if ($Silian_requestHeaders) {
            $Silian_headersToSet['Access-Control-Allow-Headers'] = $Silian_requestHeaders;
            $Silian_varyValues[] = 'Access-Control-Request-Headers';
        } else {
            $Silian_headersToSet['Access-Control-Allow-Headers'] = $Silian_allowedHeadersDefault;
        }

        // Allow-Origin logic considering credentials
        if ($Silian_isOriginAllowed($Silian_origin)) {
            $Silian_headersToSet['Access-Control-Allow-Origin'] = $Silian_origin;
            if ($Silian_allowCredentials) {
                $Silian_headersToSet['Access-Control-Allow-Credentials'] = 'true';
            }
        } else {
            // If no specific Origin header or not allowed:
            // only set wildcard when credentials are not required
            if (in_array('*', $Silian_allowedOrigins, true) && !$Silian_allowCredentials) {
                $Silian_headersToSet['Access-Control-Allow-Origin'] = '*';
            }
        }

        // Preflight should be handled BEFORE routing to avoid 405
        if ($Silian_method === 'OPTIONS') {
            $Silian_preflight = new \Slim\Psr7\Response(204);
            foreach ($Silian_headersToSet as $Silian_name => $Silian_value) {
                if ($Silian_value !== null && $Silian_value !== '') {
                    $Silian_preflight = $Silian_preflight->withHeader($Silian_name, $Silian_value);
                }
            }
            // Debug header to verify middleware is active
            $Silian_preflight = $Silian_preflight->withHeader('X-CORS-Middleware', 'active');
            $Silian_preflight = $Silian_preflight->withAddedHeader('Vary', implode(', ', array_unique($Silian_varyValues)));

            // If client asked for a specific method, reflect it for clarity
            $Silian_reqMethod = $Silian_request->getHeaderLine('Access-Control-Request-Method');
            if ($Silian_reqMethod) {
                $Silian_preflight = $Silian_preflight->withHeader('Access-Control-Allow-Methods', $Silian_reqMethod);
                $Silian_preflight = $Silian_preflight->withAddedHeader('Vary', 'Access-Control-Request-Method');
            }

            return $Silian_preflight;
        }

        // For non-OPTIONS, proceed to downstream and then append headers
    $Silian_response = $Silian_handler->handle($Silian_request);
        foreach ($Silian_headersToSet as $Silian_name => $Silian_value) {
            if ($Silian_value !== null && $Silian_value !== '') {
                $Silian_response = $Silian_response->withHeader($Silian_name, $Silian_value);
            }
        }
    $Silian_response = $Silian_response->withAddedHeader('Vary', implode(', ', array_unique($Silian_varyValues)));
    // Debug header as well for non-OPTIONS
    $Silian_response = $Silian_response->withHeader('X-CORS-Middleware', 'active');

        return $Silian_response;
    }
}

