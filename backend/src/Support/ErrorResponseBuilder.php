<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

use Psr\Http\Message\ServerRequestInterface;
use Throwable;

class ErrorResponseBuilder
{
    public static function build(
        Throwable $Silian_exception,
        ServerRequestInterface $Silian_request,
        string $Silian_environment,
        int $Silian_status = 500
    ): array {
        $Silian_env = strtolower($Silian_environment);
        $Silian_isProduction = $Silian_env === 'production';

        $Silian_payload = [
            'success' => false,
            'code' => self::resolveErrorCode($Silian_exception, $Silian_status),
            'request_id' => self::extractRequestId($Silian_request),
        ];

        if (!$Silian_isProduction) {
            $Silian_payload['message'] = $Silian_exception->getMessage();
            $Silian_payload['error'] = get_class($Silian_exception);
        }

        return $Silian_payload;
    }

    private static function resolveErrorCode(Throwable $Silian_exception, int $Silian_status): string
    {
        $Silian_code = $Silian_exception->getCode();

        if (is_string($Silian_code) && $Silian_code !== '') {
            return $Silian_code;
        }

        if (is_int($Silian_code) && $Silian_code > 0) {
            return (string) $Silian_code;
        }

        return $Silian_status >= 500 ? 'SERVER_ERROR' : (string) $Silian_status;
    }

    private static function extractRequestId(ServerRequestInterface $Silian_request): ?string
    {
        $Silian_attribute = $Silian_request->getAttribute('request_id');
        if (is_string($Silian_attribute)) {
            $Silian_normalized = RequestIdNormalizer::normalize($Silian_attribute);
            if ($Silian_normalized !== null) {
                return $Silian_normalized;
            }
        }

        $Silian_headerRequestId = RequestIdNormalizer::normalize($Silian_request->getHeaderLine('X-Request-ID'));
        if ($Silian_headerRequestId !== null) {
            return $Silian_headerRequestId;
        }

        $Silian_serverParams = $Silian_request->getServerParams();
        $Silian_candidateKeys = ['HTTP_X_REQUEST_ID', 'REQUEST_ID'];

        foreach ($Silian_candidateKeys as $Silian_key) {
            if (!empty($Silian_serverParams[$Silian_key])) {
                $Silian_normalized = RequestIdNormalizer::normalize($Silian_serverParams[$Silian_key]);
                if ($Silian_normalized !== null) {
                    return $Silian_normalized;
                }
            }
        }

        return null;
    }
}
