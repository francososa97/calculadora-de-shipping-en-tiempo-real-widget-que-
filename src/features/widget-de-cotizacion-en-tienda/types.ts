// Tipos locales del Widget de Cotización en Tienda (E3).
// Cuando exista src/shared/types/index.ts, estos tipos deberían
// re-exportarse desde allí. Se mantienen aquí para que la feature sea
// autocontenida y compile en TypeScript strict.

/** Peso y dimensiones del paquete a cotizar. */
export interface Parcel {
  readonly weightKg: number;
  readonly lengthCm: number;
  readonly widthCm: number;
  readonly heightCm: number;
}

/** Datos de destino/origen necesarios para cotizar. */
export interface ShippingAddress {
  readonly countryCode: string;
  readonly postalCode: string;
}

/** Transportistas soportados. */
export type Carrier = 'UPS' | 'FedEx' | 'USPS';

/** Solicitud de cotización que el widget envía al servicio. */
export interface RateQuoteRequest {
  readonly origin: ShippingAddress;
  readonly destination: ShippingAddress;
  readonly parcel: Parcel;
}

/** Una tarifa concreta devuelta por un transportista. */
export interface ShippingRate {
  readonly carrier: Carrier;
  readonly serviceName: string;
  readonly amount: number;
  readonly currency: string;
  readonly estimatedDays: number;
}

/** Resultado de la cotización más metadata de rendimiento. */
export interface RateQuoteResult {
  readonly rates: readonly ShippingRate[];
  readonly cheapest: ShippingRate | null;
  /** Tiempo total de resolución medido por el servicio, en ms. */
  readonly elapsedMs: number;
}

/**
 * Estado del widget siguiendo el patrón de máquina de estados discriminada.
 * Permite a la UI renderizar carga / éxito / error sin banderas booleanas.
 */
export type QuoteState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly result: RateQuoteResult }
  | { readonly status: 'error'; readonly error: QuoteError };

/** Categorías de error observables por la UI. */
export type QuoteErrorKind = 'timeout' | 'network' | 'invalid_response' | 'unknown';

export interface QuoteError {
  readonly kind: QuoteErrorKind;
  readonly message: string;
}

/** Puerto de datos: cualquier fuente capaz de resolver tarifas crudas. */
export interface RateProvider {
  /**
   * Resuelve las tarifas para la solicitud dada. Debe respetar la señal de
   * aborto para poder cancelarse cuando se excede el presupuesto de tiempo.
   */
  fetchRates(request: RateQuoteRequest, signal: AbortSignal): Promise<readonly ShippingRate[]>;
}
