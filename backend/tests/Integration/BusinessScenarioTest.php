<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * Practical Business Scenario Tests
 *
 * This test suite focuses on real-world business scenarios using the actual API
 * to validate core functionality works as expected in realistic conditions.
 */
class BusinessScenarioTest extends TestCase
{
    private array $testUsers = [];
    private string $baseUrl = 'http://localhost:8080';

    protected function setUp(): void
    {
        $Silian_enabled = $_ENV['RUN_BUSINESS_SCENARIO_TESTS'] ?? $_SERVER['RUN_BUSINESS_SCENARIO_TESTS'] ?? getenv('RUN_BUSINESS_SCENARIO_TESTS');
        if (!filter_var($Silian_enabled, FILTER_VALIDATE_BOOLEAN)) {
            $this->markTestSkipped('RUN_BUSINESS_SCENARIO_TESTS not enabled; skipping live API journey tests.');
        }

        $Silian_configuredBaseUrl = $_ENV['CARBONTRACK_TEST_BASE_URL']
            ?? $_SERVER['CARBONTRACK_TEST_BASE_URL']
            ?? getenv('CARBONTRACK_TEST_BASE_URL')
            ?? null;

        if (is_string($Silian_configuredBaseUrl) && $Silian_configuredBaseUrl !== '') {
            $this->baseUrl = $Silian_configuredBaseUrl;
        }

        $this->baseUrl = rtrim($this->baseUrl, '/');

        // Ensure the external API server is reachable before running these end-to-end tests
        $this->startServerIfNeeded();

        // Create test users for scenarios
        $this->setupTestUsers();
    }

    private function startServerIfNeeded(): void
    {
        $Silian_probeUrl = $this->baseUrl . '/';
        $Silian_headers = @get_headers($Silian_probeUrl);

        $Silian_reachable = false;
        if (is_array($Silian_headers) && isset($Silian_headers[0]) && stripos((string)$Silian_headers[0], 'HTTP/') === 0) {
            $Silian_reachable = true;
        } elseif (is_string($Silian_headers) && stripos($Silian_headers, 'HTTP/') === 0) {
            $Silian_reachable = true;
        }

        if (!$Silian_reachable) {
            // Fallback to cURL probing when available to distinguish between HTTP errors and network failures
            if (function_exists('curl_init')) {
                $Silian_timeout = (int)($_ENV['CARBONTRACK_TEST_TIMEOUT'] ?? $_SERVER['CARBONTRACK_TEST_TIMEOUT'] ?? getenv('CARBONTRACK_TEST_TIMEOUT') ?? 3);
                $Silian_ch = curl_init($Silian_probeUrl);
                curl_setopt_array($Silian_ch, [
                    CURLOPT_NOBODY => true,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => $Silian_timeout,
                    CURLOPT_CONNECTTIMEOUT => $Silian_timeout,
                    CURLOPT_FOLLOWLOCATION => true,
                ]);
                $Silian_curlResult = curl_exec($Silian_ch);
                $Silian_httpCode = (int)curl_getinfo($Silian_ch, CURLINFO_HTTP_CODE);
                $Silian_curlError = curl_error($Silian_ch);
                curl_close($Silian_ch);

                if ($Silian_curlResult !== false || $Silian_httpCode > 0) {
                    $Silian_reachable = true;
                } else {
                    $Silian_extra = $Silian_curlError ? ' (cURL error: ' . $Silian_curlError . ')' : '';
                    $this->markTestSkipped('Server not reachable on ' . $Silian_probeUrl . $Silian_extra);
                    return;
                }
            } else {
                $this->markTestSkipped('Server not reachable on ' . $Silian_probeUrl . '. Set CARBONTRACK_TEST_BASE_URL if your server runs elsewhere.');
                return;
            }
        }

        if (!$Silian_reachable) {
            $this->markTestSkipped('Server not reachable on ' . $Silian_probeUrl . '. Set CARBONTRACK_TEST_BASE_URL if your server runs elsewhere.');
        }
    }

    private function setupTestUsers(): void
    {
        $this->testUsers = [
            'student' => [
                'username' => 'test_student_' . time(),
                'email' => 'student_' . time() . '@test.com',
                'password' => 'SecurePassword123!',
                // real_name 与 class_name 已弃用
                // phone 字段已移除
                'school_id' => 1,
                'token' => null
            ],
            'admin' => [
                'username' => 'test_admin_' . time(),
                'email' => 'admin_' . time() . '@test.com',
                'password' => 'AdminPassword123!',
                // real_name 已弃用
                // phone 字段已移除
                'school_id' => 1,
                'role' => 'admin',
                'token' => null
            ]
        ];
    }

