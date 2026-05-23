<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\RequestIdNormalizer;
use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class ErrorLogService
{
    private const DATE_FMT = 'Y-m-d H:i:s';
    private PDO $db;
    private LoggerInterface $logger;

    public function __construct(PDO $Silian_db, LoggerInterface $Silian_logger)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
    }

    /**
     * Persist an exception and request context into error_logs table.
     */
    public function logException(\Throwable $Silian_e, Request $Silian_request, array $Silian_extra = []): ?int
    {
        if ($this->isWriteDisabled()) {
            return null;
        }

        return $this->insertLog([
            'error_type' => get_class($Silian_e),
            'error_message' => $Silian_e->getMessage(),
            'error_file' => $Silian_e->getFile(),
            'error_line' => $Silian_e->getLine(),
            'error_time' => date(self::DATE_FMT),
            'script_name' => $this->getScriptName($Silian_request),
            'client_get' => $this->safeJson($Silian_request->getQueryParams()),
            'client_post' => $this->safeJson($this->normalizeBody($Silian_request->getParsedBody())),
            'client_files' => $this->safeJson($this->normalizeFiles($Silian_request)),
            'client_cookie' => $this->safeJson($Silian_request->getCookieParams()),
            'client_session' => $this->safeJson($_SESSION ?? []),
            'client_server' => $this->safeJson($this->filterServer($Silian_request->getServerParams(), $Silian_extra)),
            'request_id' => $this->resolveRequestId($Silian_request, $Silian_extra),
        ]);
    }

    /**
     * Persist a non-exception error with a custom type/message and request context.
     */
    public function logError(string $Silian_type, string $Silian_message, Request $Silian_request, array $Silian_context = []): ?int
    {
        if ($this->isWriteDisabled()) {
            return null;
        }

        return $this->insertLog([
            'error_type' => $Silian_type,
            'error_message' => $Silian_message,
            'error_file' => $Silian_context['file'] ?? null,
            'error_line' => isset($Silian_context['line']) ? (int)$Silian_context['line'] : null,
            'error_time' => date(self::DATE_FMT),
            'script_name' => $this->getScriptName($Silian_request),
            'client_get' => $this->safeJson($Silian_request->getQueryParams()),
            'client_post' => $this->safeJson($this->normalizeBody($Silian_request->getParsedBody())),
            'client_files' => $this->safeJson($this->normalizeFiles($Silian_request)),
            'client_cookie' => $this->safeJson($Silian_request->getCookieParams()),
            'client_session' => $this->safeJson($_SESSION ?? []),
            'client_server' => $this->safeJson($this->filterServer($Silian_request->getServerParams(), $Silian_context)),
            'request_id' => $this->resolveRequestId($Silian_request, $Silian_context),
        ]);
    }

    private function insertLog(array $Silian_data): ?int
    {
        try {
            $Silian_sql = 'INSERT INTO error_logs (error_type, error_message, error_file, error_line, error_time, script_name, client_get, client_post, client_files, client_cookie, client_session, client_server, request_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute([
                $Silian_data['error_type'] ?? null,
                $Silian_data['error_message'] ?? null,
                $Silian_data['error_file'] ?? null,
                $Silian_data['error_line'] ?? null,
                $Silian_data['error_time'] ?? date(self::DATE_FMT),
                $Silian_data['script_name'] ?? null,
                $Silian_data['client_get'] ?? null,
                $Silian_data['client_post'] ?? null,
                $Silian_data['client_files'] ?? null,
                $Silian_data['client_cookie'] ?? null,
                $Silian_data['client_session'] ?? null,
                $Silian_data['client_server'] ?? null,
                $Silian_data['request_id'] ?? null,
            ]);
            $Silian_id = (int) $this->db->lastInsertId();
            return $Silian_id > 0 ? $Silian_id : null;
        } catch (\Throwable $Silian_ex) {
            // Fallback to application logger to avoid losing the error entirely
            try {
                $this->logger->error('Failed to persist error log', [
                    'message' => $Silian_ex->getMessage(),
                ]);
            } catch (\Throwable $Silian_ignored) {
                // swallow
            }
            return null;
        }
    }

    private function getScriptName(Request $Silian_request): string
    {
        $Silian_server = $Silian_request->getServerParams();
        return $Silian_server['SCRIPT_NAME'] ?? $Silian_server['PHP_SELF'] ?? (string)$Silian_request->getUri()->getPath();
    }

    private function resolveRequestId(Request $Silian_request, array $Silian_extra = []): ?string
    {
        $Silian_attribute = $Silian_request->getAttribute('request_id');
        if (is_string($Silian_attribute)) {
            $Silian_normalized = RequestIdNormalizer::normalize($Silian_attribute);
            if ($Silian_normalized !== null) {
                return $Silian_normalized;
            }
        }

        $Silian_header = RequestIdNormalizer::normalize($Silian_request->getHeaderLine('X-Request-ID'));
        if ($Silian_header !== null) {
            return $Silian_header;
        }

        $Silian_server = $Silian_request->getServerParams();
        $Silian_serverId = $Silian_server['HTTP_X_REQUEST_ID'] ?? $Silian_server['REQUEST_ID'] ?? $Silian_server['HTTP_REQUEST_ID'] ?? null;
        if (is_string($Silian_serverId)) {
            $Silian_normalized = RequestIdNormalizer::normalize($Silian_serverId);
            if ($Silian_normalized !== null) {
                return $Silian_normalized;
            }
        }

        if (!empty($Silian_extra['request_id']) && is_string($Silian_extra['request_id'])) {
            $Silian_normalized = RequestIdNormalizer::normalize($Silian_extra['request_id']);
            if ($Silian_normalized !== null) {
                return $Silian_normalized;
            }
        }

        $Silian_global = $_SERVER['HTTP_X_REQUEST_ID'] ?? $_SERVER['REQUEST_ID'] ?? $_SERVER['HTTP_REQUEST_ID'] ?? null;
        if (is_string($Silian_global)) {
            $Silian_normalized = RequestIdNormalizer::normalize($Silian_global);
            if ($Silian_normalized !== null) {
                return $Silian_normalized;
            }
        }

        return null;
    }

    private function safeJson($Silian_data): string
    {
        try {
            $Silian_json = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($Silian_json === false) {
                $Silian_json = '{}';
            }
            // ensure TEXT column size safety (approx)
            if (strlen($Silian_json) > 60000) {
                $Silian_json = substr($Silian_json, 0, 60000);
            }
            return $Silian_json;
        } catch (\Throwable $Silian_e) {
            return '{}';
        }
    }

    private function normalizeBody($Silian_body): array
    {
        if (is_array($Silian_body)) {
            return $Silian_body;
        }
        if (is_object($Silian_body)) {
            return (array) $Silian_body;
        }
        return $Silian_body ? ['_raw' => $Silian_body] : [];
    }

    private function normalizeFiles(Request $Silian_request): array
    {
        $Silian_files = $Silian_request->getUploadedFiles();
        $Silian_out = [];
        foreach ($Silian_files as $Silian_key => $Silian_file) {
            if (is_array($Silian_file)) {
                $Silian_out[$Silian_key] = array_map([$this, 'fileInfo'], $Silian_file);
            } else {
                $Silian_out[$Silian_key] = $this->fileInfo($Silian_file);
            }
        }
        return $Silian_out;
    }

    private function fileInfo($Silian_uploadedFile): array
    {
        if (!$Silian_uploadedFile) {
            return [];
        }
        // UploadedFileInterface methods
        try {
            return [
                'clientFilename' => method_exists($Silian_uploadedFile, 'getClientFilename') ? $Silian_uploadedFile->getClientFilename() : null,
                'size' => method_exists($Silian_uploadedFile, 'getSize') ? $Silian_uploadedFile->getSize() : null,
                'error' => method_exists($Silian_uploadedFile, 'getError') ? $Silian_uploadedFile->getError() : null,
            ];
        } catch (\Throwable $Silian_e) {
            return [];
        }
    }

    private function filterServer(array $Silian_server, array $Silian_extra = []): array
    {
        // Avoid logging sensitive data
        $Silian_hidden = ['PHP_AUTH_PW'];
        foreach ($Silian_hidden as $Silian_key) {
            if (isset($Silian_server[$Silian_key])) {
                $Silian_server[$Silian_key] = '***';
            }
        }
        // Add a few request-line highlights
        $Silian_server['_summary'] = [
            'method' => $Silian_server['REQUEST_METHOD'] ?? null,
            'uri' => $Silian_server['REQUEST_URI'] ?? null,
        ] + $Silian_extra;
        return $Silian_server;
    }

    private function isWriteDisabled(): bool
    {
        if ($this->isProductionEnvironment()) {
            return false;
        }

        $Silian_raw = $_ENV['DISABLE_ERROR_LOG_WRITES'] ?? $_SERVER['DISABLE_ERROR_LOG_WRITES'] ?? null;
        if (!is_string($Silian_raw) && !is_numeric($Silian_raw) && !is_bool($Silian_raw)) {
            return false;
        }

        return filter_var($Silian_raw, FILTER_VALIDATE_BOOLEAN) === true;
    }

    private function isProductionEnvironment(): bool
    {
        $Silian_env = strtolower(trim((string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? '')));
        return $Silian_env === 'production';
    }
}
