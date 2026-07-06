/**
 * Taxonomía de errores del motor de cálculo de tarifas USPS.
 *
 * Todos los fallos (timeout, red, respuesta inválida, rate limit, circuito
 * abierto) se normalizan a un `UspsRateError` para que las capas superiores
 * (widget / checkout) reciban una respuesta consistente y accionable, sin
 * exponer detalles internos del proveedor. Ver E4-T3.
 */

/** Categorías estables de error expuestas hacia el resto de la app. */
export type UspsErrorCode =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE'
  | 'INVALID_REQUEST'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN';

/** Info serializable para logging/observabilidad, sin datos sensibles. */
export interface UspsErrorContext {
  readonly attempt?: number;
  readonly elapsedMs?: number;
  readonly httpStatus?: number;
  readonly [key: string]: string | number | boolean | undefined;
}

/**
 * Error base del motor USPS. Marca si el fallo es potencialmente transitorio
 * (`retryable`) para que la política de reintentos decida sin heurísticas ad-hoc.
 */
export class UspsRateError extends Error {
  public readonly code: UspsErrorCode;
  public readonly retryable: boolean;
  public readonly context: UspsErrorContext;

  public constructor(
    code: UspsErrorCode,
    message: string,
    options: {
      readonly retryable?: boolean;
      readonly cause?: unknown;
      readonly context?: UspsErrorContext;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'UspsRateError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.context = options.context ?? {};
    // Necesario al extender Error transpilando a ES5/ES2015.
    Object.setPrototypeOf(this, UspsRateError.prototype);
  }

  /** Estructura segura para responder al cliente / registrar en logs. */
  public toResponse(): {
    readonly code: UspsErrorCode;
    readonly message: string;
    readonly retryable: boolean;
  } {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export class UspsTimeoutError extends UspsRateError {
  public constructor(message: string, context?: UspsErrorContext) {
    super('TIMEOUT', message, { retryable: true, context });
    this.name = 'UspsTimeoutError';
    Object.setPrototypeOf(this, UspsTimeoutError.prototype);
  }
}

export class UspsCircuitOpenError extends UspsRateError {
  public constructor(message: string, context?: UspsErrorContext) {
    super('CIRCUIT_OPEN', message, { retryable: false, context });
    this.name = 'UspsCircuitOpenError';
    Object.setPrototypeOf(this, UspsCircuitOpenError.prototype);
  }
}

/** Type guard para distinguir nuestros errores de cualquier `unknown` capturado. */
export function isUspsRateError(value: unknown): value is UspsRateError {
  return value instanceof UspsRateError;
}

/**
 * Normaliza cualquier valor lanzado a un `UspsRateError`. Clasifica errores de
 * red / abort nativos y por código HTTP, marcando la retryabilidad adecuada.
 */
export function normalizeError(value: unknown, context?: UspsErrorContext): UspsRateError {
  if (isUspsRateError(value)) {
    return value;
  }

  if (value instanceof Error) {
    // AbortController dispara DOMException/Error con name 'AbortError'.
    if (value.name === 'AbortError') {
      return new UspsTimeoutError('La solicitud a USPS excedió el tiempo límite.', context);
    }
    const lower = value.message.toLowerCase();
    if (
      lower.includes('network') ||
      lower.includes('econnreset') ||
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('fetch failed')
    ) {
      return new UspsRateError('NETWORK', 'Fallo de red al contactar a USPS.', {
        retryable: true,
        cause: value,
        context,
      });
    }
    return new UspsRateError('UNKNOWN', value.message, { retryable: false, cause: value, context });
  }

  return new UspsRateError('UNKNOWN', 'Error desconocido en el motor USPS.', {
    retryable: false,
    cause: value,
    context,
  });
}

/** Traduce un status HTTP de USPS a un `UspsRateError` clasificado. */
export function errorFromHttpStatus(status: number, context?: UspsErrorContext): UspsRateError {
  const ctx: UspsErrorContext = { ...context, httpStatus: status };
  if (status === 429) {
    return new UspsRateError('RATE_LIMITED', 'USPS aplicó rate limiting (429).', {
      retryable: true,
      context: ctx,
    });
  }
  if (status >= 500) {
    return new UspsRateError('UPSTREAM_ERROR', `USPS devolvió un error ${status}.`, {
      retryable: true,
      context: ctx,
    });
  }
  if (status === 400 || status === 422) {
    return new UspsRateError('INVALID_REQUEST', `Solicitud rechazada por USPS (${status}).`, {
      retryable: false,
      context: ctx,
    });
  }
  return new UspsRateError('UPSTREAM_ERROR', `Respuesta HTTP inesperada de USPS (${status}).`, {
    retryable: status >= 500,
    context: ctx,
  });
}
