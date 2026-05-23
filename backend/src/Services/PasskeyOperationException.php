<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use RuntimeException;

class PasskeyOperationException extends RuntimeException
{
    public function __construct(
        string $Silian_message,
        private string $errorCode,
        private int $httpStatus = 400,
        ?\Throwable $Silian_previous = null
    ) {
        parent::__construct($Silian_message, 0, $Silian_previous);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getHttpStatus(): int
    {
        return $this->httpStatus;
    }
}
