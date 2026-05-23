<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Services\DatabaseService;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use DI\Container;

/**
 * Realistic Business Data Test
 *
 * Tests the core business flows with realistic data scenarios
 * without requiring external server setup
 */
class RealisticBusinessDataTest extends TestCase
{
    private App $app;
    private Container $container;

    protected function setUp(): void
    {
        // Set up minimal test environment
        $_ENV['APP_ENV'] = 'testing';
        $_ENV['DATABASE_PATH'] = __DIR__ . '/../../test.db';
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_ENV['DB_DATABASE'] = $_ENV['DATABASE_PATH'];
        $_ENV['JWT_SECRET'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        $_ENV['TURNSTILE_SECRET_KEY'] = 'test_turnstile_secret';
    // Provide dummy Cloudflare R2 env vars so CloudflareR2Service can be constructed without throwing
    $_ENV['R2_ACCESS_KEY_ID'] = 'test_access_key';
    $_ENV['R2_SECRET_ACCESS_KEY'] = 'test_secret_key';
    $_ENV['R2_ENDPOINT'] = 'https://example.com';
    $_ENV['R2_BUCKET_NAME'] = 'test-bucket';
    $_ENV['R2_PUBLIC_URL'] = 'https://example.com/test-bucket';

        // Ensure SQLite file exists
        if (!file_exists($_ENV['DATABASE_PATH'])) {
            touch($_ENV['DATABASE_PATH']);
        }

        try {
            $this->container = new Container();

            // Provide database config for dependencies.php (Illuminate setup)
            $Silian_config = [
                'database' => [
                    'default' => 'sqlite',
                    'connections' => [
                        'sqlite' => [
                            'driver' => 'sqlite',
                            'database' => $_ENV['DATABASE_PATH'],
                            'prefix' => '',
                        ]
                    ]
                ]
            ];
            $this->container->set('config', $Silian_config);

            // Load dependencies initializer and execute it with our container
            $Silian_depsInitializer = require __DIR__ . '/../../src/dependencies.php';
            if (is_callable($Silian_depsInitializer)) {
                $Silian_depsInitializer($this->container);
            }

            // Initialize unified minimal schema + seed BEFORE app boot
            /** @var DatabaseService $dbServiceSchema */
            $Silian_dbServiceSchema = $this->container->get(DatabaseService::class);
            TestSchemaBuilder::init($Silian_dbServiceSchema->getConnection()->getPdo());

            // Create Slim app
            $this->app = \Slim\Factory\AppFactory::createFromContainer($this->container);
            $this->app->addErrorMiddleware(false, false, false); // Disable detailed errors for cleaner test output
            $this->app->addBodyParsingMiddleware();
            $this->app->addRoutingMiddleware();

            // Add routes
            $Silian_routes = require __DIR__ . '/../../src/routes.php';
            $Silian_routes($this->app);

            // Previously inline creation of carbon_activities & avatars now handled by TestSchemaBuilder
        } catch (\Exception $Silian_e) {
            $this->markTestSkipped('Could not set up test environment: ' . $Silian_e->getMessage());
        }
    }

    private function createRequest(string $Silian_method, string $Silian_uri, array $Silian_data = [], array $Silian_headers = []): \Psr\Http\Message\ServerRequestInterface
    {
        $Silian_factory = new ServerRequestFactory();
        $Silian_request = $Silian_factory->createServerRequest($Silian_method, $Silian_uri);

        if (
            strtoupper($Silian_method) === 'POST'
            && preg_match('#/auth/register$#i', $Silian_uri)
            && !array_key_exists('cf_turnstile_response', $Silian_data)
        ) {
            $Silian_data['cf_turnstile_response'] = 'test_turnstile_token';
        }

        if (!empty($Silian_data)) {
            $Silian_request = $Silian_request->withParsedBody($Silian_data);
        }

        foreach ($Silian_headers as $Silian_name => $Silian_value) {
            $Silian_request = $Silian_request->withHeader($Silian_name, $Silian_value);
        }

        return $Silian_request;
    }

    public function testHealthCheckEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertEquals('CarbonTrack API is running', $Silian_data['message']);
        $this->assertEquals('1.0.0', $Silian_data['version']);
    }

    public function testApiV1RootEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/api/v1');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertEquals('CarbonTrack API v1', $Silian_data['message']);
        $this->assertArrayHasKey('endpoints', $Silian_data);

        // Verify all major endpoints are listed
        $Silian_expectedEndpoints = [
            'auth', 'users', 'carbon-activities', 'carbon-track',
            'products', 'exchange', 'messages', 'avatars', 'admin'
        ];

