<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Models;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Models\User;

class UserTest extends TestCase
{
    public function testUserModelCreation(): void
    {
        $Silian_userData = [
            'id' => 1,
            'username' => 'testuser',
            'email' => 'test@example.com',
            'role' => 'user',
            'status' => 'active',
            'points' => 100,
            'created_at' => '2025-01-01 00:00:00',
            'updated_at' => '2025-01-01 00:00:00'
        ];

        $Silian_user = new User($Silian_userData);

        $this->assertEquals(1, $Silian_user->getId());
        $this->assertEquals('testuser', $Silian_user->getUsername());
        $this->assertEquals('test@example.com', $Silian_user->getEmail());
    // real_name 已废弃，不再测试
        $this->assertEquals('user', $Silian_user->getRole());
        $this->assertEquals('active', $Silian_user->getStatus());
        $this->assertEquals(100, $Silian_user->getPoints());
    }

    public function testUserModelToArray(): void
    {
        $Silian_userData = [
            'id' => 1,
            'username' => 'testuser',
            'email' => 'test@example.com',
            'role' => 'user',
            'status' => 'active',
            'points' => 100
        ];

        $Silian_user = new User($Silian_userData);
        $Silian_array = $Silian_user->toArray();

        $this->assertIsArray($Silian_array);
        $this->assertEquals($Silian_userData['id'], $Silian_array['id']);
        $this->assertEquals($Silian_userData['username'], $Silian_array['username']);
        $this->assertEquals($Silian_userData['email'], $Silian_array['email']);
    $this->assertArrayNotHasKey('real_name', $Silian_array);
        $this->assertEquals($Silian_userData['role'], $Silian_array['role']);
        $this->assertEquals($Silian_userData['status'], $Silian_array['status']);
        $this->assertEquals($Silian_userData['points'], $Silian_array['points']);
    }

    public function testUserModelToArrayExcludesPassword(): void
    {
        $Silian_userData = [
            'id' => 1,
            'username' => 'testuser',
            'email' => 'test@example.com',
            'password' => 'hashed_password',
            'role' => 'user'
        ];

        $Silian_user = new User($Silian_userData);
        $Silian_array = $Silian_user->toArray();

        $this->assertArrayNotHasKey('password', $Silian_array);
    }

    public function testUserModelIsAdmin(): void
    {
        $Silian_adminUser = new User(['role' => 'admin']);
        $Silian_regularUser = new User(['role' => 'user']);
        $Silian_supportUser = new User(['role' => 'support']);

        $this->assertTrue($Silian_adminUser->isAdmin());
        $this->assertFalse($Silian_regularUser->isAdmin());
        $this->assertFalse($Silian_supportUser->isAdmin());
    }

    public function testUserModelIsActive(): void
    {
        $Silian_activeUser = new User(['status' => 'active']);
        $Silian_inactiveUser = new User(['status' => 'inactive']);
        $Silian_suspendedUser = new User(['status' => 'suspended']);

        $this->assertTrue($Silian_activeUser->isActive());
        $this->assertFalse($Silian_inactiveUser->isActive());
        $this->assertFalse($Silian_suspendedUser->isActive());
    }

    public function testUserModelHasSufficientPoints(): void
    {
        $Silian_user = new User(['points' => 100]);

        $this->assertTrue($Silian_user->hasSufficientPoints(50));
        $this->assertTrue($Silian_user->hasSufficientPoints(100));
        $this->assertFalse($Silian_user->hasSufficientPoints(150));
    }

    public function testUserModelAddPoints(): void
    {
        $Silian_user = new User(['points' => 100]);

        $Silian_user->addPoints(50);
        $this->assertEquals(150, $Silian_user->getPoints());

        $Silian_user->addPoints(0);
        $this->assertEquals(150, $Silian_user->getPoints());
    }

    public function testUserModelSubtractPoints(): void
    {
        $Silian_user = new User(['points' => 100]);

        $Silian_result = $Silian_user->subtractPoints(30);
        $this->assertTrue($Silian_result);
        $this->assertEquals(70, $Silian_user->getPoints());

        $Silian_result = $Silian_user->subtractPoints(100);
        $this->assertFalse($Silian_result);
        $this->assertEquals(70, $Silian_user->getPoints()); // Should not change
    }

    public function testUserModelGetDisplayName(): void
    {
        $Silian_userA = new User([
            'username' => 'testuser'
        ]);
        $this->assertEquals('testuser', $Silian_userA->getDisplayName());
    }

    public function testUserModelValidation(): void
    {
        // Valid user data
        $Silian_validData = [
            'username' => 'testuser',
            'email' => 'test@example.com',
            'role' => 'user',
            'status' => 'active'
        ];

        $Silian_user = new User($Silian_validData);
        $this->assertTrue($Silian_user->isValid());

        // Invalid user data - missing required fields
        $Silian_invalidData = [
            'username' => 'testuser'
            // Missing email, role, status
        ];

        $Silian_invalidUser = new User($Silian_invalidData);
        $this->assertFalse($Silian_invalidUser->isValid());
    }

    public function testUserModelGetValidationErrors(): void
    {
        $Silian_invalidData = [
            'username' => '', // Empty username
            'email' => 'invalid-email', // Invalid email format
            'role' => 'invalid_role', // Invalid role
            'status' => 'invalid_status' // Invalid status
        ];

        $Silian_user = new User($Silian_invalidData);
        $Silian_errors = $Silian_user->getValidationErrors();

        $this->assertIsArray($Silian_errors);
        $this->assertNotEmpty($Silian_errors);
        $this->assertContains('Username is required', $Silian_errors);
        $this->assertContains('Invalid email format', $Silian_errors);
        $this->assertContains('Invalid role', $Silian_errors);
        $this->assertContains('Invalid status', $Silian_errors);
    }
}

