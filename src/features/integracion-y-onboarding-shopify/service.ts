import {
  ActivateWidgetInput,
  Carrier,
  ConnectStoreInput,
  EnterOriginInput,
  OnboardingProgress,
  OnboardingRepository,
  OnboardingState,
  OnboardingStep,
  ONBOARDING_STEPS,
  OriginAddress,
  Result,
  StoreConnection,
  SUPPORTED_CARRIERS,
  ValidationError,
  WidgetConfig,
  WidgetPlacement,
} from './types';

/** Implementación en memoria del repositorio (útil para tests y bootstrap). */
export class InMemoryOnboardingRepository implements OnboardingRepository {
  private readonly sessions = new Map<string, OnboardingState>();

  public find(merchantId: string): OnboardingState | null {
    return this.sessions.get(merchantId) ?? null;
  }

  public save(state: OnboardingState): void {
    this.sessions.set(state.merchantId, state);
  }
}

/** Error lanzado cuando se opera sobre una sesión inexistente. */
export class OnboardingSessionNotFoundError extends Error {
  public constructor(merchantId: string) {
    super(`No existe una sesión de onboarding para el merchant "${merchantId}".`);
    this.name = 'OnboardingSessionNotFoundError';
  }
}

/** Error lanzado cuando se ejecuta un paso fuera del orden esperado. */
export class OnboardingStepOutOfOrderError extends Error {
  public constructor(expected: OnboardingStep, attempted: OnboardingStep) {
    super(
      `Paso fuera de orden: se esperaba "${expected}" pero se intentó "${attempted}".`,
    );
    this.name = 'OnboardingStepOutOfOrderError';
  }
}

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const ACCESS_TOKEN_RE = /^(shpat_|shpca_)[A-Za-z0-9]+$/;
const US_POSTAL_RE = /^\d{5}(-\d{4})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const STATE_RE = /^[A-Za-z]{2}$/;
const VALID_PLACEMENTS: readonly WidgetPlacement[] = [
  'product-page',
  'cart-page',
  'cart-drawer',
];

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(errors: readonly ValidationError[]): Result<T> {
  return { ok: false, errors };
}

function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  const candidate = ONBOARDING_STEPS[index + 1];
  return candidate ?? null;
}

/**
 * Servicio que orquesta el wizard de onboarding autoservicio. Es un state
 * machine estricto: cada paso valida su input y sólo puede ejecutarse cuando
 * es el `currentStep` de la sesión, garantizando un avance guiado y sin saltos.
 */
export class OnboardingWizardService {
  public constructor(
    private readonly repository: OnboardingRepository = new InMemoryOnboardingRepository(),
  ) {}

  /**
   * Inicia (o recupera, de forma idempotente) la sesión de onboarding del
   * merchant. Devuelve siempre el estado vigente para poder renderizar el paso
   * en el que quedó.
   */
  public start(merchantId: string): OnboardingState {
    const existing = this.repository.find(merchantId);
    if (existing !== null) {
      return existing;
    }
    const state: OnboardingState = {
      merchantId,
      status: 'in-progress',
      currentStep: 'connect-store',
      completedSteps: [],
      store: null,
      origin: null,
      widget: null,
    };
    this.repository.save(state);
    return state;
  }

  /** Devuelve el estado actual, o `null` si el merchant no inició el wizard. */
  public getState(merchantId: string): OnboardingState | null {
    return this.repository.find(merchantId);
  }

  /** Calcula el progreso para la barra del wizard. */
  public getProgress(merchantId: string): OnboardingProgress {
    const state = this.requireSession(merchantId);
    const totalSteps = ONBOARDING_STEPS.length;
    const stepNumber = ONBOARDING_STEPS.indexOf(state.currentStep) + 1;
    const percentComplete = Math.round(
      (state.completedSteps.length / totalSteps) * 100,
    );
    return {
      currentStep: state.currentStep,
      stepNumber,
      totalSteps,
      percentComplete,
      status: state.status,
    };
  }

  /** Paso 1: conectar la tienda Shopify. */
  public connectStore(
    merchantId: string,
    input: ConnectStoreInput,
  ): Result<OnboardingState> {
    const state = this.requireSession(merchantId);
    this.expectStep(state, 'connect-store');

    const shopDomain = input.shopDomain.trim().toLowerCase();
    const accessToken = input.accessToken.trim();
    const errors: ValidationError[] = [];

    if (!SHOP_DOMAIN_RE.test(shopDomain)) {
      errors.push({
        field: 'shopDomain',
        message:
          'Ingresá un dominio válido con el formato tu-tienda.myshopify.com.',
      });
    }
    if (!ACCESS_TOKEN_RE.test(accessToken)) {
      errors.push({
        field: 'accessToken',
        message:
          'El access token de la Admin API debe comenzar con shpat_ o shpca_.',
      });
    }
    if (errors.length > 0) {
      return err(errors);
    }

    const store: StoreConnection = { shopDomain, accessToken };
    return ok(this.advance(state, 'connect-store', { store }));
  }

