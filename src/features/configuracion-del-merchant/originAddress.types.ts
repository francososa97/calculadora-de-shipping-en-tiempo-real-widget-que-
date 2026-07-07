/**
 * Tipos del dominio de dirección de origen del merchant.
 *
 * La dirección de origen (origin/ship-from) es requerida por las APIs de
 * UPS, FedEx y USPS para poder cotizar tarifas reales. Debe estar validada
 * y completa antes de habilitar el cálculo de tarifas (E2-T2).
 *
 * Nota: idealmente estos tipos vivirían en `src/shared/types/index.ts` y se
 * reexportarían desde acá; mientras ese barrel no exista, se definen local a
 * la feature para mantener el código funcional y sin dependencias rotas.
 */

/** Código de país ISO 3166-1 alpha-2 soportado por los carriers integrados. */
export type CountryCode = 'US';

/**
 * Dirección de origen tal como la ingresa el merchant en la configuración.
 * Todos los campos son opcionales en la entrada porque el formulario puede
 * enviarse parcial: la validación es la que determina completitud.
 */
export interface OriginAddressInput {
  readonly contactName?: string;
  readonly street1?: string;
  readonly street2?: string;
  readonly city?: string;
  /** Estado/provincia. Para US se espera código de 2 letras (ej. "CA"). */
  readonly state?: string;
  /** Código postal. Para US se espera ZIP de 5 dígitos o ZIP+4. */
  readonly postalCode?: string;
  readonly country?: string;
  /** Teléfono de contacto en origen; algunos carriers lo exigen para pickups. */
  readonly phone?: string;
}

/**
 * Dirección de origen ya validada y normalizada. Este es el único tipo que
 * las capas de cotización deberían aceptar, garantizando en tiempo de
 * compilación que la dirección pasó por la validación.
 */
export interface ValidatedOriginAddress {
  readonly contactName: string;
  readonly street1: string;
  readonly street2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: CountryCode;
  readonly phone: string | null;
}

/** Campos que pueden producir un error de validación. */
export type OriginAddressField =
  | 'contactName'
  | 'street1'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'country'
  | 'phone';

/** Código estable de error, apto para i18n y para lógica del cliente. */
export type OriginAddressErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'INVALID_STATE'
  | 'INVALID_POSTAL_CODE'
  | 'UNSUPPORTED_COUNTRY'
  | 'INVALID_PHONE';

/** Detalle de un error de validación individual. */
export interface OriginAddressError {
  readonly field: OriginAddressField;
  readonly code: OriginAddressErrorCode;
  readonly message: string;
}

/**
 * Resultado discriminado de la validación. `valid: true` garantiza que
 * `address` es una `ValidatedOriginAddress`; `valid: false` expone la lista
 * de errores para mostrar en el formulario del merchant.
 */
export type OriginAddressValidationResult =
  | { readonly valid: true; readonly address: ValidatedOriginAddress }
  | { readonly valid: false; readonly errors: readonly OriginAddressError[] };
