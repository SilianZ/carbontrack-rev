<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Models;

use CarbonTrack\Models\Message;
use PHPUnit\Framework\TestCase;

class MessageTest extends TestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        MessagePriorityStub::$lastPayload = [];
        MessagePriorityStub::$priorityColumnPresent = false;
    }

    public function testCreateSystemMessagePersistsPriorityWhenColumnAvailable(): void
    {
        MessagePriorityStub::$priorityColumnPresent = true;
        MessagePriorityStub::createSystemMessage(5, 'Broadcast', 'Body', Message::TYPE_SYSTEM, Message::PRIORITY_URGENT);

        $this->assertArrayHasKey('priority', MessagePriorityStub::$lastPayload);
        $this->assertSame(Message::PRIORITY_URGENT, MessagePriorityStub::$lastPayload['priority']);
    }

    public function testCreateSystemMessageNormalizesInvalidPriority(): void
    {
        MessagePriorityStub::$priorityColumnPresent = true;
        MessagePriorityStub::createSystemMessage(7, 'Notice', 'Content', Message::TYPE_SYSTEM, 'super-high');

        $this->assertArrayHasKey('priority', MessagePriorityStub::$lastPayload);
        $this->assertSame(Message::PRIORITY_NORMAL, MessagePriorityStub::$lastPayload['priority']);
    }

    public function testCreateSystemMessageSkipsPriorityWhenColumnMissing(): void
    {
        MessagePriorityStub::$priorityColumnPresent = false;
        MessagePriorityStub::createSystemMessage(9, 'Info', 'Body');

        $this->assertArrayNotHasKey('priority', MessagePriorityStub::$lastPayload);
    }
}

class MessagePriorityStub extends Message
{
    public static array $lastPayload = [];
    public static bool $priorityColumnPresent = false;

    protected static function priorityColumnExistsStatic(): bool
    {
        return self::$priorityColumnPresent;
    }

    public static function create(array $Silian_attributes = [])
    {
        self::$lastPayload = $Silian_attributes;
        $Silian_message = new self();
        foreach ($Silian_attributes as $Silian_key => $Silian_value) {
            $Silian_message->setAttribute($Silian_key, $Silian_value);
        }
        return $Silian_message;
    }
}