  /** Paso 2: ingresar la dirección de origen de los despachos. */
  public enterOrigin(
    merchantId: string,
    input: EnterOriginInput,
  ): Result<OnboardingState> {
    const state = this.requireSession(merchantId);
    this.expectStep(state, 'enter-origin');

    const origin: OriginAddress = {
      companyName: input.companyName.trim(),
      street: input.street.trim(),
      city: input.city.trim(),
      stateCode: input.stateCode.trim().toUpperCase(),
      postalCode: input.postalCode.trim().toUpperCase(),
      countryCode: input.countryCode.trim().toUpperCase(),
    };
    const errors: ValidationError[] = [];

    if (origin.companyName.length === 0) {
      errors.push({ field: 'companyName', message: 'La razón social es obligatoria.' });
    }
    if (origin.street.length === 0) {
      errors.push({ field: 'street', message: 'La calle es obligatoria.' });
    }
    if (origin.city.length === 0) {
      errors.push({ field: 'city', message: 'La ciudad es obligatoria.' });
    }
    if (!COUNTRY_RE.test(origin.countryCode)) {
      errors.push({
        field: 'countryCode',
        message: 'Usá un código de país ISO de 2 letras (ej: US).',
      });
    }
    if (!STATE_RE.test(origin.stateCode)) {
      errors.push({
        field: 'stateCode',
        message: 'Usá un código de estado/provincia de 2 letras (ej: CA).',
      });
    }
    if (origin.countryCode === 'US') {
      if (!US_POSTAL_RE.test(origin.postalCode)) {
        errors.push({
          field: 'postalCode',
          message: 'El ZIP debe tener el formato 12345 o 12345-6789.',
        });
      }
    } else if (origin.postalCode.length === 0) {
      errors.push({ field: 'postalCode', message: 'El código postal es obligatorio.' });
    }
    if (errors.length > 0) {
      return err(errors);
    }

    return ok(this.advance(state, 'enter-origin', { origin }));
  }

  /** Paso 3: configurar y activar el widget en el storefront. */
  public activateWidget(
    merchantId: string,
    input: ActivateWidgetInput,
  ): Result<OnboardingState> {
    const state = this.requireSession(merchantId);
    this.expectStep(state, 'activate-widget');

    const displayCurrency = input.displayCurrency.trim().toUpperCase();
    const errors: ValidationError[] = [];

    if (!VALID_PLACEMENTS.includes(input.placement)) {
      errors.push({
        field: 'placement',
        message: 'Elegí una ubicación válida para el widget.',
      });
    }
    if (input.carriers.length === 0) {
      errors.push({ field: 'carriers', message: 'Seleccioná al menos un carrier.' });
    }
    const seen = new Set<Carrier>();
    for (const carrier of input.carriers) {
      if (!SUPPORTED_CARRIERS.includes(carrier)) {
        errors.push({ field: 'carriers', message: `Carrier no soportado: ${carrier}.` });
      }
      if (seen.has(carrier)) {
        errors.push({ field: 'carriers', message: `Carrier duplicado: ${carrier}.` });
      }
      seen.add(carrier);
    }
    if (!CURRENCY_RE.test(displayCurrency)) {
      errors.push({
        field: 'displayCurrency',
        message: 'Usá un código de moneda ISO 4217 de 3 letras (ej: USD).',
      });
    }
    if (errors.length > 0) {
      return err(errors);
    }

    const widget: WidgetConfig = {
      placement: input.placement,
      carriers: [...input.carriers],
      displayCurrency,
      active: true,
    };
    return ok(this.advance(state, 'activate-widget', { widget }));
  }

  /**
   * Retrocede un paso sin perder los datos ya cargados, para permitir edición
   * en el wizard. No tiene efecto si la sesión ya está completada o si está en
   * el primer paso.
   */
  public goBack(merchantId: string): OnboardingState {
    const state = this.requireSession(merchantId);
    const index = ONBOARDING_STEPS.indexOf(state.currentStep);
    if (state.status === 'completed' || index <= 0) {
      return state;
    }
    const previous = ONBOARDING_STEPS[index - 1];
    const updated: OnboardingState = {
      ...state,
      currentStep: previous,
      completedSteps: state.completedSteps.filter((s) => s !== previous),
    };
    this.repository.save(updated);
    return updated;
  }

  private requireSession(merchantId: string): OnboardingState {
    const state = this.repository.find(merchantId);
    if (state === null) {
      throw new OnboardingSessionNotFoundError(merchantId);
    }
    return state;
  }

  private expectStep(state: OnboardingState, expected: OnboardingStep): void {
    if (state.currentStep !== expected) {
      throw new OnboardingStepOutOfOrderError(state.currentStep, expected);
    }
  }

  private advance(
    state: OnboardingState,
    completed: OnboardingStep,
    patch: Partial<Pick<OnboardingState, 'store' | 'origin' | 'widget'>>,
  ): OnboardingState {
    const upcoming = nextStep(completed);
    const completedSteps = state.completedSteps.includes(completed)
      ? state.completedSteps
      : [...state.completedSteps, completed];
    const status = upcoming === null ? 'completed' : 'in-progress';
    const updated: OnboardingState = {
      ...state,
      ...patch,
      completedSteps,
      currentStep: upcoming ?? completed,
      status,
    };
    this.repository.save(updated);
    return updated;
  }
}
