// E1-T4 — Implementación en memoria de los puertos del wizard.
// Sirve para desarrollo local, tests y como referencia de contrato. En
// producción se reemplaza por adapters reales (DB, Shopify Admin API, ScriptTag).

import {
  Clock,
  IdGenerator,
  OnboardingRepository,
  OnboardingState,
  ShopifyConnection,
  ShopifyGateway,
  WidgetActivation,
  WidgetInstaller,
} from './types';

/** Repositorio en memoria. Clona el estado al guardar/leer para evitar aliasing. */
export class InMemoryOnboardingRepository implements OnboardingRepository {
  private readonly store = new Map<string, OnboardingState>();

  async save(state: OnboardingState): Promise<void> {
    this.store.set(state.sessionId, this.clone(state));
  }

  async findBySession(sessionId: string): Promise<OnboardingState | null> {
    const found = this.store.get(sessionId);
    return found ? this.clone(found) : null;
  }

  private clone(state: OnboardingState): OnboardingState {
    return {
      ...state,
      completedSteps: [...state.completedSteps],
      connection: state.connection ? { ...state.connection, scopes: [...state.connection.scopes] } : null,
      origin: state.origin ? { ...state.origin } : null,
      activation: state.activation
        ? { ...state.activation, enabledCarriers: [...state.activation.enabledCarriers] }
        : null,
    };
  }
}

/** Gateway de Shopify de prueba: acepta cualquier conexión con token no vacío. */
export class FakeShopifyGateway implements ShopifyGateway {
  async verifyConnection(connection: ShopifyConnection): Promise<boolean> {
    return connection.accessToken.trim().length > 0;
  }
}

/** Instalador de widget de prueba: registra las activaciones realizadas. */
export class FakeWidgetInstaller implements WidgetInstaller {
  public readonly installed: {
    shopDomain: string;
    activation: WidgetActivation;
  }[] = [];

  async install(
    connection: ShopifyConnection,
    activation: WidgetActivation,
  ): Promise<void> {
    this.installed.push({ shopDomain: connection.shopDomain, activation });
  }
}

/** Clock determinista basado en un contador monotónico (útil en tests). */
export class MonotonicClock implements Clock {
  private seconds = 0;
  nowIso(): string {
    // Base fija + incremento por llamada para timestamps ordenados y estables.
    const base = Date.parse('2026-01-01T00:00:00.000Z') + this.seconds * 1000;
    this.seconds += 1;
    return new Date(base).toISOString();
  }
}

/** Generador de IDs incremental y predecible. */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  newId(): string {
    this.counter += 1;
    return `onb_${this.counter.toString().padStart(6, '0')}`;
  }
}
