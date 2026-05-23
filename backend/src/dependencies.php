<?php

declare(strict_types=1);

use DI\Container;
use Psr\Container\ContainerInterface;
use Monolog\Logger;
use Psr\Log\LoggerInterface;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Handler\ErrorLogHandler;
use Illuminate\Database\Capsule\Manager as Capsule;
use CarbonTrack\Services\DatabaseService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\TurnstileService;
use CarbonTrack\Services\SystemLogService;
use CarbonTrack\Services\LlmLogService;
use CarbonTrack\Services\NotificationPreferenceService;
use CarbonTrack\Services\MultipartUploadService;
use CarbonTrack\Services\SupportAutomationService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportRoutingTriageService;
use CarbonTrack\Services\SupportTicketService;
use CarbonTrack\Controllers\SystemLogController;
use CarbonTrack\Controllers\LogSearchController;
use CarbonTrack\Services\FileMetadataService;
use CarbonTrack\Models\Avatar;
use CarbonTrack\Controllers\AvatarController;
use CarbonTrack\Controllers\UserController;
use CarbonTrack\Controllers\AuthController;
use CarbonTrack\Controllers\CarbonTrackController;
use CarbonTrack\Controllers\CarbonActivityController;
use CarbonTrack\Controllers\ProductController;
use CarbonTrack\Controllers\MessageController;
use CarbonTrack\Controllers\SchoolController;
use CarbonTrack\Controllers\AdminController;
use CarbonTrack\Controllers\AdminLlmUsageController;
use CarbonTrack\Controllers\FileUploadController;
use CarbonTrack\Controllers\LeaderboardController;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\StatisticsService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use CarbonTrack\Services\LeaderboardService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\StreakLeaderboardService;
use CarbonTrack\Services\AdminAiIntentService;
use CarbonTrack\Services\AdminAiAgentService;
use CarbonTrack\Services\AdminAiConversationStoreService;
use CarbonTrack\Services\AdminAiReadModelService;
use CarbonTrack\Services\AdminAiResultFormatterService;
use CarbonTrack\Services\AdminAiWriteActionService;
use CarbonTrack\Services\AdminAnnouncementAiService;
use CarbonTrack\Controllers\BadgeController;
use CarbonTrack\Controllers\AdminBadgeController;
use CarbonTrack\Middleware\RequestLoggingMiddleware;
use CarbonTrack\Controllers\StatsController;
use CarbonTrack\Services\Ai\OpenAiClientAdapter;
use CarbonTrack\Controllers\AdminAiController;
use CarbonTrack\Controllers\AdminSupportController;
use CarbonTrack\Controllers\AdminCronController;
use CarbonTrack\Controllers\CronController;
use CarbonTrack\Controllers\UserAiController;
use CarbonTrack\Controllers\SupportTicketController;
use CarbonTrack\Services\AdminAiCommandRepository;
use CarbonTrack\Services\UserAiService;
use CarbonTrack\Services\QuotaService;
use CarbonTrack\Services\QuotaConfigService;
use CarbonTrack\Services\UserGroupService;
use CarbonTrack\Services\PasskeyConfig;
use CarbonTrack\Services\PasskeyService;
use CarbonTrack\Services\WebauthnProviderInterface;
use CarbonTrack\Services\NativeWebauthnProvider;
use CarbonTrack\Services\NullWebauthnProvider;
use CarbonTrack\Controllers\AdminUserGroupController;
use CarbonTrack\Controllers\CheckinController;
use CarbonTrack\Controllers\PasskeyController;
use CarbonTrack\Models\UserPasskey;
use CarbonTrack\Models\WebauthnChallenge;
use CarbonTrack\Middleware\SupportMiddleware;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Utils;
use Psr\Http\Message\ResponseInterface;
use OpenAI\Factory as OpenAiFactory;

