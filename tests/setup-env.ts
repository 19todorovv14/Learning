import "dotenv/config";

// Всички тестове работят срещу тестовата база — никога срещу основната.
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
(process.env as Record<string, string>).NODE_ENV = "test";
