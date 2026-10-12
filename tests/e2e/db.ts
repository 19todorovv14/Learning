import pg from "pg";

/** Директен достъп до тестовата база от e2e тестовете (само за проверки). */
export async function query<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
  await client.connect();
  try {
    return (await client.query(sql, args)).rows as T[];
  } finally {
    await client.end();
  }
}