        foreach ($Silian_expectedEndpoints as $Silian_endpoint) {
            $this->assertArrayHasKey($Silian_endpoint, $Silian_data['endpoints'], "Should have {$Silian_endpoint} endpoint listed");
        }
    }

    public function testCarbonActivitiesPublicEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/api/v1/carbon-activities');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertIsArray($Silian_data['data']);

        // New API structure: data.activities holds list
        $Silian_activitiesList = $Silian_data['data']['activities'] ?? $Silian_data['data'];
        $this->assertIsArray($Silian_activitiesList, 'Activities list should be an array');

        // Verify we have carbon activities data with realistic structure
        if (!empty($Silian_activitiesList)) {
            $Silian_activity = $Silian_activitiesList[0];
            $this->assertArrayHasKey('id', $Silian_activity);
            $this->assertArrayHasKey('name_zh', $Silian_activity);
            $this->assertArrayHasKey('name_en', $Silian_activity);
            $this->assertArrayHasKey('category', $Silian_activity);
            $this->assertArrayHasKey('carbon_factor', $Silian_activity);
            $this->assertArrayHasKey('unit', $Silian_activity);

            // Verify realistic business data
            $this->assertNotEmpty($Silian_activity['name_zh'], 'Should have Chinese name');
            $this->assertNotEmpty($Silian_activity['name_en'], 'Should have English name');
            $this->assertIsNumeric($Silian_activity['carbon_factor'], 'Carbon factor should be numeric');
            $this->assertNotEmpty($Silian_activity['unit'], 'Should have unit');
        }
    }

    public function testAvatarsPublicEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/api/v1/avatars');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertIsArray($Silian_data['data']);

        // Verify avatar data structure
        if (!empty($Silian_data['data'])) {
            $Silian_avatar = $Silian_data['data'][0];
            $this->assertArrayHasKey('id', $Silian_avatar);
            $this->assertArrayHasKey('name', $Silian_avatar);
            $this->assertArrayHasKey('file_path', $Silian_avatar);
            $this->assertArrayHasKey('category', $Silian_avatar);
        }
    }

    public function testUnauthorizedAccessHandling(): void
    {
        // Test accessing protected endpoint without auth
        $Silian_request = $this->createRequest('GET', '/api/v1/users/me');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(401, $Silian_response->getStatusCode());

        // Legacy alias should also require auth when OpenAPI marks it as protected
        $Silian_request = $this->createRequest('GET', '/api/v1/activities/categories');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(401, $Silian_response->getStatusCode());
    }

    public function testProtectedEndpointsRequireAuthentication(): void
    {
        $Silian_recordPayload = [
            'activity_id' => '550e8400-e29b-41d4-a716-446655440001',
            'amount' => 1,
            'unit' => 'times',
            'date' => date('Y-m-d'),
            'description' => 'Auth consistency smoke test',
            'proof_images' => ['/test/proof-image.jpg'],
            'request_id' => 'auth-consistency-' . uniqid('', true),
        ];

        $Silian_cases = [
            [
                'method' => 'GET',
                'uri' => '/api/v1/activities',
                'data' => [],
                'expected_status' => 401,
            ],
            [
                'method' => 'GET',
                'uri' => '/api/v1/activities/categories',
                'data' => [],
                'expected_status' => 401,
            ],
            [
                'method' => 'POST',
                'uri' => '/api/v1/carbon-track/record',
                'data' => $Silian_recordPayload,
                'expected_status' => 401,
            ],
            [
                'method' => 'GET',
                'uri' => '/api/v1/admin/carbon-activities/pending',
                'data' => [],
                'expected_status' => 401,
            ],
            [
                'method' => 'GET',
                'uri' => '/api/v1/admin/carbon-records',
                'data' => [],
                'expected_status' => 401,
            ],
        ];

        foreach ($Silian_cases as $Silian_case) {
            $Silian_request = $this->createRequest($Silian_case['method'], $Silian_case['uri'], $Silian_case['data']);
            $Silian_response = $this->app->handle($Silian_request);

            $this->assertSame(
                $Silian_case['expected_status'],
                $Silian_response->getStatusCode(),
                sprintf('%s %s should reject unauthenticated access', $Silian_case['method'], $Silian_case['uri'])
            );
        }
    }

    public function testCarbonCalculationWithRealisticData(): void
    {
        // Test calculation endpoint (if accessible without auth, or mock auth)
        $Silian_realisticCalculationData = [
            'activity_id' => '550e8400-e29b-41d4-a716-446655440001', // From sample data
            'amount' => 3.5,
            'unit' => 'times'
        ];

        // This may require authentication, so we test with mock token
        $Silian_mockToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test.signature'; // Mock JWT

        $Silian_request = $this->createRequest('POST', '/api/v1/carbon-track/calculate', $Silian_realisticCalculationData, [
            'Authorization' => 'Bearer ' . $Silian_mockToken
        ]);

        $Silian_response = $this->app->handle($Silian_request);

        // We expect either 200 (success) or 401 (unauthorized), not 500 (server error)
        $this->assertContains($Silian_response->getStatusCode(), [200, 401],
            'Carbon calculation should either work or require auth, not crash');

        if ($Silian_response->getStatusCode() === 200) {
            $Silian_body = (string) $Silian_response->getBody();
            $Silian_data = json_decode($Silian_body, true);

            $this->assertTrue($Silian_data['success']);
            $this->assertArrayHasKey('carbon_saved', $Silian_data['data']);
            $this->assertArrayHasKey('points_earned', $Silian_data['data']);
            $this->assertIsNumeric($Silian_data['data']['carbon_saved']);
            $this->assertIsNumeric($Silian_data['data']['points_earned']);
        }
    }

    public function testUserRegistrationValidation(): void
    {
        // Test with realistic but potentially problematic data
        $Silian_realisticRegistrationData = [
            'username' => 'test_user_' . time(), // Unique username
            'email' => 'test_user_' . time() . '@example.com', // Unique email
            'password' => 'SecurePassword123!',
            'confirm_password' => 'SecurePassword123!',
            'school_id' => 1,
            // 省略 cf_turnstile_response 以跳过外部验证
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/auth/register', $Silian_realisticRegistrationData);
        $Silian_response = $this->app->handle($Silian_request);

        // Should either succeed or fail gracefully (not crash)
    $this->assertContains($Silian_response->getStatusCode(), [200, 201, 400, 422, 429],
            'Registration should handle realistic data gracefully');

        if ($Silian_response->getStatusCode() === 200) {
            $Silian_body = (string) $Silian_response->getBody();
            $Silian_data = json_decode($Silian_body, true);

            $this->assertTrue($Silian_data['success']);
            $this->assertArrayHasKey('user', $Silian_data['data']);
            $this->assertArrayHasKey('token', $Silian_data['data']);
        }
    }

    public function testInvalidDataHandling(): void
    {
        // Test with various invalid data scenarios
        $Silian_invalidScenarios = [
            // Empty registration
            [
                'data' => [],
                'endpoint' => '/api/v1/auth/register',
                'method' => 'POST'
            ],
            // Invalid email format
            [
                'data' => [
                    'username' => 'testuser',
                    'email' => 'invalid-email-format',
                    'password' => 'password123'
                ],
                'endpoint' => '/api/v1/auth/register',
                'method' => 'POST'
            ],
            // SQL injection attempt
            [
                'data' => [
                    'username' => "admin'; DROP TABLE users; --",
                    'email' => 'hacker@test.com',
                    'password' => 'password123'
                ],
                'endpoint' => '/api/v1/auth/register',
                'method' => 'POST'
            ],
            // XSS attempt
            [
                'data' => [
                    'username' => '<script>alert("xss")</script>',
                    'email' => 'xss@test.com',
                    'password' => 'password123'
                ],
                'endpoint' => '/api/v1/auth/register',
                'method' => 'POST'
            ]
        ];

        foreach ($Silian_invalidScenarios as $Silian_scenario) {
            $Silian_request = $this->createRequest($Silian_scenario['method'], $Silian_scenario['endpoint'], $Silian_scenario['data']);
            $Silian_response = $this->app->handle($Silian_request);

            // Should reject invalid data gracefully (400-level error, not 500)
            $this->assertGreaterThanOrEqual(400, $Silian_response->getStatusCode());
            $this->assertLessThan(500, $Silian_response->getStatusCode());
        }
    }

    public function testLargeDataHandling(): void
    {
        // Test with realistic but large data sets
        $Silian_largeDescription = str_repeat('这是一个测试描述。', 100); // 1000+ characters Chinese text

        $Silian_largeDataRequest = [
            'activity_id' => '550e8400-e29b-41d4-a716-446655440001',
            'amount' => 999999.99, // Large amount
            'description' => $Silian_largeDescription,
            'proof_images' => array_fill(0, 10, '/test/image_' . uniqid() . '.jpg'), // Multiple images
            'request_id' => 'large_test_' . uniqid()
        ];

        $Silian_mockToken = 'mock_jwt_token';
        $Silian_request = $this->createRequest('POST', '/api/v1/carbon-track/record', $Silian_largeDataRequest, [
            'Authorization' => 'Bearer ' . $Silian_mockToken,
            'X-Request-ID' => $Silian_largeDataRequest['request_id']
        ]);

        $Silian_response = $this->app->handle($Silian_request);

        // Should handle large data gracefully (not crash with 500 error)
    $this->assertNotEquals(500, $Silian_response->getStatusCode(),
            'Large data should not cause server errors');
    }

    public function testConcurrentRequestHandling(): void
    {
        // Simulate concurrent requests with different request IDs
        $Silian_requests = [];
        for ($Silian_i = 0; $Silian_i < 5; $Silian_i++) {
            $Silian_data = [
                'activity_id' => '550e8400-e29b-41d4-a716-446655440001',
                'amount' => 1.0 + $Silian_i,
                'description' => "Concurrent test request {$Silian_i}",
                'request_id' => 'concurrent_test_' . $Silian_i . '_' . uniqid()
            ];

            $Silian_requests[] = $this->createRequest('POST', '/api/v1/carbon-track/calculate', $Silian_data);
        }

        // Execute requests
        $Silian_responses = [];
        foreach ($Silian_requests as $Silian_request) {
            $Silian_responses[] = $this->app->handle($Silian_request);
        }

        // All requests should be handled consistently
        foreach ($Silian_responses as $Silian_response) {
            $this->assertContains($Silian_response->getStatusCode(), [200, 401, 422],
                'Concurrent requests should be handled consistently');
        }
    }

    // tearDown 使用基类默认实现
}

