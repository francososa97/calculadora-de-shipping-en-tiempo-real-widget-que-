/**
 * Tipos del mecanismo de activación automática del widget vía Shopify ScriptTag.
 *
 * Este módulo describe el contrato de fallback que se usa cuando el theme de la
 * tienda NO soporta App Blocks (Online Store 2.0). En esos casos, en lugar de
 * inyectar el widget mediante un app block declarado en el theme, se registra un
 * ScriptTag vía Admin API que carga el loader del widget en el storefront.
 *
 * NOTA: idealmente estos tipos vivirían en `src/shared/types/index.ts`; se definen
 * localmente porque son específicos del sub-dominio de integración Shopify.
 */

/** Versiones de la Admin API de Shopify soportadas por el servicio. */
export type ShopifyApiVersion = `${number}-${'01' | '04' | '07' | '10'}`;

/** Dominio `myshopify.com` de una tienda (p. ej. `mi-tienda.myshopify.com`). */
export type ShopDomain = string;

/** Token de acceso Admin de la app instalada en la tienda. */
export type AdminAccessToken = string;

/**
 * `display_scope` de un ScriptTag de Shopify. Determina en qué páginas se carga.
 * Usamos `online_store` porque el widget solo tiene sentido en el storefront.
 */
export type ScriptTagDisplayScope = 'online_store' | 'order_status' | 'all';

/** Momento de carga del script en la página. */
export type ScriptTagEvent = 'onload';

/** Representación de un ScriptTag tal como lo devuelve la Admin API. */
export interface ShopifyScriptTag {
  readonly id: number;
  readonly src: string;
  readonly event: ScriptTagEvent;
  readonly display_scope: ScriptTagDisplayScope;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Configuración necesaria para operar contra una tienda concreta. */
export interface ShopifyStoreConfig {
  readonly shop: ShopDomain;
  readonly accessToken: AdminAccessToken;
  readonly apiVersion: ShopifyApiVersion;
  /** URL absoluta del loader del widget (el script `loader.ts` ya compilado y servido por CDN). */
  readonly loaderUrl: string;
}

/** Resultado de evaluar si el theme activo soporta App Blocks. */
export interface AppBlockSupport {
  readonly supportsAppBlocks: boolean;
  /** ID del theme principal (rol `main`) evaluado. */
  readonly mainThemeId: number;
  /** Motivo legible por si se necesita loguear la decisión. */
  readonly reason: string;
}

/** Estado resultante de intentar garantizar la activación del widget. */
export type ActivationStrategy = 'app_block' | 'script_tag_fallback';

export interface ActivationResult {
  readonly strategy: ActivationStrategy;
  /** Presente solo cuando la estrategia fue el fallback de ScriptTag. */
  readonly scriptTag: ShopifyScriptTag | null;
  readonly reason: string;
}

/** Error tipado para fallos de la Admin API. */
export class ShopifyAdminApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;

  constructor(status: number, endpoint: string, message: string) {
    super(`Shopify Admin API ${status} en ${endpoint}: ${message}`);
    this.name = 'ShopifyAdminApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}
