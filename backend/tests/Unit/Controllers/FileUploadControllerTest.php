<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\FileUploadController;
use CarbonTrack\Services\FileMetadataService;
use CarbonTrack\Services\FileOwnershipConflictException;
use CarbonTrack\Services\MultipartUploadService;
use CarbonTrack\Models\File;
use CarbonTrack\Models\MultipartUpload;

class FileUploadControllerTest extends TestCase
{
    private const MIME_JPEG = 'image/jpeg';
    private const MIME_PNG = 'image/png';
    private const ROUTE_PRESIGN = '/files/presign';
    private const ROUTE_CONFIRM = '/files/confirm';
    private const ROUTE_MULTIPART_COMPLETE = '/files/multipart/complete';
    private const PRIVATE_ACTIVITY_PATH = 'activities/2026/03/proof.jpg';
    private const PRIVATE_UPLOAD_PATH = 'uploads/2026/03/doc.png';
    private const PRIVATE_UPLOAD_ENCODED_PATH = 'uploads%2F2026%2F03%2Fdoc.png';
    private const NEW_UPLOAD_PATH = 'uploads/new.jpg';
    private const OWNERLESS_UPLOAD_PATH = 'uploads/existing-ownerless.jpg';
    private const FOREIGN_DUPLICATE_PATH = 'uploads/foreign-owned.jpg';
    private const MULTIPART_FILE_PATH = 'uploads/2026/03/big.jpg';
    private const MULTIPART_EXISTING_FILE_PATH = 'uploads/2026/03/existing-big.jpg';
    private const MULTIPART_SHA256 = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    private const EXISTING_OK_PATH = 'uploads/ok.jpg';

    private function controller(?array $Silian_user, ?callable $Silian_cfg = null, ?FileMetadataService $Silian_fileMeta = null, ?MultipartUploadService $Silian_multipart = null): FileUploadController
    {
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        if ($Silian_cfg) { $Silian_cfg($Silian_r2); }
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn($Silian_user);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_logger = new \Monolog\Logger('test');
        $Silian_logger->pushHandler(new \Monolog\Handler\NullHandler());
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_fileMeta ??= $this->createMock(FileMetadataService::class);
        $Silian_multipart ??= $this->createMock(MultipartUploadService::class);
        return new FileUploadController($Silian_r2, $Silian_auth, $Silian_audit, $Silian_logger, $Silian_errorLog, $Silian_fileMeta, $Silian_multipart);
    }

    public function testUnauthorizedUpload(): void
    {
        $Silian_c = $this->controller(null);
        $Silian_resp = $Silian_c->uploadFile(makeRequest('POST','/files/upload'), new \Slim\Psr7\Response());
        $this->assertSame(401, $Silian_resp->getStatusCode());
    }

    public function testMissingFileUpload(): void
    {
        $Silian_c = $this->controller(['id'=>1]);
        $Silian_resp = $Silian_c->uploadFile(makeRequest('POST','/files/upload',[]), new \Slim\Psr7\Response());
        $this->assertSame(400, $Silian_resp->getStatusCode());
    }

    public function testMultipleMissingArray(): void
    {
        $Silian_c = $this->controller(['id'=>2]);
        $Silian_resp = $Silian_c->uploadMultipleFiles(makeRequest('POST','/files/upload-multiple',[]), new \Slim\Psr7\Response());
        $this->assertSame(400, $Silian_resp->getStatusCode());
    }

    public function testDeleteFileNotFound(): void
    {
        $Silian_c = $this->controller(['id'=>3], function($Silian_r2){ $Silian_r2->method('fileExists')->willReturn(false); });
        $Silian_resp = $Silian_c->deleteFile(makeRequest('DELETE','/files/delete'), new \Slim\Psr7\Response(), ['path'=>'not.png']);
        $this->assertSame(404, $Silian_resp->getStatusCode());
    }

    public function testGetInfoMissingPath(): void
    {
        $Silian_c = $this->controller(['id'=>4]);
        $Silian_resp = $Silian_c->getFileInfo(makeRequest('GET','/files/info'), new \Slim\Psr7\Response(), []);
        $this->assertSame(400, $Silian_resp->getStatusCode());
    }

