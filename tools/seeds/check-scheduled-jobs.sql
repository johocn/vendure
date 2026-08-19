SELECT id, "queueName", state, attempts, "createdAt", "updatedAt", "startedAt", "settledAt", "isSettled"
FROM job_record
WHERE "queueName" IN ('order-timeout','order-timeout-compensation')
ORDER BY id DESC
LIMIT 20;
