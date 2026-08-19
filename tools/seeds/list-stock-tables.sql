SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%alloc%' OR table_name LIKE '%stock%' OR table_name LIKE '%inventory%')
ORDER BY table_name;
