<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\AvatarController;

class AvatarControllerTest extends TestCase
{
    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(AvatarController::class));
    }

    public function testGetAvatarsHidesInactiveForNonAdmin(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'is_admin'=>0]);
        $Silian_avatarModel->method('getAvailableAvatars')->willReturn([
            ['id'=>1,'name'=>'A','is_active'=>1]
        ]);

    $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
    /** @var \CarbonTrack\Models\Avatar $avatarModel */
    /** @var \CarbonTrack\Services\AuthService $auth */
    /** @var \CarbonTrack\Services\AuditLogService $audit */
    /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
    /** @var \Monolog\Logger $logger */
    /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
    $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);
        $Silian_request = makeRequest('GET', '/avatars');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getAvatars($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertCount(1, $Silian_json['data']);
        $this->assertEquals(1, $Silian_json['data'][0]['id']);
    }

    public function testGetAvatarsAllowsAdminToIncludeInactiveAndReturnsActivationState(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->once())
            ->method('getAvailableAvatars')
            ->with('animals', true)
            ->willReturn([
                ['id' => 1, 'name' => 'Cat', 'category' => 'animals', 'is_active' => '1', 'is_default' => '0'],
                ['id' => 2, 'name' => 'Fox', 'category' => 'animals', 'is_active' => '0', 'is_default' => '1'],
            ]);

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->getAvatars(
            makeRequest('GET', '/admin/avatars', null, ['category' => 'animals', 'include_inactive' => '1']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertCount(2, $Silian_payload['data']);
        $this->assertTrue($Silian_payload['data'][0]['is_active']);
        $this->assertFalse($Silian_payload['data'][1]['is_active']);
        $this->assertTrue($Silian_payload['data'][1]['is_default']);
    }

    public function testGetAvatarsIncludesIconUrls(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(null);
        $Silian_avatarModel->method('getAvailableAvatars')->willReturn([
            [
                'id' => 10,
                'name' => 'Default Avatar',
                'file_path' => '/avatars/default/avatar.png',
                'thumbnail_path' => 'avatars/default/avatar-thumb.png',
                'is_active' => 1,
            ],
        ]);

        $Silian_r2->expects($this->exactly(2))
            ->method('getPublicUrl')
            ->withConsecutive(
                ['avatars/default/avatar.png'],
                ['avatars/default/avatar-thumb.png']
            )
            ->willReturnOnConsecutiveCalls(
                'https://cdn.example/avatar.png',
                'https://cdn.example/avatar-thumb.png'
            );

        $Silian_r2->expects($this->once())
            ->method('generatePresignedUrl')
            ->with('avatars/default/avatar.png', 600)
            ->willReturn('https://signed.example/avatar.png');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->getAvatars(makeRequest('GET', '/avatars'), new \Slim\Psr7\Response());
        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertNotEmpty($Silian_payload['data']);
        $Silian_avatar = $Silian_payload['data'][0];
        $this->assertSame('avatars/default/avatar.png', $Silian_avatar['icon_path']);
        $this->assertSame('https://cdn.example/avatar.png', $Silian_avatar['icon_url']);
        $this->assertSame('https://signed.example/avatar.png', $Silian_avatar['icon_presigned_url']);
        $this->assertSame('https://cdn.example/avatar.png', $Silian_avatar['image_url']);
        $this->assertSame('https://cdn.example/avatar.png', $Silian_avatar['url']);
        $this->assertSame('https://cdn.example/avatar-thumb.png', $Silian_avatar['thumbnail_url']);
    }

    public function testGetAvatarRequiresAdmin(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'is_admin'=>0]);
    $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
    /** @var \CarbonTrack\Models\Avatar $avatarModel */
    /** @var \CarbonTrack\Services\AuthService $auth */
    /** @var \CarbonTrack\Services\AuditLogService $audit */
    /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
    /** @var \Monolog\Logger $logger */
    /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
    $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);
        $Silian_request = makeRequest('GET', '/avatars/1');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getAvatar($Silian_request, $Silian_response, ['id'=>1]);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testUpdateAvatarNormalizesEmptyStringDefaultFlag(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_existingAvatar = [
            'id' => 5,
            'name' => 'Original Avatar',
            'file_path' => '/avatars/original.png',
            'is_default' => 1,
        ];
        $Silian_updatedAvatar = [
            'id' => 5,
            'name' => 'Original Avatar',
            'file_path' => '/avatars/original.png',
            'is_default' => 0,
        ];

        $Silian_avatarModel->expects($this->exactly(2))
            ->method('getAvatarById')
            ->with(5)
            ->willReturnOnConsecutiveCalls($Silian_existingAvatar, $Silian_updatedAvatar);
        $Silian_avatarModel->expects($this->never())->method('setDefaultAvatar');
        $Silian_avatarModel->expects($this->once())
            ->method('updateAvatar')
            ->with(5, $this->callback(function (array $Silian_data): bool {
                $this->assertArrayHasKey('is_default', $Silian_data);
                $this->assertFalse($Silian_data['is_default']);
                return true;
            }))
            ->willReturn(true);

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_request = makeRequest('PUT', '/admin/avatars/5', [
            'is_default' => '',
        ]);
        $Silian_response = $Silian_controller->updateAvatar($Silian_request, new \Slim\Psr7\Response(), ['id' => 5]);

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertFalse($Silian_payload['data']['is_default']);
    }

    public function testUpdateAvatarRejectsInvalidSortOrderString(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['sort_order' => 'abc']),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
    }

    public function testUpdateAvatarReturnsStorageUnavailableWhenR2PathCannotBeVerified(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->once())
            ->method('getAvatarById')
            ->with(5)
            ->willReturn([
                'id' => 5,
                'name' => 'Leaf',
                'file_path' => '/avatars/default/old.png',
                'is_default' => 0,
                'is_active' => 1,
            ]);
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');
        $Silian_logger->expects($this->once())
            ->method('error')
            ->with('Avatar storage service is unavailable');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, null, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['file_path' => '/avatars/default/new.png']),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('AVATAR_STORAGE_UNAVAILABLE', $Silian_payload['code']);
    }

    public function testCreateAvatarRejectsNonObjectRequestBody(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->never())->method('createAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->createAvatar(
            makeRequest('POST', '/admin/avatars', null),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('INVALID_REQUEST_BODY', $Silian_payload['code']);
    }

    public function testCreateAvatarReturnsStorageUnavailableWhenR2PathCannotBeVerified(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->never())->method('createAvatar');
        $Silian_logger->expects($this->once())
            ->method('error')
            ->with('Avatar storage service is unavailable');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, null, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->createAvatar(
            makeRequest('POST', '/admin/avatars', [
                'name' => 'Leaf',
                'file_path' => '/avatars/default/leaf.png',
            ]),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('AVATAR_STORAGE_UNAVAILABLE', $Silian_payload['code']);
    }

    public function testCreateAvatarRejectsInactiveDefaultAvatar(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->never())->method('createAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->createAvatar(
            makeRequest('POST', '/admin/avatars', [
                'name' => 'Broken Default',
                'file_path' => '/avatars/broken.png',
                'is_default' => true,
                'is_active' => false,
            ]),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Default avatar must remain active', $Silian_payload['message']);
    }

    public function testUpdateAvatarRejectsDisablingDefaultAvatar(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->once())
            ->method('getAvatarById')
            ->with(5)
            ->willReturn([
                'id' => 5,
                'name' => 'Default Avatar',
                'file_path' => '/avatars/default.png',
                'is_default' => 1,
                'is_active' => 1,
            ]);
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['is_active' => false]),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Default avatar must remain active', $Silian_payload['message']);
    }

    public function testUpdateAvatarRejectsDisablingCurrentDefaultEvenWhenPayloadClearsDefault(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->once())
            ->method('getAvatarById')
            ->with(5)
            ->willReturn([
                'id' => 5,
                'name' => 'Default Avatar',
                'file_path' => '/avatars/default.png',
                'is_default' => 1,
                'is_active' => 1,
            ]);
        $Silian_avatarModel->expects($this->never())->method('getDefaultAvatar');
        $Silian_avatarModel->expects($this->never())->method('updateAvatarAndReassignUsers');
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['is_default' => false, 'is_active' => false]),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Default avatar must remain active', $Silian_payload['message']);
    }

    public function testUpdateAvatarSucceedsWhenOptionalAuditAndLoggerAreMissing(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->exactly(2))
            ->method('getAvatarById')
            ->with(5)
            ->willReturnOnConsecutiveCalls(
                [
                    'id' => 5,
                    'name' => 'Leaf',
                    'file_path' => '/avatars/leaf.png',
                    'is_default' => 0,
                    'is_active' => 1,
                ],
                [
                    'id' => 5,
                    'name' => 'Leaf Prime',
                    'file_path' => '/avatars/leaf.png',
                    'is_default' => 0,
                    'is_active' => 1,
                ]
            );
        $Silian_avatarModel->expects($this->once())
            ->method('updateAvatar')
            ->with(5, ['name' => 'Leaf Prime'])
            ->willReturn(true);

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['name' => 'Leaf Prime']),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('Leaf Prime', $Silian_payload['data']['name']);
    }

    public function testUpdateAvatarDisablesAvatarReassignsUsersAndSendsNotifications(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7, 'is_admin' => 1]);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_avatarModel->expects($this->exactly(2))
            ->method('getAvatarById')
            ->with(5)
            ->willReturnOnConsecutiveCalls(
                [
                    'id' => 5,
                    'name' => 'Seasonal Fox',
                    'file_path' => '/avatars/fox.png',
                    'is_default' => 0,
                    'is_active' => 1,
                ],
                [
                    'id' => 5,
                    'name' => 'Seasonal Fox',
                    'file_path' => '/avatars/fox.png',
                    'is_default' => 0,
                    'is_active' => 0,
                ]
            );
        $Silian_avatarModel->expects($this->once())
            ->method('updateAvatarAndReassignUsers')
            ->with(5, ['is_active' => false], null)
            ->willReturn([
                'reassigned_user_count' => 2,
                'users' => [
                    ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
                    ['id' => 202, 'username' => 'bob', 'email' => 'bob@example.com'],
                ],
                'fallback_avatar' => [
                    'id' => 1,
                    'name' => 'Default Seedling',
                    'file_path' => '/avatars/default.png',
                    'is_default' => 1,
                ],
            ]);
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');

        $Silian_messageService->expects($this->exactly(2))
            ->method('sendSystemMessage')
            ->with(
                $this->logicalOr($this->equalTo(101), $this->equalTo(202)),
                $this->stringContains('Selected avatar unavailable'),
                $this->stringContains('Default Seedling'),
                \CarbonTrack\Models\Message::TYPE_NOTIFICATION,
                \CarbonTrack\Models\Message::PRIORITY_NORMAL,
                'avatar',
                5,
                true
            );

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        /** @var \CarbonTrack\Services\MessageService $messageService */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog, $Silian_messageService);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['is_active' => false]),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertFalse($Silian_payload['data']['is_active']);
    }

    public function testUpdateAvatarRejectsDisablingAvatarWhenNoDefaultFallbackExists(): void
    {
        $Silian_avatarModel = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_avatarModel->expects($this->once())
            ->method('getAvatarById')
            ->with(5)
            ->willReturn([
                'id' => 5,
                'name' => 'Seasonal Fox',
                'file_path' => '/avatars/fox.png',
                'is_default' => 0,
                'is_active' => 1,
            ]);
        $Silian_avatarModel->expects($this->once())
            ->method('updateAvatarAndReassignUsers')
            ->with(5, ['is_active' => false], null)
            ->willThrowException(new \CarbonTrack\Models\AvatarFallbackUnavailableException());
        $Silian_avatarModel->expects($this->never())->method('updateAvatar');

        /** @var \CarbonTrack\Models\Avatar $avatarModel */
        /** @var \CarbonTrack\Services\AuthService $auth */
        /** @var \CarbonTrack\Services\AuditLogService $audit */
        /** @var \CarbonTrack\Services\CloudflareR2Service $r2 */
        /** @var \Monolog\Logger $logger */
        /** @var \CarbonTrack\Services\ErrorLogService $errorLog */
        $Silian_controller = new AvatarController($Silian_avatarModel, $Silian_auth, $Silian_audit, $Silian_r2, $Silian_logger, $Silian_errorLog);

        $Silian_response = $Silian_controller->updateAvatar(
            makeRequest('PUT', '/admin/avatars/5', ['is_active' => false]),
            new \Slim\Psr7\Response(),
            ['id' => 5]
        );

        $this->assertSame(409, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('DEFAULT_AVATAR_REQUIRED', $Silian_payload['code']);
    }
}


