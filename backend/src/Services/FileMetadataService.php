<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\File;
use Illuminate\Database\Capsule\Manager as DB;
class FileMetadataService
{
    private const PUBLIC_READABLE_ROOTS = ['products', 'badges', 'avatars'];

    public function findBySha256(string $Silian_sha256): ?File
    {
        return File::where('sha256',$Silian_sha256)->orderByDesc('id')->first();
    }

    public function findByFilePath(string $Silian_filePath): ?File
    {
        return File::where('file_path', $Silian_filePath)->orderByDesc('id')->first();
    }

    public function isPubliclyReadablePath(string $Silian_filePath): bool
    {
        return in_array($this->extractRootDirectory($Silian_filePath), self::PUBLIC_READABLE_ROOTS, true);
    }

    public function extractRootDirectory(string $Silian_filePath): string
    {
        $Silian_normalized = ltrim(trim($Silian_filePath), '/');
        if ($Silian_normalized === '') {
            return '';
        }

        $Silian_segments = explode('/', $Silian_normalized);
        return strtolower($Silian_segments[0] ?? '');
    }

    public function createRecord(array $Silian_data): File
    {
        return File::create($Silian_data);
    }

    public function incrementReference(File $Silian_file): File
    {
        $Silian_file->reference_count += 1;
        $Silian_file->save();
        return $Silian_file;
    }

    /**
     * Create new or increment reference if duplicate sha256 exists.
     * Returns [file: File, duplicated: bool]
     */
    public function createOrIncrement(array $Silian_data): array
    {
        $Silian_sha256 = $Silian_data['sha256'] ?? null;
        if (!$Silian_sha256) {
            return ['file' => $this->createRecord($Silian_data), 'duplicated' => false];
        }
        return DB::connection()->transaction(function() use ($Silian_sha256,$Silian_data){
            $Silian_existing = File::where('sha256',$Silian_sha256)->lockForUpdate()->first();
            if ($Silian_existing) {
                $Silian_existing->reference_count += 1;
                $Silian_existing->save();
                return ['file'=>$Silian_existing,'duplicated'=>true];
            }
            $Silian_new = File::create($Silian_data);
            return ['file'=>$Silian_new,'duplicated'=>false];
        });
    }
}