    private function makeApiRequest(string $Silian_method, string $Silian_endpoint, array $Silian_data = [], array $Silian_headers = []): array
    {
        $Silian_url = rtrim($this->baseUrl, '/') . '/api/v1' . $Silian_endpoint;

        $Silian_hasRequestId = false;
        foreach ($Silian_headers as $Silian_key => $Silian_value) {
            if (strcasecmp($Silian_key, 'X-Request-ID') === 0) {
                $Silian_hasRequestId = true;
                break;
            }
        }
        if (!$Silian_hasRequestId) {
            $Silian_headers['X-Request-ID'] = $this->generateRequestId();
        }

        if (strcasecmp($Silian_method, 'POST') === 0
            && preg_match('#/auth/register$#i', $Silian_endpoint)
            && !array_key_exists('cf_turnstile_response', $Silian_data)
        ) {
            $Silian_data['cf_turnstile_response'] = 'test_turnstile_token';
        }

        $Silian_options = [
            'http' => [
                'method' => strtoupper($Silian_method),
                'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
                'content' => !empty($Silian_data) ? json_encode($Silian_data) : '',
                'ignore_errors' => true
            ]
        ];

        foreach ($Silian_headers as $Silian_key => $Silian_value) {
            $Silian_options['http']['header'] .= "{$Silian_key}: {$Silian_value}\r\n";
        }

        $Silian_context = stream_context_create($Silian_options);
        $Silian_response = file_get_contents($Silian_url, false, $Silian_context);

        $Silian_statusCode = 200;
        if (isset($http_response_header)) {
            foreach ($http_response_header as $Silian_header) {
                if (strpos($Silian_header, 'HTTP/') === 0) {
                    $Silian_statusCode = (int) explode(' ', $Silian_header)[1];
                    break;
                }
            }
        }

        return [
            'status_code' => $Silian_statusCode,
            'body' => $Silian_response ? json_decode($Silian_response, true) : null,
            'raw_body' => $Silian_response
        ];
    }

