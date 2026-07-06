/**
 * Tipos del flujo de onboarding guiado autoservicio (E1-T4).
 *
 * El merchant completa tres pasos sin soporte humano:
 *   1. Conectar la tienda Shopify.
 *   2. Ingresar la direccion de origen de los envios.
 *   3. Activar el widget en el storefront.
 *
 * NOTA: cuando `src/shared/types/index.ts` exista, los tipos genericos
 * (`Result`, `Address`, etc.) deberian reexportarse desde alli. Se definen
 * aqui de forma autocontenida para que el modulo compile de forma aislada.
 */

/** Pasos del wizard, en el orden en que deben completarse. */
export enum OnboardingStep {
  ConnectStore = 'CONNECT_STORE',
  SetOrigin = 'SET_ORIGIN',
  ActivateWidget = 'ACTIVATE_WIDGET',
  Completed = 'COMPLETED',
}

/** Orden canonico de los pasos accionables (excluye el estado terminal). */
export const STEP_SEQUENCE: readonly OnboardingStep[] = [
  OnboardingStep.ConnectStore,
  OnboardingStep.SetOrigin,
  OnboardingStep.ActivateWidget,
] as const;

/** Resultado discriminado para operaciones que pueden fallar por validacion. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/** Credenciales de la tienda Shopify obtenidas tras el OAuth. */
export interface StoreConnection {
  /** Dominio myshopify, ej. "mi-tienda.myshopify.com". */
  readonly shopDomain: string;
  /** Access token de la Admin API. */
  readonly accessToken: string;
}

/** Direccion de origen desde donde se despachan los paquetes. */
export interface OriginAddress {
  readonly line1: string;
  readonly city: string;
  /** Codigo de estado/provincia (ej. "CA"). */
  readonly stateCode: string;
  readonly postalCode: string;
  /** Codigo de pais ISO 3166-1 alpha-2 (ej. "US"). */
  readonly countryCode: string;
}

/** Configuracion del widget al activarse en el storefront. */
export interface WidgetActivation {
  /** Carriers habilitados para cotizar. */
  readonly carriers: readonly Carrier[];
  /** Si se muestra el widget en la pagina de producto ademas del carrito. */
  readonly showOnProductPage: boolean;
}

export type Carrier = 'UPS' | 'FEDEX' | 'USPS';

/** Estado persistente del onboarding de un merchant. */
export interface OnboardingState {
  readonly merchantId: string;
  readonly currentStep: OnboardingStep;
  readonly store: StoreConnection | null;
  readonly origin: OriginAddress | null;
  readonly widget: WidgetActivation | null;
  /** Timestamp ISO-8601 de la ultima actualizacion. */
  readonly updatedAt: string;
}

/** Vista que consume la UI del wizard para renderizar el progreso. */
export interface OnboardingProgress {
  readonly merchantId: string;
  readonly currentStep: OnboardingStep;
  readonly completedSteps: readonly OnboardingStep[];
  readonly totalSteps: number;
  /** Porcentaje 0-100 de avance. */
  readonly percentComplete: number;
  readonly isComplete: boolean;
}

/** Persistencia del estado de onboarding (implementable con DB, KV, etc.). */
export interface OnboardingRepository {
  find(merchantId: string): Promise<OnboardingState | null>;
  save(state: OnboardingState): Promise<OnboardingState>;
}

/** Reloj inyectable para timestamps deterministas en tests. */
export interface Clock {
  nowIso(): string;
}