    public function testGetPrivateInfoDeniedForNonOwner(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('isPubliclyReadablePath')->with(self::PRIVATE_ACTIVITY_PATH)->willReturn(false);
        $Silian_fileMeta->method('findByFilePath')->with(self::PRIVATE_ACTIVITY_PATH)->willReturn(null);

        $Silian_c = $this->controller(['id' => 4], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => self::PRIVATE_ACTIVITY_PATH,
                'metadata' => ['uploaded_by' => '7']
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->getFileInfo(makeRequest('GET', '/files/activities/info'), new \Slim\Psr7\Response(), ['path' => 'activities%2F2026%2F03%2Fproof.jpg']);
        $this->assertSame(403, $Silian_resp->getStatusCode());
    }

    public function testGetPublicInfoAllowedForAnyAuthenticatedUser(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('isPubliclyReadablePath')->with('products/2026/03/item.jpg')->willReturn(true);

        $Silian_c = $this->controller(['id' => 9], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => 'products/2026/03/item.jpg',
                'metadata' => []
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->getFileInfo(makeRequest('GET', '/files/products/info'), new \Slim\Psr7\Response(), ['path' => 'products%2F2026%2F03%2Fitem.jpg']);
        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testDeletePublicFileDeniedForNonOwner(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('findByFilePath')->with('avatars/animals/cat.png')->willReturn(null);

        $Silian_c = $this->controller(['id' => 2], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => 'avatars/animals/cat.png',
                'metadata' => ['uploaded_by' => '88']
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->deleteFile(makeRequest('DELETE', '/files/avatars/cat.png'), new \Slim\Psr7\Response(), ['path' => 'avatars%2Fanimals%2Fcat.png']);
        $this->assertSame(403, $Silian_resp->getStatusCode());
    }

    public function testPresignedUrlDeniedForPrivateFileNonOwner(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('isPubliclyReadablePath')->with(self::PRIVATE_UPLOAD_PATH)->willReturn(false);
        $Silian_fileMeta->method('findByFilePath')->with(self::PRIVATE_UPLOAD_PATH)->willReturn(null);

        $Silian_c = $this->controller(['id' => 3], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => self::PRIVATE_UPLOAD_PATH,
                'metadata' => ['uploaded_by' => '4']
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->generatePresignedUrl(makeRequest('GET', '/files/uploads/presigned-url'), new \Slim\Psr7\Response(), ['path' => self::PRIVATE_UPLOAD_ENCODED_PATH]);
        $this->assertSame(403, $Silian_resp->getStatusCode());
    }

    public function testPresignSuccess(): void
    {
        $Silian_c = $this->controller(['id'=>10], function($Silian_r2){
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5*1024*1024);
            $Silian_r2->method('generateDirectUploadKey')->willReturn([
                'file_name'=>'uuid.jpg','file_path'=>'uploads/x/uuid.jpg','public_url'=>'https://cdn/uuid.jpg'
            ]);
            $Silian_r2->expects($this->once())
                ->method('generateUploadPresignedUrl')
                ->with(
                    'uploads/x/uuid.jpg',
                    self::MIME_JPEG,
                    600,
                    $this->callback(function(array $Silian_metadata): bool {
                        return !array_key_exists('original_name', $Silian_metadata)
                            && ($Silian_metadata['uploaded_by'] ?? null) === '10'
                            && ($Silian_metadata['entity_type'] ?? null) === 'unknown'
                            && array_key_exists('upload_time', $Silian_metadata);
                    })
                )
                ->willReturn([
                    'url'=>'https://r2/presigned',
                    'method'=>'PUT',
                    'headers'=>[
                        'Content-Type'=>self::MIME_JPEG,
                        'x-amz-meta-uploaded_by'=>'10'
                    ],
                    'expires_in'=>600,
                    'expires_at'=>'2025-01-01 00:00:00'
                ]);
        });
        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN,[
            'original_name'=>'a.jpg','mime_type'=>self::MIME_JPEG,'file_size'=>123
        ]), new \Slim\Psr7\Response());
        $this->assertSame(200,$Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertSame('10', $Silian_payload['data']['headers']['x-amz-meta-uploaded_by']);
        $this->assertArrayNotHasKey('x-amz-meta-original_name', $Silian_payload['data']['headers']);
    }

    public function testPresignInvalidSha256(): void
    {
        $Silian_c = $this->controller(['id'=>11], function($Silian_r2){
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5*1024*1024);
        });
        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN,[
            'original_name'=>'a.jpg','mime_type'=>self::MIME_JPEG,'sha256'=>'BAD'
        ]), new \Slim\Psr7\Response());
        $this->assertSame(400,$Silian_resp->getStatusCode());
    }

