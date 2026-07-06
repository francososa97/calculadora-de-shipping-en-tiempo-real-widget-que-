/**
 * Tipos del flujo de onboarding guiado autoservicio (E1-T4).
 *
 * El wizard lleva al merchant por 3 pasos secuenciales sin soporte humano:
 *   1. connect-store  -> conectar la tienda Shopify (OAuth)
 *   2. set-origin     -> ingresar la dirección de origen del envío
 *   3. activate-widget -> activar el widget de shipping en el storefront
 *
 * Estos tipos normalmente vivirían en src/shared/types/index.ts y se
 * reexportarían; se definen aquí porque el proyecto aún no tiene ese módulo.
 */

/** Identificadores estables de cada paso, en orden de ejecución. */
export type OnboardingStepId = 'connect-store' | 'set-origin' | 'activate-widget';

/** Orden canónico de los pasos del wizard. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
  'connect-store',
  'set-origin',
  'activate-widget',
] as const;

/** Estado de un paso individual dentro del wizard. */
export type StepStatus = 'pending' | 'active' | 'completed';

/** Datos capturados al conectar la tienda Shopify vía OAuth. */
export interface StoreConnection {
  readonly shopDomain: string;
  readonly accessToken: string;
}

/** Dirección de origen desde donde el merchant despacha los paquetes. */
export interface OriginAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

/** Configuración de activación del widget en el storefront. */
export interface WidgetActivation {
  readonly enabled: boolean;
  readonly placement: 'cart' | 'product-page';
}

/**
 * Payload aceptado por cada paso al ejecutar `submitStep`.
 * El discriminante `stepId` garantiza que el data coincida con el paso.
 */
export type StepSubmission =
  | { readonly stepId: 'connect-store'; readonly data: StoreConnection }
  | { readonly stepId: 'set-origin'; readonly data: OriginAddress }
  | { readonly stepId: 'activate-widget'; readonly data: WidgetActivation };

/** Datos acumulados por el wizard a medida que avanza el merchant. */
export interface OnboardingData {
  connection?: StoreConnection;
  origin?: OriginAddress;
  widget?: WidgetActivation;
}

/** Vista de un paso para renderizar la UI del wizard. */
export interface StepView {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly status: StepStatus;
  readonly index: number;
}

/** Snapshot completo del estado del wizard para la capa de presentación. */
export interface OnboardingState {
  readonly steps: readonly StepView[];
  readonly currentStep: OnboardingStepId | null;
  readonly completed: boolean;
  readonly progress: number;
  readonly data: OnboardingData;
}

/** Error de validación devuelto al enviar un paso inválido. */
export class OnboardingValidationError extends Error {
  public readonly stepId: OnboardingStepId;
  public readonly issues: readonly string[];

  constructor(stepId: OnboardingStepId, issues: readonly string[]) {
    super(`Validación fallida en el paso "${stepId}": ${issues.join(', ')}`);
    this.name = 'OnboardingValidationError';
    this.stepId = stepId;
    this.issues = issues;
  }
}
