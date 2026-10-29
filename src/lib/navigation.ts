/**
 * Reglas de navegación de la barra de direcciones.
 *
 * Vive fuera de `App.tsx` para poder probarla sin montar la interfaz completa
 * (Firebase, kernel, IndexedDB…). Aquí no hay React: solo funciones puras.
 */

/** Pestañas de la aplicación. */
export type Tab =
  | 'dashboard'
  | 'home'
  | 'vpn'
  | 'blocker'
  | 'miner'
  | 'ai'
  | 'marketplace'
  | 'admin'
  | 'runtime'
  | 'favorites';

/** Motor de búsqueda que se usa cuando lo escrito no es una dirección. */
export const SEARCH_ENGINE = 'https://www.google.com/search?q=';

/** Esquemas internos que la aplicación reconoce como páginas propias. */
export const INTERNAL_SCHEMES = ['navegador://', 'navigatorx://'] as const;

/**
 * Convierte lo que el usuario escribe en la barra en algo navegable.
 *
 *  - Una dirección con esquema (`https://…`, `navegador://…`) se respeta tal cual.
 *  - Un dominio, un host:puerto, una IP o `localhost` se abren como dirección.
 *  - **Cualquier otra cosa es una búsqueda**: «mejores restaurantes» termina en Google,
 *    en vez de intentar abrir `https://mejores restaurantes` y fallar.
 */
export function resolveUserInput(input: string): string {
  const value = input.trim();
  if (!value) return '';

  // Ya trae esquema (http, navegador, runtime, file…): se usa tal cual.
  // Se exige `://` para los esquemas con autoridad; si no, `localhost:3000`
  // se confundía con un esquema llamado «localhost» y no se abría nunca.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  if (/^(about|data|mailto|tel|file|blob):/i.test(value)) return value;

  const sinEspacios = !/\s/.test(value);
  const pareceDireccion =
    sinEspacios &&
    (/^[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(value) ||
      /^localhost(:\d+)?([/?#].*)?$/i.test(value) ||
      /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#].*)?$/.test(value));

  if (pareceDireccion) return `https://${value}`;

  return `${SEARCH_ENGINE}${encodeURIComponent(value)}`;
}

/**
 * Traducción de esquemas internos a pestañas.
 *
 * Las URL internas se escriben en español (`navegador://mineria`) mientras que los
 * identificadores de pestaña están en inglés (`miner`). Sin este mapa, media docena
 * de direcciones internas se quedaban sin efecto al escribirlas en la barra.
 */
export const INTERNAL_PAGE_ALIASES: Record<string, Tab> = {
  dashboard: 'dashboard',
  inicio: 'home',
  home: 'home',
  navegar: 'home',
  vpn: 'vpn',
  bloqueador: 'blocker',
  blocker: 'blocker',
  mineria: 'miner',
  miner: 'miner',
  ia: 'ai',
  ai: 'ai',
  mercado: 'marketplace',
  marketplace: 'marketplace',
  favoritos: 'favorites',
  favorites: 'favorites',
  admin: 'admin',
  runtime: 'runtime',
  kernel: 'runtime',
};

/**
 * Devuelve la pestaña interna a la que apunta una URL `navegador://…`, o `null`
 * si no es una URL interna conocida.
 */
export function resolveInternalPage(input: string): Tab | null {
  const value = input.trim().toLowerCase();
  const scheme = INTERNAL_SCHEMES.find((candidate) => value.startsWith(candidate));
  if (!scheme) return null;

  const page = value.slice(scheme.length).split(/[/?#]/)[0];
  if (!page) return 'home';

  return INTERNAL_PAGE_ALIASES[page] ?? null;
}

/** Describe el origen de la dirección que se muestra en la barra. */
export type AddressScheme = 'internal' | 'secure' | 'insecure' | 'local';

/** Clasifica una dirección para elegir el icono y el texto accesible de la barra. */
export function addressScheme(url: string): AddressScheme {
  const value = url.trim().toLowerCase();

  if (INTERNAL_SCHEMES.some((scheme) => value.startsWith(scheme)) || value.startsWith('runtime://')) {
    return 'internal';
  }
  if (value.startsWith('https://')) return 'secure';
  if (value.startsWith('http://')) return 'insecure';
  return 'local';
}

/** Texto que anuncia el tipo de conexión (visible solo para lectores de pantalla). */
export function describeAddressScheme(scheme: AddressScheme): string {
  switch (scheme) {
    case 'internal':
      return 'Página interna de Navegador X';
    case 'secure':
      return 'Conexión segura (HTTPS)';
    case 'insecure':
      return 'Conexión sin cifrar (HTTP)';
    default:
      return 'Dirección sin esquema';
  }
}
