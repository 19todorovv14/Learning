/** Временна грешка (мрежа, 429, 5xx, maxlag) — задачата се опитва отново по-късно. */
export class RetryableError extends Error {
  constructor(
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Окончателна грешка (няма резултати, твърде кратък текст, невалиден отговор) — не се повтаря автоматично. */
export class PermanentError extends Error {}

/** Липсва настройка (напр. ANTHROPIC_API_KEY) — елементът чака администратор, без автоматични повторения. */
export class BlockedError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