$Silian___deps_initializer = function (Container $Silian_container) {
    // Logger
    $Silian_container->set(Logger::class, function () {
        try {
            $Silian_logger = new Logger('carbontrack');

            // 检查环境变量是否设置，如果没有则使用默认值
            $Silian_appEnv = $_ENV['APP_ENV'] ?? 'development';

            // 检查是否为Windows环境
            $Silian_isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';

            if ($Silian_appEnv === 'production' && !$Silian_isWindows) {
                // 生产环境且非Windows系统
                $Silian_logPath = __DIR__ . '/../logs/app.log';
                $Silian_logDir = dirname($Silian_logPath);

                // 确保日志目录存在并且有正确的权限
                if (!is_dir($Silian_logDir)) {
                    if (!mkdir($Silian_logDir, 0755, true)) {
                        throw new \Exception("无法创建日志目录: {$Silian_logDir}");
                    }
                }

                // 检查目录是否可写
                if (!is_writable($Silian_logDir)) {
                    throw new \Exception("日志目录不可写: {$Silian_logDir}");
                }

                // 尝试创建或写入日志文件
                if (!file_exists($Silian_logPath)) {
                    if (!touch($Silian_logPath)) {
                        throw new \Exception("无法创建日志文件: {$Silian_logPath}");
                    }
                    chmod($Silian_logPath, 0644);
                }

                $Silian_handler = new RotatingFileHandler($Silian_logPath, 0, Logger::INFO);
            } else {
                // 开发环境：Windows 下使用系统错误日志，避免 FastCGI 下 stdout 句柄问题
                if ($Silian_isWindows) {
                    $Silian_handler = new ErrorLogHandler(ErrorLogHandler::OPERATING_SYSTEM, Logger::DEBUG);
                } else {
                    $Silian_handler = new StreamHandler('php://stdout', Logger::DEBUG);
                }
            }

            $Silian_logger->pushHandler($Silian_handler);
            return $Silian_logger;
        } catch (\Exception $Silian_e) {
            // 如果Logger创建失败，创建一个基本的Logger到标准错误输出
            $Silian_fallbackLogger = new Logger('carbontrack');
            $Silian_fallbackLogger->pushHandler(new StreamHandler('php://stderr', Logger::ERROR));
            $Silian_fallbackLogger->error('Failed to create logger with configured handlers: ' . $Silian_e->getMessage());
            return $Silian_fallbackLogger;
        }
    });

    // Allow retrieving logger via interface
    $Silian_container->set(LoggerInterface::class, function (Container $Silian_c) {
        return $Silian_c->get(Logger::class);
    });

    // Database
    $Silian_container->set(DatabaseService::class, function () {
        $Silian_capsule = new Capsule;

        $Silian_dbConnection = $_ENV['DB_CONNECTION'] ?? 'mysql';

        if ($Silian_dbConnection === 'sqlite') {
            $Silian_capsule->addConnection([
                'driver' => 'sqlite',
                'database' => $_ENV['DB_DATABASE'] ?? '/tmp/test.db',
                'prefix' => '',
                'options' => [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ],
            ]);
        } else {
            $Silian_capsule->addConnection([
                'driver' => 'mysql',
                'host' => $_ENV['DB_HOST'] ?? 'localhost',
                'port' => $_ENV['DB_PORT'] ?? 3306,
                'database' => $_ENV['DB_DATABASE'] ?? 'carbontrack',
                // Support both DB_USERNAME/DB_PASSWORD and legacy DB_USER/DB_PASS
                'username' => $_ENV['DB_USERNAME'] ?? $_ENV['DB_USER'] ?? 'root',
                'password' => $_ENV['DB_PASSWORD'] ?? $_ENV['DB_PASS'] ?? '',
                'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_unicode_ci',
                'prefix' => '',
                'options' => [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ],
            ]);
        }

        $Silian_capsule->setAsGlobal();
        $Silian_capsule->bootEloquent();

        return new DatabaseService($Silian_capsule);
    });

    // PDO Service (for services that need direct PDO access)
    $Silian_container->set(PDO::class, function (ContainerInterface $Silian_c) {
        return $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
    });

    // Auth Service
    $Silian_container->set(AuthService::class, function (ContainerInterface $Silian_c) {
        // Support both JWT_EXPIRATION and JWT_EXPIRES_IN
        $Silian_jwtTtl = $_ENV['JWT_EXPIRATION'] ?? $_ENV['JWT_EXPIRES_IN'] ?? 86400;
        $Silian_authService = new AuthService(
            $_ENV['JWT_SECRET'],
            $_ENV['JWT_ALGORITHM'] ?? 'HS256',
            (int) $Silian_jwtTtl,
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );

        // 设置数据库连接
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        $Silian_authService->setDatabase($Silian_db);

        return $Silian_authService;
    });

    $Silian_container->set(SupportMiddleware::class, function (ContainerInterface $Silian_c) {
        return new SupportMiddleware(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Carbon Calculator Service
    $Silian_container->set(CarbonCalculatorService::class, function (ContainerInterface $Silian_c) {
        return new CarbonCalculatorService(
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Cloudflare R2 Service
    $Silian_container->set(CloudflareR2Service::class, function (ContainerInterface $Silian_c) {
        return new CloudflareR2Service(
            $_ENV['R2_ACCESS_KEY_ID'],
            $_ENV['R2_SECRET_ACCESS_KEY'],
            $_ENV['R2_ENDPOINT'],
            $_ENV['R2_BUCKET_NAME'],
            $_ENV['R2_PUBLIC_URL'],
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Badge Service
    $Silian_container->set(BadgeService::class, function (ContainerInterface $Silian_c) {
        return new BadgeService(
            $Silian_c->get(DatabaseService::class)->getConnection(),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(StatisticsService::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new StatisticsService($Silian_db, null, null, null, $Silian_c->get(AuditLogService::class), $Silian_c->get(ErrorLogService::class));
    });

    $Silian_container->set(RegionService::class, function (ContainerInterface $Silian_c) {
        return new RegionService(null, $Silian_c->get(Logger::class), $Silian_c->get(AuditLogService::class), $Silian_c->get(ErrorLogService::class));
    });

    $Silian_container->set(LeaderboardService::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new LeaderboardService($Silian_db, $Silian_c->get(RegionService::class), $Silian_c->get(Logger::class), null, null, $Silian_c->get(AuditLogService::class), $Silian_c->get(ErrorLogService::class), $Silian_c->get(UserProfileViewService::class));
    });

    $Silian_container->set(CheckinService::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new CheckinService(
            $Silian_db,
            $Silian_c->get(Logger::class),
            null,
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(StreakLeaderboardService::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new StreakLeaderboardService(
            $Silian_db,
            $Silian_c->get(RegionService::class),
            $Silian_c->get(Logger::class),
            null,
            null,
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(UserProfileViewService::class)
        );
    });

    // AI LLM client adapter (optional if API key is not configured)
    $Silian_container->set('ai.llmClient', function () {
        $Silian_apiKey = trim((string) ($_ENV['LLM_API_KEY'] ?? ''));
        if ($Silian_apiKey === '') {
            return null;
        }

        try {
            $Silian_factory = new OpenAiFactory();
            $Silian_factory = $Silian_factory->withApiKey($Silian_apiKey);

            $Silian_handlerStack = HandlerStack::create();

            $Silian_handlerStack->push(Middleware::mapResponse(function (ResponseInterface $Silian_response) {
                $Silian_headers = array_filter(
                    array_map(static fn (string $Silian_value): string => trim($Silian_value), $Silian_response->getHeader('x-request-id')),
                    static fn (string $Silian_value): bool => $Silian_value !== ''
                );
                if ($Silian_headers !== []) {
                    return $Silian_response;
                }

                $Silian_stream = (string) $Silian_response->getBody();
                $Silian_body = json_decode($Silian_stream, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($Silian_body)) {
                    $Silian_requestId = $Silian_body['id'] ?? ($Silian_body['metadata']['request_id'] ?? null);
                    if (!is_string($Silian_requestId) || $Silian_requestId === '') {
                        try {
                            $Silian_requestId = 'llm-' . bin2hex(random_bytes(8));
                        } catch (\Throwable) {
                            $Silian_requestId = 'llm-' . bin2hex(openssl_random_pseudo_bytes(8));
                        }
                        if (!isset($Silian_body['metadata']) || !is_array($Silian_body['metadata'])) {
                            $Silian_body['metadata'] = [];
                        }
                        $Silian_body['metadata']['request_id'] = $Silian_requestId;
                        $Silian_body['id'] = $Silian_body['id'] ?? $Silian_requestId;
                        $Silian_stream = json_encode($Silian_body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: $Silian_stream;
                    }

                    return $Silian_response
                        ->withHeader('x-request-id', $Silian_requestId)
                        ->withoutHeader('Content-Length')
                        ->withBody(Utils::streamFor($Silian_stream));
                }

                return $Silian_response->withBody(Utils::streamFor($Silian_stream))->withoutHeader('Content-Length');
            }));

            $Silian_httpClient = new GuzzleClient([
                'timeout' => 15,
                'connect_timeout' => 5,
                'handler' => $Silian_handlerStack,
            ]);

            $Silian_factory = $Silian_factory->withHttpClient($Silian_httpClient);

            $Silian_baseUrl = trim((string) ($_ENV['LLM_API_BASE_URL'] ?? ''));
            if ($Silian_baseUrl !== '') {
                $Silian_factory = $Silian_factory->withBaseUri($Silian_baseUrl);
            }

            $Silian_organization = trim((string) ($_ENV['LLM_API_ORG'] ?? ''));
            if ($Silian_organization !== '') {
                $Silian_factory = $Silian_factory->withOrganization($Silian_organization);
            }

            $Silian_client = $Silian_factory->make();
        } catch (\Throwable $Silian_exception) {
            error_log('Failed to initialize OpenAI client: ' . $Silian_exception->getMessage());
            return null;
        }

        return new OpenAiClientAdapter(
            $Silian_client,
            $Silian_httpClient,
            $Silian_baseUrl !== '' ? $Silian_baseUrl : 'https://api.openai.com/v1',
            $Silian_apiKey,
            $Silian_organization !== '' ? $Silian_organization : null
        );
    });

    $Silian_container->set(AdminAiCommandRepository::class, function (ContainerInterface $Silian_c) {
        $Silian_baseDir = dirname(__DIR__, 1);
        $Silian_defaultPath = $Silian_baseDir . '/config/admin_ai_commands.php';

        $Silian_configuredPath = trim((string) ($_ENV['ADMIN_AI_COMMANDS_PATH'] ?? ''));
        $Silian_paths = [];

        if ($Silian_configuredPath !== '') {
            $Silian_isAbsolute = false;
            if (preg_match('/^[A-Za-z]:[\\\\\/]/', $Silian_configuredPath) === 1) {
                $Silian_isAbsolute = true;
            } elseif ($Silian_configuredPath[0] === '/' || $Silian_configuredPath[0] === '\\') {
                $Silian_isAbsolute = true;
            }

            if ($Silian_isAbsolute) {
                $Silian_paths[] = $Silian_configuredPath;
            } else {
                $Silian_paths[] = $Silian_baseDir . DIRECTORY_SEPARATOR . ltrim($Silian_configuredPath, '/\\');
            }
        }

        $Silian_paths[] = $Silian_defaultPath;

        return new AdminAiCommandRepository($Silian_paths);
    });

    $Silian_container->set(AdminAiIntentService::class, function (ContainerInterface $Silian_c) {
        /** @var \CarbonTrack\Services\Ai\LlmClientInterface|null $llmClient */
        $Silian_llmClient = $Silian_c->get('ai.llmClient');

        $Silian_config = [
            'model' => $_ENV['LLM_API_MODEL'] ?? null,
            'temperature' => $_ENV['LLM_API_TEMPERATURE'] ?? null,
            'max_tokens' => $_ENV['LLM_API_MAX_TOKENS'] ?? null,
        ];

        return new AdminAiIntentService(
            $Silian_llmClient,
            $Silian_c->get(LoggerInterface::class),
            $Silian_config,
            $Silian_c->get(AdminAiCommandRepository::class)->getConfig(),
            $Silian_c->get(LlmLogService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(AdminAnnouncementAiService::class, function (ContainerInterface $Silian_c) {
        /** @var \CarbonTrack\Services\Ai\LlmClientInterface|null $llmClient */
        $Silian_llmClient = $Silian_c->get('ai.llmClient');

        $Silian_config = [
            'model' => $_ENV['LLM_API_MODEL'] ?? null,
            'temperature' => $_ENV['LLM_API_TEMPERATURE'] ?? null,
            'max_tokens' => $_ENV['LLM_API_MAX_TOKENS'] ?? null,
        ];

        return new AdminAnnouncementAiService(
            $Silian_llmClient,
            $Silian_c->get(LoggerInterface::class),
            $Silian_config,
            $Silian_c->get(LlmLogService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(AdminAiReadModelService::class, function (ContainerInterface $Silian_c) {
        return new AdminAiReadModelService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(StatisticsService::class),
            $Silian_c->get(CronSchedulerService::class)
        );
    });

    $Silian_container->set(AdminAiConversationStoreService::class, function (ContainerInterface $Silian_c) {
        return new AdminAiConversationStoreService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuditLogService::class)
        );
    });

    $Silian_container->set(AdminAiWriteActionService::class, function (ContainerInterface $Silian_c) {
        return new AdminAiWriteActionService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(CronSchedulerService::class)
        );
    });

    $Silian_container->set(AdminAiResultFormatterService::class, function () {
        return new AdminAiResultFormatterService();
    });

    $Silian_container->set(UserAiService::class, function (ContainerInterface $Silian_c) {
        /** @var \CarbonTrack\Services\Ai\LlmClientInterface|null $llmClient */
        $Silian_llmClient = $Silian_c->get('ai.llmClient');

        $Silian_config = [
            'model' => $_ENV['LLM_API_MODEL'] ?? null,
            'temperature' => $_ENV['LLM_API_TEMPERATURE'] ?? null,
            'max_tokens' => $_ENV['LLM_API_MAX_TOKENS'] ?? null,
        ];

        return new UserAiService(
            $Silian_llmClient,
            $Silian_c->get(LoggerInterface::class),
            $Silian_config,
            $Silian_c->get(LlmLogService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });


    // Email Service
    $Silian_container->set(EmailService::class, function (ContainerInterface $Silian_c) {
        $Silian_frontendUrl = $_ENV['FRONTEND_URL'] ?? ($_ENV['APP_URL'] ?? '');
        $Silian_supportEmail = $_ENV['SUPPORT_EMAIL'] ?? ($_ENV['MAIL_FROM_ADDRESS'] ?? 'support@carbontrackapp.com');

        return new EmailService([
            'host' => $_ENV['MAIL_HOST'],
            'port' => (int) ($_ENV['MAIL_PORT']),
            'username' => $_ENV['MAIL_USERNAME'],
            'password' => $_ENV['MAIL_PASSWORD'] ?? 'test',
            'encryption' => $_ENV['MAIL_ENCRYPTION'] ?? 'tls',
            'from_address' => $_ENV['MAIL_FROM_ADDRESS'] ?? 'noreply@carbontrack.com',
            'from_name' => $_ENV['MAIL_FROM_NAME'] ?? 'CarbonTrack',
            'debug' => (strtolower((string) ($_ENV['APP_ENV'] ?? 'development')) !== 'production'),
            'force_simulation' => $_ENV['MAIL_SIMULATE'] ?? false,
            'smtp_debug' => isset($_ENV['MAIL_SMTP_DEBUG']) ? (int) $_ENV['MAIL_SMTP_DEBUG'] : 0,
            'subjects' => [
                'verification_code' => 'Your Verification Code',
                'password_reset' => 'Password Reset Request',
                'activity_approved' => 'Your Carbon Activity Approved!'
            ],
            'templates_path' => __DIR__ . '/../templates/emails/',
            'app_name' => $_ENV['APP_NAME'] ?? ($_ENV['MAIL_FROM_NAME'] ?? 'CarbonTrack'),
            'support_email' => $Silian_supportEmail,
            'frontend_url' => $Silian_frontendUrl,
            'reset_link_base' => $Silian_frontendUrl,
        ], $Silian_c->get(Logger::class), $Silian_c->get(NotificationPreferenceService::class), $Silian_c->get(AuditLogService::class), $Silian_c->get(ErrorLogService::class));
    });

    // Audit Log Service
    $Silian_container->set(AuditLogService::class, function (ContainerInterface $Silian_c) {
        return new AuditLogService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(Logger::class)
        );
    });

    // Error Log Service
    $Silian_container->set(ErrorLogService::class, function (ContainerInterface $Silian_c) {
        return new ErrorLogService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(Logger::class)
        );
    });



    $Silian_container->set(QuotaService::class, function (ContainerInterface $Silian_c) {
        return new QuotaService();
    });

    $Silian_container->set(QuotaConfigService::class, function () {
        return new QuotaConfigService();
    });

    $Silian_container->set(PasskeyConfig::class, function () {
        return new PasskeyConfig();
    });

    $Silian_container->set(WebauthnProviderInterface::class, function (ContainerInterface $Silian_c) {
        $Silian_nativeProvider = new NativeWebauthnProvider();
        if ($Silian_nativeProvider->isAvailable()) {
            return $Silian_nativeProvider;
        }

        return new NullWebauthnProvider($Silian_c->get(PasskeyConfig::class));
    });

    $Silian_container->set(UserPasskey::class, function (ContainerInterface $Silian_c) {
        return new UserPasskey($Silian_c->get(PDO::class));
    });

    $Silian_container->set(WebauthnChallenge::class, function (ContainerInterface $Silian_c) {
        return new WebauthnChallenge($Silian_c->get(PDO::class));
    });

    $Silian_container->set(PasskeyService::class, function (ContainerInterface $Silian_c) {
        return new PasskeyService(
            $Silian_c->get(PasskeyConfig::class),
            $Silian_c->get(UserPasskey::class),
            $Silian_c->get(WebauthnChallenge::class),
            $Silian_c->get(WebauthnProviderInterface::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(PDO::class),
            $Silian_c->get(RegionService::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->has(CloudflareR2Service::class) ? $Silian_c->get(CloudflareR2Service::class) : null,
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(UserProfileViewService::class)
        );
    });

    $Silian_container->set(AdminAiAgentService::class, function (ContainerInterface $Silian_c) {
        /** @var \CarbonTrack\Services\Ai\LlmClientInterface|null $llmClient */
        $Silian_llmClient = $Silian_c->get('ai.llmClient');

        $Silian_config = [
            'model' => $_ENV['LLM_API_MODEL'] ?? null,
            'temperature' => $_ENV['LLM_API_TEMPERATURE'] ?? null,
            'max_tokens' => $_ENV['LLM_API_MAX_TOKENS'] ?? null,
        ];

        return new AdminAiAgentService(
            $Silian_c->get(PDO::class),
            $Silian_llmClient,
            $Silian_c->get(LoggerInterface::class),
            $Silian_config,
            $Silian_c->get(AdminAiCommandRepository::class)->getConfig(),
            $Silian_c->get(LlmLogService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(StatisticsService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(AdminAiReadModelService::class),
            $Silian_c->get(AdminAiWriteActionService::class),
            $Silian_c->get(AdminAiConversationStoreService::class),
            $Silian_c->get(AdminAiResultFormatterService::class)
        );
    });

    $Silian_container->set(UserAiController::class, function (ContainerInterface $Silian_c) {
        return new UserAiController(
            $Silian_c->get(UserAiService::class),
            $Silian_c->get(CarbonCalculatorService::class),
            $Silian_c->get(QuotaService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(UserGroupService::class, function (ContainerInterface $Silian_c) {
        return new UserGroupService($Silian_c->get(QuotaConfigService::class));
    });

    $Silian_container->set(AdminUserGroupController::class, function (ContainerInterface $Silian_c) {
        return new AdminUserGroupController(
            $Silian_c->get(UserGroupService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Message Service
    $Silian_container->set(MessageService::class, function (ContainerInterface $Silian_c) {
        return new MessageService(
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(EmailService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(SupportAutomationService::class, function (ContainerInterface $Silian_c) {
        return new SupportAutomationService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(UserProfileViewService::class)
        );
    });

    $Silian_container->set(CronSchedulerService::class, function (ContainerInterface $Silian_c) {
        return new CronSchedulerService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(SupportRoutingEngineService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(LeaderboardService::class),
            $Silian_c->get(StreakLeaderboardService::class)
        );
    });

    $Silian_container->set(SupportRoutingTriageService::class, function (ContainerInterface $Silian_c) {
        /** @var \CarbonTrack\Services\Ai\LlmClientInterface|null $llmClient */
        $Silian_llmClient = $Silian_c->has('ai.llmClient') ? $Silian_c->get('ai.llmClient') : null;
        $Silian_config = [
            'model' => $_ENV['LLM_API_MODEL'] ?? null,
            'temperature' => $_ENV['LLM_API_TEMPERATURE'] ?? null,
            'max_tokens' => $_ENV['LLM_API_MAX_TOKENS'] ?? null,
        ];

        return new SupportRoutingTriageService(
            $Silian_llmClient,
            $Silian_c->get(LoggerInterface::class),
            $Silian_config,
            $Silian_c->get(LlmLogService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(SupportRoutingEngineService::class, function (ContainerInterface $Silian_c) {
        return new SupportRoutingEngineService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(SupportRoutingTriageService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(EmailService::class)
        );
    });

    $Silian_container->set(SupportTicketService::class, function (ContainerInterface $Silian_c) {
        return new SupportTicketService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(FileMetadataService::class),
            $Silian_c->get(EmailService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->has(CloudflareR2Service::class) ? $Silian_c->get(CloudflareR2Service::class) : null,
            $Silian_c->get(SupportAutomationService::class),
            $Silian_c->get(SupportRoutingEngineService::class)
        );
    });

    // Notification preferences
    $Silian_container->set(NotificationPreferenceService::class, function (ContainerInterface $Silian_c) {
        return new NotificationPreferenceService(
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(UserProfileViewService::class, function (ContainerInterface $Silian_c) {
        return new UserProfileViewService($Silian_c->get(RegionService::class));
    });

    // Turnstile Service
    $Silian_container->set(TurnstileService::class, function (ContainerInterface $Silian_c) {
        $Silian_caBundlePath = trim((string) ($_ENV['TURNSTILE_CA_BUNDLE'] ?? $_ENV['CURL_CA_BUNDLE'] ?? ''));
        $Silian_useNativeCaStore = filter_var(
            $_ENV['TURNSTILE_USE_NATIVE_CA_STORE'] ?? $_ENV['CURL_USE_NATIVE_CA_STORE'] ?? false,
            FILTER_VALIDATE_BOOLEAN
        ) === true;

        return new TurnstileService(
            $_ENV['TURNSTILE_SECRET_KEY'] ?? '',
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_caBundlePath !== '' ? $Silian_caBundlePath : null,
            $Silian_useNativeCaStore
        );
    });

    // System Log Service
    $Silian_container->set(SystemLogService::class, function (ContainerInterface $Silian_c) {
        return new SystemLogService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(Logger::class)
        );
    });

    // LLM Log Service
    $Silian_container->set(LlmLogService::class, function (ContainerInterface $Silian_c) {
        return new LlmLogService(
            $Silian_c->get(PDO::class),
            $Silian_c->get(Logger::class)
        );
    });

    // File Metadata Service (for deduplication)
    $Silian_container->set(FileMetadataService::class, function (ContainerInterface $Silian_c) {
        return new FileMetadataService();
    });

    $Silian_container->set(MultipartUploadService::class, function (ContainerInterface $Silian_c) {
        return new MultipartUploadService(
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Models
    $Silian_container->set(Avatar::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new Avatar(
            $Silian_db,
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Controllers
    $Silian_container->set(AvatarController::class, function (ContainerInterface $Silian_c) {
        return new AvatarController(
            $Silian_c->get(Avatar::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(CloudflareR2Service::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(MessageService::class)
        );
    });

    $Silian_container->set(MessageController::class, function (ContainerInterface $Silian_c) {
        return new MessageController(
            $Silian_c->get(PDO::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(UserProfileViewService::class),
            $Silian_c->get(EmailService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(UserController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new UserController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(Avatar::class),
            $Silian_c->get(NotificationPreferenceService::class),
            $Silian_c->get(TurnstileService::class),
            $Silian_c->get(EmailService::class),
            $Silian_c->get(Logger::class),
            $Silian_db,
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->has(CloudflareR2Service::class) ? $Silian_c->get(CloudflareR2Service::class) : null,
            $Silian_c->get(RegionService::class),
            $Silian_c->get(LeaderboardService::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(StreakLeaderboardService::class),
            $Silian_c->get(UserProfileViewService::class)
        );
    });

    $Silian_container->set(AuthController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new AuthController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(EmailService::class),
            $Silian_c->get(TurnstileService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->has(CloudflareR2Service::class) ? $Silian_c->get(CloudflareR2Service::class) : null,
            $Silian_c->get(Logger::class),
            $Silian_db,
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(RegionService::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(UserProfileViewService::class)
        );
    });

    $Silian_container->set(CarbonTrackController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new CarbonTrackController(
            $Silian_db,
            $Silian_c->get(CarbonCalculatorService::class),
            $Silian_c->get(MessageService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(UserProfileViewService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(CloudflareR2Service::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(QuotaService::class),
            $Silian_c->get(BadgeService::class)
        );
    });

    $Silian_container->set(CarbonActivityController::class, function (ContainerInterface $Silian_c) {
        return new CarbonActivityController(
            $Silian_c->get(CarbonCalculatorService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(SchoolController::class, function (ContainerInterface $Silian_c) {
        return new SchoolController(
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(PDO::class)
        );
    });

    $Silian_container->set(AdminController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new AdminController(
            $Silian_db,
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(StatisticsService::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(QuotaConfigService::class),
            $Silian_c->get(UserProfileViewService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->has(CloudflareR2Service::class) ? $Silian_c->get(CloudflareR2Service::class) : null
        );
    });

    $Silian_container->set(ProductController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new ProductController(
            $Silian_db,
            $Silian_c->get(MessageService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(CloudflareR2Service::class)
        );
    });

    $Silian_container->set(LeaderboardController::class, function (ContainerInterface $Silian_c) {
        return new LeaderboardController(
            $Silian_c->get(LeaderboardService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(CronSchedulerService::class)
        );
    });

    $Silian_container->set(CheckinController::class, function (ContainerInterface $Silian_c) {
        return new CheckinController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(CheckinService::class),
            $Silian_c->get(QuotaService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(PasskeyController::class, function (ContainerInterface $Silian_c) {
        return new PasskeyController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(PasskeyService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // System Log Controller
    $Silian_container->set(SystemLogController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new SystemLogController(
            $Silian_db,
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Unified Log Search Controller
    $Silian_container->set(LogSearchController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new LogSearchController(
            $Silian_db,
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    // Admin LLM Usage Controller
    $Silian_container->set(AdminLlmUsageController::class, function (ContainerInterface $Silian_c) {
        $Silian_db = $Silian_c->get(DatabaseService::class)->getConnection()->getPdo();
        return new AdminLlmUsageController(
            $Silian_db,
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(AdminAiController::class, function (ContainerInterface $Silian_c) {
        return new AdminAiController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AdminAiIntentService::class),
            $Silian_c->get(AdminAnnouncementAiService::class),
            $Silian_c->get(AdminAiCommandRepository::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(AdminAiAgentService::class)
        );
    });

    $Silian_container->set(StatsController::class, function (ContainerInterface $Silian_c) {
        return new StatsController(
            $Silian_c->get(StatisticsService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(FileUploadController::class, function (ContainerInterface $Silian_c) {
        return new FileUploadController(
            $Silian_c->get(CloudflareR2Service::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(Logger::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(FileMetadataService::class),
            $Silian_c->get(MultipartUploadService::class)
        );
    });

    $Silian_container->set(SupportTicketController::class, function (ContainerInterface $Silian_c) {
        return new SupportTicketController(
            $Silian_c->get(SupportTicketService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(TurnstileService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(SupportRoutingEngineService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(CronSchedulerService::class)
        );
    });

    $Silian_container->set(AdminSupportController::class, function (ContainerInterface $Silian_c) {
        return new AdminSupportController(
            $Silian_c->get(SupportAutomationService::class),
            $Silian_c->get(SupportTicketService::class),
            $Silian_c->get(SupportRoutingEngineService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(CronController::class, function (ContainerInterface $Silian_c) {
        return new CronController(
            $Silian_c->get(CronSchedulerService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(AuditLogService::class)
        );
    });

    $Silian_container->set(AdminCronController::class, function (ContainerInterface $Silian_c) {
        return new AdminCronController(
            $Silian_c->get(CronSchedulerService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(LoggerInterface::class),
            $Silian_c->get(ErrorLogService::class)
        );
    });

    $Silian_container->set(BadgeController::class, function (ContainerInterface $Silian_c) {
        return new BadgeController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(CloudflareR2Service::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(Logger::class)
        );
    });

    $Silian_container->set(AdminBadgeController::class, function (ContainerInterface $Silian_c) {
        return new AdminBadgeController(
            $Silian_c->get(AuthService::class),
            $Silian_c->get(BadgeService::class),
            $Silian_c->get(AuditLogService::class),
            $Silian_c->get(CloudflareR2Service::class),
            $Silian_c->get(ErrorLogService::class),
            $Silian_c->get(Logger::class)
        );
    });

    // Request Logging Middleware
    $Silian_container->set(RequestLoggingMiddleware::class, function (ContainerInterface $Silian_c) {
        return new RequestLoggingMiddleware(
            $Silian_c->get(SystemLogService::class),
            $Silian_c->get(AuthService::class),
            $Silian_c->get(Logger::class)
        );
    });
};

// If this file is included in a scope that already has a $container (e.g., tests),
// initialize it immediately for convenience. Still return the initializer for normal usage.
if (isset($Silian_container) && $Silian_container instanceof Container) {
    $Silian___deps_initializer($Silian_container);
}

return $Silian___deps_initializer;

