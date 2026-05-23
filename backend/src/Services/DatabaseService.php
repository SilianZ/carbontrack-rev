<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use Illuminate\Database\Capsule\Manager as Capsule;
use PDO;

class DatabaseService
{
    private Capsule $capsule;

    public function __construct(Capsule $Silian_capsule)
    {
        $this->capsule = $Silian_capsule;
    }

    /**
     * Get the Eloquent Capsule instance
     */
    public function getCapsule(): Capsule
    {
        return $this->capsule;
    }

    /**
     * Get the database connection
     */
    public function getConnection(): \Illuminate\Database\Connection
    {
        return $this->capsule->getConnection();
    }

    /**
     * Get PDO instance
     */
    public function getPdo(): PDO
    {
        return $this->getConnection()->getPdo();
    }

    /**
     * Check if database connection is alive
     */
    public function isConnected(): bool
    {
        try {
            $this->capsule->getConnection()->getPdo()->query('SELECT 1');
            return true;
        } catch (\Exception $Silian_e) {
            return false;
        }
    }

    /**
     * Begin a database transaction
     */
    public function beginTransaction(): void
    {
        $this->capsule->getConnection()->beginTransaction();
    }

    /**
     * Commit a database transaction
     */
    public function commit(): void
    {
        $this->capsule->getConnection()->commit();
    }

    /**
     * Rollback a database transaction
     */
    public function rollback(): void
    {
        $this->capsule->getConnection()->rollback();
    }

    /**
     * Execute a raw SQL query
     */
    public function raw(string $Silian_sql, array $Silian_bindings = []): mixed
    {
        return $this->capsule->getConnection()->select($Silian_sql, $Silian_bindings);
    }

    /**
     * Get table prefix
     */
    public function getTablePrefix(): string
    {
        return $this->capsule->getConnection()->getTablePrefix();
    }

    /**
     * Get database name
     */
    public function getDatabaseName(): string
    {
        return $this->capsule->getConnection()->getDatabaseName();
    }
}