    public function testPresignDuplicateShortCircuits(): void
    {
    $Silian_fileMeta = $this->createMock(FileMetadataService::class);
    $Silian_existing = new File();
    $Silian_existing->file_path = 'uploads/exist/abc.jpg';
    $Silian_existing->user_id = 20;
    $Silian_existing->reference_count = 3;
    $Silian_fileMeta->method('findBySha256')->willReturn($Silian_existing);

        $Silian_c = $this->controller(['id'=>20], function($Silian_r2){
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5*1024*1024);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN,[
            'original_name'=>'dup.jpg','mime_type'=>self::MIME_JPEG,'sha256'=>str_repeat('a',64)
        ]), new \Slim\Psr7\Response());
        $this->assertSame(200,$Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_payload['data']['duplicate']);
        $this->assertArrayNotHasKey('url',$Silian_payload['data']);
    }

    public function testPresignDuplicateOwnedByAnotherUserDoesNotShortCircuit(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_existing = new File();
        $Silian_existing->file_path = 'uploads/exist/abc.jpg';
        $Silian_existing->user_id = 99;
        $Silian_existing->reference_count = 3;
        $Silian_fileMeta->method('findBySha256')->willReturn($Silian_existing);

        $Silian_c = $this->controller(['id' => 20], function($Silian_r2) {
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5 * 1024 * 1024);
            $Silian_r2->method('generateDirectUploadKey')->willReturn([
                'file_name' => 'uuid.jpg',
                'file_path' => self::FOREIGN_DUPLICATE_PATH,
                'public_url' => 'https://cdn/foreign-owned.jpg'
            ]);
            $Silian_r2->expects($this->once())
                ->method('generateUploadPresignedUrl')
                ->willReturn([
                    'url' => 'https://r2/presigned',
                    'method' => 'PUT',
                    'headers' => ['Content-Type' => self::MIME_JPEG],
                    'expires_in' => 600,
                    'expires_at' => '2026-03-10 00:00:00'
                ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN, [
            'original_name' => 'dup.jpg',
            'mime_type' => self::MIME_JPEG,
            'sha256' => str_repeat('a', 64)
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_payload['data']['duplicate']);
        $this->assertSame(self::FOREIGN_DUPLICATE_PATH, $Silian_payload['data']['file_path']);
        $this->assertArrayHasKey('url', $Silian_payload['data']);
    }

    public function testPresignAllowsNestedAvatarDirectory(): void
    {
        $Silian_c = $this->controller(['id'=>21], function($Silian_r2){
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_PNG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['png']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5*1024*1024);
            $Silian_r2->expects($this->once())
                ->method('generateDirectUploadKey')
                ->with('face.png', 'avatars/custom-set')
                ->willReturn([
                    'file_name'=>'uuid.png',
                    'file_path'=>'avatars/custom-set/2024/12/uuid.png',
                    'public_url'=>'https://cdn/uuid.png'
                ]);
            $Silian_r2->expects($this->once())
                ->method('generateUploadPresignedUrl')
                ->with(
                    'avatars/custom-set/2024/12/uuid.png',
                    self::MIME_PNG,
                    600,
                    $this->callback(function(array $Silian_metadata): bool {
                        return !array_key_exists('original_name', $Silian_metadata)
                            && ($Silian_metadata['uploaded_by'] ?? null) === '21';
                    })
                )
                ->willReturn([
                    'url'=>'https://r2/presigned',
                    'method'=>'PUT',
                    'headers'=>['Content-Type'=>self::MIME_PNG],
                    'expires_in'=>600,
                    'expires_at'=>'2025-01-01 00:00:00'
                ]);
        });

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN,[
            'original_name'=>'face.png',
            'mime_type'=>self::MIME_PNG,
            'file_size'=>512,
            'directory'=>'avatars/custom-set'
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testPresignAllowsSupportTicketsDirectory(): void
    {
        $Silian_c = $this->controller(['id' => 24], function($Silian_r2) {
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5 * 1024 * 1024);
            $Silian_r2->expects($this->once())
                ->method('generateDirectUploadKey')
                ->with('ticket.jpg', 'support-tickets')
                ->willReturn([
                    'file_name' => 'uuid.jpg',
                    'file_path' => 'support-tickets/2026/04/uuid.jpg',
                    'public_url' => 'https://cdn/uuid.jpg'
                ]);
            $Silian_r2->expects($this->once())
                ->method('generateUploadPresignedUrl')
                ->willReturn([
                    'url' => 'https://r2/presigned',
                    'method' => 'PUT',
                    'headers' => ['Content-Type' => self::MIME_JPEG],
                    'expires_in' => 600,
                    'expires_at' => '2026-04-06 00:00:00'
                ]);
        });

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN, [
            'original_name' => 'ticket.jpg',
            'mime_type' => self::MIME_JPEG,
            'file_size' => 26570,
            'directory' => 'support-tickets',
            'entity_type' => 'support_ticket_message'
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testPresignUnicodeFileNameDoesNotLeakIntoSignedHeaders(): void
    {
        $Silian_c = $this->controller(['id' => 23], function($Silian_r2) {
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['jpg']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5 * 1024 * 1024);
            $Silian_r2->method('generateDirectUploadKey')->with('微信图片.jpg', 'uploads')->willReturn([
                'file_name' => 'uuid.jpg',
                'file_path' => 'uploads/2026/03/uuid.jpg',
                'public_url' => 'https://cdn/uuid.jpg'
            ]);
            $Silian_r2->expects($this->once())
                ->method('generateUploadPresignedUrl')
                ->with(
                    'uploads/2026/03/uuid.jpg',
                    self::MIME_JPEG,
                    600,
                    $this->callback(function(array $Silian_metadata): bool {
                        return !array_key_exists('original_name', $Silian_metadata)
                            && ($Silian_metadata['uploaded_by'] ?? null) === '23';
                    })
                )
                ->willReturn([
                    'url' => 'https://r2/presigned',
                    'method' => 'PUT',
                    'headers' => [
                        'Content-Type' => self::MIME_JPEG,
                        'x-amz-meta-uploaded_by' => '23'
                    ],
                    'expires_in' => 600,
                    'expires_at' => '2026-03-10 00:00:00'
                ]);
        });

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN, [
            'original_name' => '微信图片.jpg',
            'mime_type' => self::MIME_JPEG,
            'file_size' => 2048
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertArrayNotHasKey('x-amz-meta-original_name', $Silian_payload['data']['headers']);
    }

    public function testPresignRejectsInvalidDirectory(): void
    {
        $Silian_c = $this->controller(['id'=>22], function($Silian_r2){
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_PNG]);
            $Silian_r2->method('getAllowedExtensions')->willReturn(['png']);
            $Silian_r2->method('getMaxFileSize')->willReturn(5*1024*1024);
        });

        $Silian_resp = $Silian_c->getDirectUploadPresign(makeRequest('POST', self::ROUTE_PRESIGN,[
            'original_name'=>'bad.png',
            'mime_type'=>self::MIME_PNG,
            'file_size'=>256,
            'directory'=>'avatars/../../etc/passwd'
        ]), new \Slim\Psr7\Response());

        $this->assertSame(400, $Silian_resp->getStatusCode());
    }

    public function testConfirmCreatesRecord(): void
    {
    $Silian_fileMeta = $this->createMock(FileMetadataService::class);
    $Silian_fileMeta->method('findByFilePath')->with(self::NEW_UPLOAD_PATH)->willReturn(null);
    $Silian_fileMeta->method('findBySha256')->willReturn(null);
    $Silian_new = new File();
    $Silian_new->reference_count = 1;
    $Silian_fileMeta->method('createRecord')->willReturn($Silian_new);

        $Silian_c = $this->controller(['id'=>30], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path'=>self::NEW_UPLOAD_PATH,'size'=>10,'mime_type'=>'image/jpeg'
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>self::NEW_UPLOAD_PATH,'original_name'=>'new.jpg','sha256'=>str_repeat('b',64)
        ]), new \Slim\Psr7\Response());
        $this->assertSame(200,$Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertEquals(1,$Silian_payload['data']['reference_count']);
    }

    public function testConfirmDuplicateIncrements(): void
    {
    $Silian_existing = new File();
    $Silian_existing->file_path=self::EXISTING_OK_PATH;
    $Silian_existing->user_id = 31;
    $Silian_existing->reference_count=2;
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('findByFilePath')->with(self::EXISTING_OK_PATH)->willReturn(null);
        $Silian_fileMeta->method('findBySha256')->willReturn($Silian_existing);
        $Silian_fileMeta->method('incrementReference')->willReturnCallback(function($Silian_file) {
            $Silian_file->reference_count += 1;
            return $Silian_file;
        });

        $Silian_c = $this->controller(['id'=>31], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path'=>self::EXISTING_OK_PATH,'size'=>10,'mime_type'=>self::MIME_JPEG
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>self::EXISTING_OK_PATH,'original_name'=>'ok.jpg','sha256'=>str_repeat('c',64)
        ]), new \Slim\Psr7\Response());
        $this->assertSame(200,$Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_payload['data']['duplicate']);
        $this->assertEquals(3,$Silian_payload['data']['reference_count']);
    }

    public function testConfirmCrossOwnerSha256CreatesIndependentRecordWithoutPersistingHash(): void
    {
        $Silian_existing = new File();
        $Silian_existing->file_path = self::EXISTING_OK_PATH;
        $Silian_existing->user_id = 99;
        $Silian_existing->reference_count = 2;

        $Silian_created = new File();
        $Silian_created->reference_count = 1;
        $Silian_created->sha256 = hash('sha256', json_encode([
            'file_path' => self::FOREIGN_DUPLICATE_PATH,
            'etag' => '',
            'size' => 10,
            'mime_type' => self::MIME_JPEG,
            'original_name' => 'foreign-owned.jpg',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::FOREIGN_DUPLICATE_PATH)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('findBySha256')
            ->with(str_repeat('e', 64))
            ->willReturn($Silian_existing);
        $Silian_fileMeta->expects($this->once())
            ->method('createRecord')
            ->with($this->callback(function(array $Silian_data): bool {
                return ($Silian_data['file_path'] ?? null) === self::FOREIGN_DUPLICATE_PATH
                    && ($Silian_data['user_id'] ?? null) === 32
                    && is_string($Silian_data['sha256'] ?? null)
                    && preg_match('/^[a-f0-9]{64}$/', $Silian_data['sha256']) === 1
                    && ($Silian_data['sha256'] ?? null) !== str_repeat('e', 64);
            }))
            ->willReturn($Silian_created);

        $Silian_c = $this->controller(['id' => 32], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => self::FOREIGN_DUPLICATE_PATH,
                'size' => 10,
                'mime_type' => self::MIME_JPEG,
                'metadata' => [
                    'sha256' => str_repeat('e', 64),
                ],
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM, [
            'file_path' => self::FOREIGN_DUPLICATE_PATH,
            'original_name' => 'foreign-owned.jpg',
            'sha256' => str_repeat('e', 64)
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_payload['data']['duplicate']);
        $this->assertSame($Silian_created->sha256, $Silian_payload['data']['sha256']);
        $this->assertSame(1, $Silian_payload['data']['reference_count']);
    }

    public function testConfirmNotFound(): void
    {
        $Silian_c = $this->controller(['id'=>12], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn(null);
        });
        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>'uploads/none.jpg','original_name'=>'none.jpg'
        ]), new \Slim\Psr7\Response());
        $this->assertSame(404,$Silian_resp->getStatusCode());
    }

    public function testConfirmSuccess(): void
    {
        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::EXISTING_OK_PATH)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('createRecord')
            ->with($this->callback(function(array $Silian_data): bool {
                return ($Silian_data['file_path'] ?? null) === self::EXISTING_OK_PATH
                    && ($Silian_data['user_id'] ?? null) === 13
                    && ($Silian_data['original_name'] ?? null) === 'ok.jpg'
                    && is_string($Silian_data['sha256'] ?? null)
                    && preg_match('/^[a-f0-9]{64}$/', $Silian_data['sha256']) === 1;
            }))
            ->willReturn((function() {
                $Silian_file = new File();
                $Silian_file->reference_count = 1;
                $Silian_file->sha256 = str_repeat('f', 64);
                return $Silian_file;
            })());

        $Silian_c = $this->controller(['id'=>13], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path'=>self::EXISTING_OK_PATH,'size'=>1,'mime_type'=>self::MIME_JPEG
            ]);
            // logDirectUploadAudit is void; no return value expectation needed
        }, $Silian_fileMeta);
        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>self::EXISTING_OK_PATH,'original_name'=>'ok.jpg'
        ]), new \Slim\Psr7\Response());
        $this->assertSame(200,$Silian_resp->getStatusCode());
    }

    public function testConfirmWithoutSha256BackfillsExistingOwnerlessRecord(): void
    {
        $Silian_existing = $this->getMockBuilder(File::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['save'])
            ->getMock();
        $Silian_existing->file_path = self::OWNERLESS_UPLOAD_PATH;
        $Silian_existing->user_id = null;
        $Silian_existing->mime_type = null;
        $Silian_existing->size = 0;
        $Silian_existing->original_name = null;
        $Silian_existing->reference_count = 0;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::OWNERLESS_UPLOAD_PATH)
            ->willReturn($Silian_existing);

        $Silian_existing->expects($this->once())
            ->method('save');

        $Silian_c = $this->controller(['id'=>14], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path'=>self::OWNERLESS_UPLOAD_PATH,
                'size'=>2048,
                'mime_type'=>self::MIME_JPEG,
                'metadata'=>[]
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>self::OWNERLESS_UPLOAD_PATH,'original_name'=>'ownerless.jpg'
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200,$Silian_resp->getStatusCode());
        $this->assertSame(14, $Silian_existing->user_id);
        $this->assertSame('ownerless.jpg', $Silian_existing->original_name);
        $this->assertSame(self::MIME_JPEG, $Silian_existing->mime_type);
        $this->assertSame(2048, $Silian_existing->size);
        $this->assertSame(1, $Silian_existing->reference_count);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', (string) $Silian_existing->sha256);
    }

    public function testConfirmReturnsConflictWhenExistingFileBelongsToAnotherUser(): void
    {
        $Silian_existing = $this->getMockBuilder(File::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['save'])
            ->getMock();
        $Silian_existing->file_path = self::OWNERLESS_UPLOAD_PATH;
        $Silian_existing->user_id = 99;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::OWNERLESS_UPLOAD_PATH)
            ->willReturn($Silian_existing);

        $Silian_existing->expects($this->never())->method('save');

        $Silian_c = $this->controller(['id'=>14], function($Silian_r2){
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path'=>self::OWNERLESS_UPLOAD_PATH,
                'size'=>2048,
                'mime_type'=>self::MIME_JPEG,
                'metadata'=>[]
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->confirmDirectUpload(makeRequest('POST', self::ROUTE_CONFIRM,[
            'file_path'=>self::OWNERLESS_UPLOAD_PATH,'original_name'=>'ownerless.jpg'
        ]), new \Slim\Psr7\Response());

        $this->assertSame(409,$Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertSame('FILE_OWNERSHIP_CONFLICT', $Silian_payload['code']);
    }

    public function testInitMultipartRegistersUploadOwnership(): void
    {
        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->expects($this->once())
            ->method('registerUpload')
            ->with('up-1', self::MULTIPART_FILE_PATH, 42, self::MULTIPART_SHA256);

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('getAllowedMimeTypes')->willReturn([self::MIME_JPEG]);
            $Silian_r2->method('initMultipartUpload')->willReturn([
                'upload_id' => 'up-1',
                'file_path' => self::MULTIPART_FILE_PATH,
                'public_url' => 'https://cdn/big.jpg'
            ]);
        }, null, $Silian_multipart);

        $Silian_resp = $Silian_c->initMultipartUpload(makeRequest('POST', '/files/multipart/init', [
            'original_name' => 'big.jpg',
            'directory' => 'uploads',
            'mime_type' => self::MIME_JPEG,
            'sha256' => self::MULTIPART_SHA256
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testMultipartPartDeniedForDifferentOwner(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-2';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->user_id = 77;

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-2')->willReturn($Silian_upload);

        $Silian_c = $this->controller(['id' => 42], null, null, $Silian_multipart);
        $Silian_resp = $Silian_c->getMultipartPartUrl(makeRequest('GET', '/files/multipart/part', null, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-2',
            'part_number' => 1
        ]), new \Slim\Psr7\Response());

        $this->assertSame(403, $Silian_resp->getStatusCode());
    }

    public function testCompleteMultipartClearsOwnershipTracking(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-3';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->sha256 = self::MULTIPART_SHA256;
        $Silian_upload->user_id = 42;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::MULTIPART_FILE_PATH)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('findBySha256')
            ->with(self::MULTIPART_SHA256)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('createRecord')
            ->with($this->callback(function(array $Silian_data): bool {
                return ($Silian_data['file_path'] ?? null) === self::MULTIPART_FILE_PATH
                    && ($Silian_data['sha256'] ?? null) === self::MULTIPART_SHA256
                    && ($Silian_data['user_id'] ?? null) === 42
                    && ($Silian_data['mime_type'] ?? null) === self::MIME_JPEG
                    && ($Silian_data['size'] ?? null) === 98765
                    && ($Silian_data['reference_count'] ?? null) === 1;
            }))
            ->willReturn(new File());

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-3')->willReturn($Silian_upload);
        $Silian_multipart->expects($this->once())->method('clearUpload')->with('up-3');

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('completeMultipartUpload')->willReturn([
                'success' => true,
                'file_path' => self::MULTIPART_FILE_PATH
            ]);
            $Silian_r2->method('getFileInfo')->with(self::MULTIPART_FILE_PATH)->willReturn([
                'file_path' => self::MULTIPART_FILE_PATH,
                'size' => 98765,
                'mime_type' => self::MIME_JPEG,
                'metadata' => ['original_name' => 'big.jpg']
            ]);
        }, $Silian_fileMeta, $Silian_multipart);

        $Silian_resp = $Silian_c->completeMultipartUpload(makeRequest('POST', self::ROUTE_MULTIPART_COMPLETE, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-3',
            'sha256' => self::MULTIPART_SHA256,
            'parts' => [['part_number' => 1, 'etag' => 'etag-1']]
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testCompleteMultipartCrossOwnerSha256CreatesRecordWithoutPersistingHash(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-7';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->sha256 = self::MULTIPART_SHA256;
        $Silian_upload->user_id = 42;

        $Silian_existing = new File();
        $Silian_existing->file_path = self::MULTIPART_EXISTING_FILE_PATH;
        $Silian_existing->user_id = 77;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::MULTIPART_FILE_PATH)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('findBySha256')
            ->with(self::MULTIPART_SHA256)
            ->willReturn($Silian_existing);
        $Silian_fileMeta->expects($this->once())
            ->method('createRecord')
            ->with($this->callback(function(array $Silian_data): bool {
                return ($Silian_data['file_path'] ?? null) === self::MULTIPART_FILE_PATH
                    && ($Silian_data['user_id'] ?? null) === 42
                    && is_string($Silian_data['sha256'] ?? null)
                    && preg_match('/^[a-f0-9]{64}$/', $Silian_data['sha256']) === 1
                    && ($Silian_data['sha256'] ?? null) !== self::MULTIPART_SHA256;
            }))
            ->willReturn(new File());

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-7')->willReturn($Silian_upload);
        $Silian_multipart->expects($this->once())->method('clearUpload')->with('up-7');

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('completeMultipartUpload')->willReturn([
                'success' => true,
                'file_path' => self::MULTIPART_FILE_PATH
            ]);
            $Silian_r2->method('getFileInfo')->with(self::MULTIPART_FILE_PATH)->willReturn([
                'file_path' => self::MULTIPART_FILE_PATH,
                'size' => 98765,
                'mime_type' => self::MIME_JPEG,
                'metadata' => [
                    'original_name' => 'big.jpg',
                    'sha256' => self::MULTIPART_SHA256,
                ]
            ]);
        }, $Silian_fileMeta, $Silian_multipart);

        $Silian_resp = $Silian_c->completeMultipartUpload(makeRequest('POST', self::ROUTE_MULTIPART_COMPLETE, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-7',
            'parts' => [['part_number' => 1, 'etag' => 'etag-1']]
        ]), new \Slim\Psr7\Response());

        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testCompleteMultipartRejectsMissingSha256ForNewFileRecord(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-4';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->sha256 = null;
        $Silian_upload->user_id = 42;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::MULTIPART_FILE_PATH)
            ->willReturn(null);

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-4')->willReturn($Silian_upload);

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->expects($this->never())->method('completeMultipartUpload');
        }, $Silian_fileMeta, $Silian_multipart);

        $Silian_resp = $Silian_c->completeMultipartUpload(makeRequest('POST', self::ROUTE_MULTIPART_COMPLETE, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-4',
            'parts' => [['part_number' => 1, 'etag' => 'etag-1']]
        ]), new \Slim\Psr7\Response());

        $this->assertSame(400, $Silian_resp->getStatusCode());
    }

    public function testCompleteMultipartReturnsConflictAndClearsTrackingWhenFileBelongsToAnotherUser(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-5';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->sha256 = self::MULTIPART_SHA256;
        $Silian_upload->user_id = 42;

        $Silian_existing = $this->getMockBuilder(File::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['save'])
            ->getMock();
        $Silian_existing->file_path = self::MULTIPART_FILE_PATH;
        $Silian_existing->user_id = 77;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::MULTIPART_FILE_PATH)
            ->willReturn($Silian_existing);

        $Silian_existing->expects($this->never())->method('save');

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-5')->willReturn($Silian_upload);
        $Silian_multipart->expects($this->once())->method('clearUpload')->with('up-5');

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('completeMultipartUpload')->willReturn([
                'success' => true,
                'file_path' => self::MULTIPART_FILE_PATH
            ]);
            $Silian_r2->method('getFileInfo')->with(self::MULTIPART_FILE_PATH)->willReturn([
                'file_path' => self::MULTIPART_FILE_PATH,
                'size' => 98765,
                'mime_type' => self::MIME_JPEG,
                'metadata' => ['original_name' => 'big.jpg']
            ]);
        }, $Silian_fileMeta, $Silian_multipart);

        $Silian_resp = $Silian_c->completeMultipartUpload(makeRequest('POST', self::ROUTE_MULTIPART_COMPLETE, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-5',
            'parts' => [['part_number' => 1, 'etag' => 'etag-1']]
        ]), new \Slim\Psr7\Response());

        $this->assertSame(409, $Silian_resp->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertSame('FILE_OWNERSHIP_CONFLICT', $Silian_payload['code']);
    }

    public function testCompleteMultipartClearsTrackingWhenOwnershipPersistenceFails(): void
    {
        $Silian_upload = new MultipartUpload();
        $Silian_upload->upload_id = 'up-6';
        $Silian_upload->file_path = self::MULTIPART_FILE_PATH;
        $Silian_upload->sha256 = self::MULTIPART_SHA256;
        $Silian_upload->user_id = 42;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->expects($this->once())
            ->method('findByFilePath')
            ->with(self::MULTIPART_FILE_PATH)
            ->willReturn(null);
        $Silian_fileMeta->expects($this->once())
            ->method('createRecord')
            ->willThrowException(new \RuntimeException('db down'));

        $Silian_multipart = $this->createMock(MultipartUploadService::class);
        $Silian_multipart->method('findActiveUpload')->with('up-6')->willReturn($Silian_upload);
        $Silian_multipart->expects($this->once())->method('clearUpload')->with('up-6');

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('completeMultipartUpload')->willReturn([
                'success' => true,
                'file_path' => self::MULTIPART_FILE_PATH
            ]);
            $Silian_r2->method('getFileInfo')->with(self::MULTIPART_FILE_PATH)->willReturn([
                'file_path' => self::MULTIPART_FILE_PATH,
                'size' => 98765,
                'mime_type' => self::MIME_JPEG,
                'metadata' => ['original_name' => 'big.jpg']
            ]);
        }, $Silian_fileMeta, $Silian_multipart);

        $Silian_resp = $Silian_c->completeMultipartUpload(makeRequest('POST', self::ROUTE_MULTIPART_COMPLETE, [
            'file_path' => self::MULTIPART_FILE_PATH,
            'upload_id' => 'up-6',
            'parts' => [['part_number' => 1, 'etag' => 'etag-1']]
        ]), new \Slim\Psr7\Response());

        $this->assertSame(500, $Silian_resp->getStatusCode());
    }

    public function testGetPrivateInfoAllowedForPersistedOwnerRecord(): void
    {
        $Silian_ownedFile = new File();
        $Silian_ownedFile->file_path = self::PRIVATE_UPLOAD_PATH;
        $Silian_ownedFile->user_id = 42;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('isPubliclyReadablePath')->with(self::PRIVATE_UPLOAD_PATH)->willReturn(false);
        $Silian_fileMeta->method('findByFilePath')->with(self::PRIVATE_UPLOAD_PATH)->willReturn($Silian_ownedFile);

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => self::PRIVATE_UPLOAD_PATH,
                'metadata' => []
            ]);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->getFileInfo(makeRequest('GET', '/files/uploads/info'), new \Slim\Psr7\Response(), ['path' => self::PRIVATE_UPLOAD_ENCODED_PATH]);
        $this->assertSame(200, $Silian_resp->getStatusCode());
    }

    public function testDeletePrivateFileAllowedForPersistedOwnerRecord(): void
    {
        $Silian_ownedFile = new File();
        $Silian_ownedFile->file_path = self::PRIVATE_UPLOAD_PATH;
        $Silian_ownedFile->user_id = 42;

        $Silian_fileMeta = $this->createMock(FileMetadataService::class);
        $Silian_fileMeta->method('findByFilePath')->with(self::PRIVATE_UPLOAD_PATH)->willReturn($Silian_ownedFile);

        $Silian_c = $this->controller(['id' => 42], function($Silian_r2) {
            $Silian_r2->method('getFileInfo')->willReturn([
                'file_path' => self::PRIVATE_UPLOAD_PATH,
                'metadata' => []
            ]);
            $Silian_r2->method('deleteFile')->with(self::PRIVATE_UPLOAD_PATH, 42)->willReturn(true);
        }, $Silian_fileMeta);

        $Silian_resp = $Silian_c->deleteFile(makeRequest('DELETE', '/files/uploads/delete'), new \Slim\Psr7\Response(), ['path' => self::PRIVATE_UPLOAD_ENCODED_PATH]);
        $this->assertSame(200, $Silian_resp->getStatusCode());
    }
}

