/**
 * Tipos del motor de cálculo de tarifas USPS.
 *
 * Este módulo modela la lógica de negocio que combina el peso del carrito con
 * la dirección de origen de la tienda y el ZIP de destino del comprador para
 * determinar la tarifa USPS correcta. No realiza llamadas HTTP: produce una
 * solicitud de tarifa normalizada y una estimación local por zonas que otras
 * capas (cliente HTTP de USPS) pueden usar o validar.
 */

/** Servicios de USPS soportados por el motor. */
export type UspsServiceCode =
  | 'USPS_GROUND_ADVANTAGE'
  | 'USPS_PRIORITY_MAIL'
  | 'USPS_PRIORITY_MAIL_EXPRESS';

/** Unidades de peso aceptadas en la entrada. Internamente se normaliza a onzas. */
export type WeightUnit = 'oz' | 'lb' | 'g' | 'kg';

/** Peso con su unidad, tal como llega del catálogo del producto. */
export interface Weight {
  readonly value: number;
  readonly unit: WeightUnit;
}

/** Ítem del carrito relevante para el cálculo de envío. */
export interface CartItem {
  readonly sku: string;
  readonly quantity: number;
  readonly weight: Weight;
}

/** Dirección de origen configurada por la tienda (warehouse / fulfillment). */
export interface OriginAddress {
  /** ZIP de 5 dígitos desde donde despacha la tienda. */
  readonly zip: string;
}

/** Dirección de destino: lo mínimo que el comprador ingresa antes del checkout. */
export interface DestinationAddress {
  /** ZIP de 5 dígitos del comprador. */
  readonly zip: string;
}

/** Entrada de alto nivel para calcular una tarifa. */
export interface RateCalculationInput {
  readonly origin: OriginAddress;
  readonly destination: DestinationAddress;
  readonly items: readonly CartItem[];
  /** Servicios a cotizar. Si se omite, se cotizan todos los soportados. */
  readonly services?: readonly UspsServiceCode[];
}

/**
 * Solicitud de tarifa normalizada, lista para enviarse al proveedor USPS.
 * Es el artefacto que combina peso agregado + origen + destino + zona.
 */
export interface UspsRateRequest {
  readonly service: UspsServiceCode;
  readonly originZip: string;
  readonly destinationZip: string;
  /** Peso total del envío normalizado a onzas. */
  readonly totalWeightOz: number;
  /** Zona USPS (1–9) derivada de la distancia entre ZIPs. */
  readonly zone: number;
}

/** Tarifa cotizada para un servicio concreto. */
export interface UspsRateQuote {
  readonly service: UspsServiceCode;
  /** Costo en centavos de USD para evitar errores de punto flotante. */
  readonly amountCents: number;
  readonly currency: 'USD';
  readonly zone: number;
  readonly totalWeightOz: number;
  /** Días hábiles estimados de entrega. */
  readonly estimatedDeliveryDays: number;
}

/** Resultado del cálculo: solicitud normalizada + cotizaciones estimadas. */
export interface RateCalculationResult {
  readonly requests: readonly UspsRateRequest[];
  readonly quotes: readonly UspsRateQuote[];
}

/** Códigos de error de validación de negocio del motor. */
export type RateCalculationErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_ORIGIN_ZIP'
  | 'INVALID_DESTINATION_ZIP'
  | 'INVALID_WEIGHT'
  | 'INVALID_QUANTITY'
  | 'WEIGHT_LIMIT_EXCEEDED'
  | 'NO_SERVICES_REQUESTED';

/** Error de dominio con código estable para que la UI lo mapee a mensajes. */
export class RateCalculationError extends Error {
  public readonly code: RateCalculationErrorCode;

  constructor(code: RateCalculationErrorCode, message: string) {
    super(message);
    this.name = 'RateCalculationError';
    this.code = code;
    // Mantiene la cadena de prototipos correcta al transpilar a ES5.
    Object.setPrototypeOf(this, RateCalculationError.prototype);
  }
}
