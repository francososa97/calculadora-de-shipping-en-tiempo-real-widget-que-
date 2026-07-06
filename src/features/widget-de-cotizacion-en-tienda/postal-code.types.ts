// Tipos del input de código postal del comprador (E3-T1).
// Framework-agnostic: el widget se embebe como <script> en páginas de
// producto y carrito de Shopify / WooCommerce, por lo que no dependemos de
// ningún framework de UI. Estos tipos se re-exportarían desde
// src/shared/types/index.ts una vez que exista ese barrel.

/** Países soportados por los carriers integrados (UPS, FedEx, USPS). */
export type SupportedCountry = 'US';

/** Contexto de la página donde se renderiza el input. */
export type WidgetContext = 'product' | 'cart';

/** Resultado de validar un código postal ingresado por el comprador. */
export interface PostalCodeValidationResult {
  /** true si el valor normalizado es un código postal válido para el país. */
  readonly isValid: boolean;
  /** Valor limpio (trim + upper) que debe persistirse / enviarse al backend. */
  readonly normalized: string;
  /** País asociado a la validación. */
  readonly country: SupportedCountry;
  /** Mensaje de error orientado al usuario, o null si isValid === true. */
  readonly error: string | null;
}

/** Payload emitido cuando el comprador confirma un código postal válido. */
export interface PostalCodeChangePayload {
  readonly postalCode: string;
  readonly country: SupportedCountry;
  readonly context: WidgetContext;
}

/** Callback invocado ante cada cambio de estado del input. */
export type PostalCodeChangeHandler = (
  payload: PostalCodeChangePayload,
) => void;

/** Opciones de configuración del input de código postal. */
export interface PostalCodeInputOptions {
  /** Elemento contenedor donde se montará el input. */
  readonly mountPoint: HTMLElement;
  /** Contexto de la página (afecta analytics y el payload emitido). */
  readonly context: WidgetContext;
  /** País del comprador. Por ahora sólo 'US'. Default: 'US'. */
  readonly country?: SupportedCountry;
  /** Valor inicial (p. ej. recuperado de localStorage). */
  readonly initialValue?: string;
  /** Texto del label. Default en español neutro. */
  readonly label?: string;
  /** Placeholder del <input>. */
  readonly placeholder?: string;
  /** Se dispara sólo cuando el código postal es válido. */
  readonly onValidChange?: PostalCodeChangeHandler;
}
