/**
 * Tipos del cliente de la Theme App Extension de Shopify.
 *
 * La extensión de tema expone un "app block" (Liquid) que el merchant agrega
 * desde el editor de temas sin tocar código. Ese bloque renderiza un contenedor
 * con atributos `data-*` que este cliente TypeScript lee para montar el widget
 * de shipping en la página de producto y en el carrito.
 *
 * Estos tipos son locales a la feature porque `src/shared/types/index.ts` aún
 * no existe en el repo; cuando exista, mover `ShippingRate` / `Money` allí.
 */

/** Superficie del tema donde se inyecta el widget. */
export type WidgetSurface = 'product' | 'cart';

/** Monto monetario normalizado en la mínima unidad (centavos). */
export interface Money {
  /** Valor en centavos (ej: 1299 === $12.99). Evita errores de coma flotante. */
  readonly amountCents: number;
  /** Código ISO-4217, ej: "USD". */
  readonly currency: string;
}

/** Transportistas soportados por el backend de rating. */
export type Carrier = 'UPS' | 'FEDEX' | 'USPS';

/** Una tarifa de envío devuelta por el backend. */
export interface ShippingRate {
  readonly carrier: Carrier;
  /** Nombre comercial del servicio, ej: "UPS Ground". */
  readonly serviceName: string;
  readonly cost: Money;
  /** Días hábiles estimados de tránsito, si el carrier lo informa. */
  readonly estimatedDays: number | null;
}

/** Atributos `data-*` que el app block de Liquid inyecta en el contenedor. */
export interface WidgetBlockSettings {
  readonly surface: WidgetSurface;
  /** Dominio permanente de la tienda, ej: "acme.myshopify.com". */
  readonly shopDomain: string;
  /** Base URL del backend de la app (App Proxy o API pública). */
  readonly apiBase: string;
  /** ID de producto de Shopify (solo en superficie 'product'). */
  readonly productId: number | null;
  /** Variante seleccionada inicialmente (solo en superficie 'product'). */
  readonly variantId: number | null;
  /** País destino por defecto (ISO-3166 alpha-2), ej: "US". */
  readonly destinationCountry: string;
  /** Código postal destino por defecto, si el tema lo provee. */
  readonly destinationPostalCode: string | null;
}

/** Ítem cuya tarifa se quiere calcular. */
export interface RateLineItem {
  readonly variantId: number;
  readonly quantity: number;
}

/** Destino del envío usado para pedir tarifas. */
export interface ShippingDestination {
  readonly country: string;
  readonly postalCode: string | null;
}

/** Contexto resuelto desde Shopify listo para pedir tarifas. */
export interface RateContext {
  readonly items: readonly RateLineItem[];
  readonly destination: ShippingDestination;
}

/** Payload del request al backend de rating. */
export interface RateRequest {
  readonly shopDomain: string;
  readonly surface: WidgetSurface;
  readonly items: readonly RateLineItem[];
  readonly destination: ShippingDestination;
}

/** Respuesta del backend de rating. */
export interface RateResponse {
  readonly rates: readonly ShippingRate[];
}

/** Estado interno de renderizado del widget. */
export type WidgetState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly rates: readonly ShippingRate[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string };