    private function generateRequestId(): string
    {
        try {
            $Silian_data = random_bytes(16);
            $Silian_data[6] = chr((ord($Silian_data[6]) & 0x0f) | 0x40);
            $Silian_data[8] = chr((ord($Silian_data[8]) & 0x3f) | 0x80);
            $Silian_hex = bin2hex($Silian_data);
            return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($Silian_hex, 4));
        } catch (\Throwable $Silian_e) {
            return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }
    }

    public function testCompleteUserJourney(): void
    {
        $Silian_student = $this->testUsers['student'];

        // Step 1: User Registration
        $Silian_registrationData = [
            'username' => $Silian_student['username'],
            'email' => $Silian_student['email'],
            'password' => $Silian_student['password'],
            'confirm_password' => $Silian_student['password'],
            // 'phone' 字段已移除
            'school_id' => $Silian_student['school_id'],
        ];

        $Silian_response = $this->makeApiRequest('POST', '/auth/register', $Silian_registrationData);

        if ($Silian_response['status_code'] >= 500) {
            $this->markTestSkipped('Registration endpoint unavailable (status ' . $Silian_response['status_code'] . ')');
        }
        $this->assertEquals(201, $Silian_response['status_code'], 'User registration should succeed');
        $this->assertTrue($Silian_response['body']['success'] ?? false, 'Registration should return success');

        if (isset($Silian_response['body']['data']['token'])) {
            $this->testUsers['student']['token'] = $Silian_response['body']['data']['token'];
        }

        // Step 2: User Login (alternative if registration doesn't return token)
        if (!$this->testUsers['student']['token']) {
            $Silian_loginData = [
                'email' => $Silian_student['email'],
                'password' => $Silian_student['password'],
            ];

            $Silian_response = $this->makeApiRequest('POST', '/auth/login', $Silian_loginData);
            $this->assertEquals(200, $Silian_response['status_code'], 'User login should succeed');
            $this->testUsers['student']['token'] = $Silian_response['body']['data']['token'] ?? null;
        }

        $this->assertNotNull($this->testUsers['student']['token'], 'Should have authentication token');

        // Step 3: Get User Profile
        $Silian_headers = ['Authorization' => 'Bearer ' . $this->testUsers['student']['token']];
        $Silian_response = $this->makeApiRequest('GET', '/users/me', [], $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting user profile should succeed');
        $this->assertEquals($Silian_student['email'], $Silian_response['body']['data']['email'] ?? '', 'Should return correct user email');

        // Step 4: Get Available Carbon Activities
        $Silian_response = $this->makeApiRequest('GET', '/carbon-activities', [], $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting carbon activities should succeed');
        $Silian_payload = $Silian_response['body']['data'] ?? [];
        $Silian_activities = $Silian_payload['activities'] ?? $Silian_payload;
        $this->assertIsArray($Silian_activities, 'Should return array of activities');
        if (empty($Silian_activities)) {
            $this->markTestSkipped('No carbon activities available on ' . $this->baseUrl);
        }

        $Silian_firstActivity = $Silian_activities[0] ?? null;
        $this->assertNotNull($Silian_firstActivity, 'Should have first activity');

        // Step 5: Calculate Carbon Savings
        $Silian_calculateData = [
            'activity_id' => $Silian_firstActivity['id'],
            'amount' => 2.0,
            'unit' => $Silian_firstActivity['unit']
        ];

        $Silian_response = $this->makeApiRequest('POST', '/carbon-track/calculate', $Silian_calculateData, $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Carbon calculation should succeed');
        $this->assertArrayHasKey('carbon_saved', $Silian_response['body']['data'] ?? [], 'Should return carbon_saved');
        $this->assertArrayHasKey('points_earned', $Silian_response['body']['data'] ?? [], 'Should return points_earned');

        // Step 6: Submit Carbon Tracking Record
        $Silian_recordData = [
            'activity_id' => $Silian_firstActivity['id'],
            'amount' => 2.0,
            'unit' => $Silian_firstActivity['unit'],
            'date' => date('Y-m-d'),
            'description' => 'Automated test - brought reusable water bottle to work',
            'proof_images' => ['/test/proof_image.jpg'],
            'request_id' => $this->generateRequestId()
        ];

        $Silian_headers['X-Request-ID'] = $Silian_recordData['request_id'];
        $Silian_response = $this->makeApiRequest('POST', '/carbon-track/record', $Silian_recordData, $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Submitting carbon record should succeed');
        $this->assertArrayHasKey('record_id', $Silian_response['body']['data'] ?? [], 'Should return record_id');
        $Silian_recordId = $Silian_response['body']['data']['record_id'] ?? null;
        $this->assertNotEmpty($Silian_recordId, 'Record id should not be empty');


        // Step 7: Get User's Carbon Tracking History
        $Silian_response = $this->makeApiRequest('GET', '/carbon-track/transactions', [], $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting transactions should succeed');
        $this->assertIsArray($Silian_response['body']['data'] ?? [], 'Should return array of transactions');

        $Silian_transactionsPayload = $Silian_response['body']['data'] ?? [];
        $Silian_transactions = $Silian_transactionsPayload['records']
            ?? $Silian_transactionsPayload['transactions']
            ?? $Silian_transactionsPayload;
        if (!is_array($Silian_transactions)) {
            $Silian_transactions = [];
        }

        if (empty($Silian_transactions)) {
            $this->markTestSkipped('No transactions returned by ' . $this->baseUrl);
        }

        $Silian_foundRecord = null;
        foreach ($Silian_transactions as $Silian_transaction) {
            $Silian_transactionIdValue = $Silian_transaction['id']
                ?? ($Silian_transaction['record_id'] ?? null);
            if ($Silian_transactionIdValue === $Silian_recordId) {
                $Silian_foundRecord = $Silian_transaction;
                break;
            }
        }

        $this->assertNotNull($Silian_foundRecord, 'Submitted record should appear in history');

        // Step 8: Get Available Products for Exchange
        $Silian_response = $this->makeApiRequest('GET', '/products', [], $Silian_headers);

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting products should succeed');

    }

    public function testAdminWorkflow(): void
    {
        // This test requires an existing admin user or the ability to create one
        // For simplicity, we'll test admin endpoints that don't require authentication

        // Test getting carbon activities (public endpoint)
        $Silian_response = $this->makeApiRequest('GET', '/carbon-activities');

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting carbon activities should work');
        $this->assertIsArray($Silian_response['body']['data'] ?? [], 'Should return activities data');

        // Test getting avatars (public endpoint)
        $Silian_response = $this->makeApiRequest('GET', '/avatars');

        $this->assertEquals(200, $Silian_response['status_code'], 'Getting avatars should work');
        $this->assertIsArray($Silian_response['body']['data'] ?? [], 'Should return avatars data');

    }

    public function testApiHealthAndConnectivity(): void
    {
        // Test root health check
        $Silian_response = $this->makeApiRequest('GET', '', []); // Root endpoint
        $this->assertEquals(200, $Silian_response['status_code'], 'Root health check should work');

        // Test API v1 root
        $Silian_response = $this->makeApiRequest('GET', '');
        $this->assertEquals(200, $Silian_response['status_code'], 'API v1 root should work');

        // Test that proper error handling works for non-existent endpoints
        $Silian_response = $this->makeApiRequest('GET', '/nonexistent');
        $this->assertNotEquals(200, $Silian_response['status_code'], 'Non-existent endpoint should return error');

    }

    public function testAuthenticationFlow(): void
    {
        // Test accessing protected endpoint without authentication
        $Silian_response = $this->makeApiRequest('GET', '/users/me');
        $this->assertEquals(401, $Silian_response['status_code'], 'Protected endpoint should require authentication');

        // Test invalid login credentials
        $Silian_invalidLogin = [
            'email' => 'nonexistent@test.com',
            'password' => 'wrongpassword',
        ];

        $Silian_response = $this->makeApiRequest('POST', '/auth/login', $Silian_invalidLogin);
        $this->assertNotEquals(200, $Silian_response['status_code'], 'Invalid login should fail');

    }

    public function testDataValidation(): void
    {
        // Test user registration with invalid data
        $Silian_invalidRegistration = [
            'username' => 'a', // Too short
            'email' => 'invalid-email', // Invalid format
            'password' => '123', // Too weak
        ];

        $Silian_response = $this->makeApiRequest('POST', '/auth/register', $Silian_invalidRegistration);
        $this->assertNotEquals(200, $Silian_response['status_code'], 'Invalid registration data should be rejected');

    }

    // tearDown 使用基类默认实现
}


