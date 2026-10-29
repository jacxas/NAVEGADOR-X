import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Lock,
  Shield, 
  Cpu, 
  Sparkles, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Plus, 
  LayoutGrid, 
  History, 
  Settings,
  ChevronRight,
  Wifi,
  ExternalLink,
  MessageSquare,
  ShoppingBag,
  ShieldCheck,
  LogOut,
  Languages,
  Zap,
  Gauge,
  Download,
  Scan,
  Terminal,
  User as UserIcon,
  Star,
  Ban
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { HomeView } from './components/HomeView';
import { VPNDashboard } from './components/VPNDashboard';
import { MinerDashboard } from './components/MinerDashboard';
// Los paneles que arrastran react-markdown se cargan bajo demanda: así el paquete
// inicial no incluye código que quizá no se abra nunca.
const AIChat = React.lazy(() => import('./components/AIChat').then((m) => ({ default: m.AIChat })));
import { DashboardView } from './components/DashboardView';
import { MarketplaceView } from './components/MarketplaceView';
import { BrowserMaskedPage } from './components/BrowserMaskedPage';
import { DesktopTitleBar } from './components/DesktopTitleBar';
import { AdBlockerPanel } from './components/AdBlockerPanel';
import { AdminPanel } from './components/AdminPanel';
import { TranslationModal } from './components/TranslationModal';
import { URLAutocomplete, HistoryItem } from './components/URLAutocomplete';
import { ThemeSelector, ThemeType, SwitchMode } from './components/ThemeSelector';
import { DownloadManager } from './components/DownloadManager';
import { PrivacyShield } from './components/PrivacyShield';
import { PrivacyToast } from './components/PrivacyToast';
const XRayDOMInspector = React.lazy(() =>
  import('./components/XRayDOMInspector').then((m) => ({ default: m.XRayDOMInspector })),
);
import { RuntimeInspector } from './components/RuntimeInspector';
import { BookmarksView } from './components/BookmarksView';
import { kernel } from './kernel/BrowserKernel';
import { desktopBridge, isDesktopApp, partitionForTab, SHARED_PARTITION } from './lib/desktop';
import { aiTranslate } from './lib/aiClient';
import { downloadServicePlugin } from './plugins/DownloadServicePlugin';
import { privacyServicePlugin } from './plugins/PrivacyServicePlugin';
import { auth, signInWithGoogle, logout as firebaseLogout, ensureUserProfile, db, getCachedUserSession, cacheUserSession, handleFirestoreError, OperationType } from './lib/firebase';
import { getProfileSnapshotIDB, saveProfileSnapshotIDB } from './lib/idbSession';
import { getBrowsingSession, saveBrowsingSession, TabSessionItem } from './lib/sessionPersistenceService';
import { SessionTabBar } from './components/SessionTabBar';
import { TabResourceMonitor } from './components/TabResourceMonitor';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
// Reglas de la barra de direcciones: fuera de este archivo para poder probarlas.
import {
  addressScheme,
  describeAddressScheme,
  resolveInternalPage,
  resolveUserInput,
  type Tab,
} from './lib/navigation';
import { useEscapeToClose } from './lib/a11y';

/**
 * Traduce los errores de acceso de Firebase a algo que se pueda leer y accionar.
 *
 * El más habitual en la Edición de Escritorio es `auth/unauthorized-domain`: la
 * aplicación se sirve desde el origen propio `app://bundle`, que tiene que estar
 * autorizado en la consola de Firebase para que el flujo pueda volver.
 */
function describeAuthError(error: any): string {
  const code: string = error?.code || '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Firebase rechazó el origen de la aplicación. Autoriza el dominio en Firebase Console → Authentication → Settings → Authorized domains, o usa el navegador con la Edición Web. La aplicación funciona sin cuenta.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de acceso antes de terminar. Puedes seguir usando el navegador sin cuenta.';
    case 'auth/popup-blocked':
      return 'La ventana de acceso fue bloqueada. Vuelve a intentarlo; la aplicación funciona igual sin iniciar sesión.';
    case 'auth/operation-not-allowed':
      return 'El proveedor de Google no está habilitado en este proyecto de Firebase.';
    case 'auth/network-request-failed':
      return 'No se pudo contactar con Firebase. Comprueba tu conexión; el navegador sigue funcionando sin cuenta.';
    default:
      return `No se pudo iniciar sesión${code ? ` (${code})` : ''}. La aplicación funciona con normalidad sin cuenta.`;
  }
}

/** Marcador de carga para los paneles que se descargan bajo demanda. */
function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0b0f14]">
      <div className="flex flex-col items-center gap-3">
        <RotateCw size={18} className="animate-spin text-brand-cyan" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500">{label}</span>
      </div>
    </div>
  );
}

const INITIAL_HISTORY: HistoryItem[] = [
  { id: '1', url: 'navegador://dashboard', title: 'Dashboard Navegador X', isInternal: true, visitCount: 15, category: 'Interno' },
  { id: '2', url: 'https://www.google.com/search?q=crypto+market+analysis', title: 'Google - Crypto Market Analysis', isInternal: false, visitCount: 9, category: 'Búsqueda' },
  { id: '3', url: 'https://news.ycombinator.com', title: 'Hacker News - Tech & Startups', isInternal: false, visitCount: 6, category: 'Noticias' },
  { id: '4', url: 'https://github.com', title: 'GitHub - Repositorios & Código', isInternal: false, visitCount: 12, category: 'Desarrollo' },
  { id: '5', url: 'https://coinmarketcap.com', title: 'CoinMarketCap - Precios Crypto', isInternal: false, visitCount: 8, category: 'Finanzas' },
  { id: '6', url: 'navegador://vpn', title: 'VPN X - Configuración de Red', isInternal: true, visitCount: 11, category: 'Seguridad' },
  { id: '7', url: 'navegador://mineria', title: 'Minería - Rendimiento de Rig', isInternal: true, visitCount: 7, category: 'Minería' },
  { id: '8', url: 'navegador://ia', title: 'Cortex AI Assistant', isInternal: true, visitCount: 14, category: 'Inteligencia Artificial' },
];

export default function App() {
  const [user, setUser] = useState<User | any>(() => {
    // 0ms Ultra-Fast Pre-hydration from Local Session Cache
    return auth.currentUser || getCachedUserSession();
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFastAuthLoading, setIsFastAuthLoading] = useState(false);
  /** Aviso legible cuando el acceso con Google no puede completarse. */
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [isPrivacyShieldOpen, setIsPrivacyShieldOpen] = useState(false);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [url, setUrl] = useState('navegador://dashboard');
  const [runtimeUri, setRuntimeUri] = useState('runtime://kernel');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browsingUrl, setBrowsingUrl] = useState('');

  // Navigation Stack state
  const [navHistory, setNavHistory] = useState<string[]>(['navegador://dashboard']);
  const [navHistoryIndex, setNavHistoryIndex] = useState<number>(0);

  // IndexedDB Session Persistence States
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isSessionSaved, setIsSessionSaved] = useState(true);
  const [openTabs, setOpenTabs] = useState<TabSessionItem[]>([
    {
      id: 'tab-default-1',
      title: 'Dashboard',
      url: 'navegador://dashboard',
      tabType: 'dashboard',
      isBrowsing: false,
      browsingUrl: '',
      runtimeUri: 'runtime://kernel',
      navHistory: ['navegador://dashboard'],
      navHistoryIndex: 0,
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-default-1');

  /**
   * Particiones dedicadas por pestaña. Una pestaña con entrada aquí sale por su
   * propia ruta de red y usa su propia cookie jar; el resto comparten la sesión.
   */
  const [tabPartitions, setTabPartitions] = useState<Record<string, string>>({});

  const pushNavHistory = (newUrl: string) => {
    setNavHistory((prev) => {
      const sliced = prev.slice(0, navHistoryIndex + 1);
      if (sliced[sliced.length - 1] === newUrl) return prev;
      const updated = [...sliced, newUrl];
      setNavHistoryIndex(updated.length - 1);
      return updated;
    });
  };

  const canGoBack = navHistoryIndex > 0;
  const canGoForward = navHistoryIndex < navHistory.length - 1;

  const handleGoBack = () => {
    // Con el motor real, el historial lo gobierna el propio viewport.
    if (isDesktopApp() && isBrowsing) {
      kernel.eventBus.publish('viewport.command', { action: 'back' }, 'App');
      return;
    }
    if (!canGoBack) return;
    const prevIndex = navHistoryIndex - 1;
    setNavHistoryIndex(prevIndex);
    const targetUrl = navHistory[prevIndex];
    applyUrlNavigation(targetUrl, false);
  };

  const handleGoForward = () => {
    if (isDesktopApp() && isBrowsing) {
      kernel.eventBus.publish('viewport.command', { action: 'forward' }, 'App');
      return;
    }
    if (!canGoForward) return;
    const nextIndex = navHistoryIndex + 1;
    setNavHistoryIndex(nextIndex);
    const targetUrl = navHistory[nextIndex];
    applyUrlNavigation(targetUrl, false);
  };

  const handleReload = () => {
    if (isDesktopApp() && isBrowsing) {
      kernel.eventBus.publish('viewport.command', { action: 'reload' }, 'App');
      return;
    }
    measurePageLoadSpeed();
  };

  const applyUrlNavigation = (targetUrl: string, recordInStack = true) => {
    setUrl(targetUrl);
    if (recordInStack) {
      pushNavHistory(targetUrl);
    }
    recordVisit(targetUrl);

    if (targetUrl.startsWith('runtime://')) {
      setRuntimeUri(targetUrl);
      setActiveTab('runtime');
    } else if (targetUrl.startsWith('navegador://') || targetUrl.startsWith('navigatorx://')) {
      const internalPage = targetUrl.replace('navegador://', '').replace('navigatorx://', '').split(/[/?#]/)[0];
      setIsBrowsing(false);

      if (internalPage === 'runtime' || internalPage === 'kernel') {
        setRuntimeUri('runtime://kernel');
        setActiveTab('runtime');
      } else {
        // `resolveInternalPage` entiende los alias en español; el `find` sobre las
        // pestañas mantiene funcionando cualquier identificador directo nuevo.
        const target =
          resolveInternalPage(targetUrl) ??
          (tabs.find((t) => t.id === internalPage)?.id as Tab | undefined);
        if (target) setActiveTab(target);
      }
    } else {
      // Lo que no es una dirección interna ni una URL se busca en la web.
      const cleanUrl = resolveUserInput(targetUrl);
      setUrl(cleanUrl);
      setBrowsingUrl(cleanUrl);
      setIsBrowsing(true);
      setActiveTab('home');
    }
  };

  // Autocomplete and History states
  const [history, setHistory] = useState<HistoryItem[]>(INITIAL_HISTORY);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  // Instant Translation states
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('Español');
  const [translationData, setTranslationData] = useState<{
    translatedContent: string;
    targetLanguage: string;
    url: string;
    provider?: string;
  } | null>(null);
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  // Theme Switcher states (Dark Space vs Light Aura)
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('navegadorx_theme') as ThemeType) || 'Dark Space';
  });
  const [switchMode, setSwitchMode] = useState<SwitchMode>(() => {
    return (localStorage.getItem('navegadorx_theme_mode') as SwitchMode) || 'auto_time';
  });

  const handleThemeChange = (theme: ThemeType, mode: SwitchMode) => {
    setCurrentTheme(theme);
    setSwitchMode(mode);
    localStorage.setItem('navegadorx_theme', theme);
    localStorage.setItem('navegadorx_theme_mode', mode);

    if (theme === 'Light Aura') {
      document.documentElement.classList.add('theme-light-aura');
      document.body.classList.add('theme-light-aura');
    } else {
      document.documentElement.classList.remove('theme-light-aura');
      document.body.classList.remove('theme-light-aura');
    }
  };

  useEffect(() => {
    handleThemeChange(currentTheme, switchMode);

    kernel.boot().then(async () => {
      await downloadServicePlugin.register(kernel);
      await privacyServicePlugin.register(kernel);
      console.log('[App] Kernel & Plugin Manifests loaded successfully:', kernel.listPlugins());
    });
  }, []);

  // Page Load Speed Indicator states
  const [pageLoadSpeed, setPageLoadSpeed] = useState<number | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);

  /**
   * Mediciones reales, sin cifras inventadas:
   *  - Al navegar una web en la Edición de Escritorio, el tiempo lo aporta el motor
   *    real a través del evento `viewport.loadend`.
   *  - En el resto de casos se mide el tiempo real de conmutación de la interfaz.
   */
  const measurePageLoadSpeed = (targetUrl?: string) => {
    const currentTarget = targetUrl || (isBrowsing ? browsingUrl : url);
    const isExternal = currentTarget.startsWith('http://') || currentTarget.startsWith('https://');

    if (isDesktopApp() && isBrowsing && isExternal) {
      setPageLoadSpeed(null);
      return;
    }

    setIsPageLoading(true);
    const start = performance.now();
    requestAnimationFrame(() => {
      setPageLoadSpeed(Math.round(performance.now() - start));
      setIsPageLoading(false);
    });
  };

  useEffect(() => {
    measurePageLoadSpeed(isBrowsing ? browsingUrl : url);
  }, [activeTab, isBrowsing, browsingUrl]);

  const handleInstantTranslate = async (overrideLang?: string) => {
    const langToUse = overrideLang || targetLang;
    setIsTranslating(true);
    setShowTranslationModal(true);
    
    const activeUrl = isBrowsing ? browsingUrl : url;
    
    try {
      // La clave de Gemini nunca vive en el renderer: el cliente decide entre el
      // servidor Express (edición web) y el proceso principal (edición de escritorio).
      const result = await aiTranslate(activeUrl, langToUse);

      if (!result.translatedContent) {
        throw new Error('El motor de IA no devolvió contenido de traducción');
      }

      setTranslationData({
        translatedContent: result.translatedContent,
        targetLanguage: result.targetLanguage,
        url: result.url,
        provider: result.provider,
      });
    } catch (err: any) {
      console.error('Error durante la traducción:', err);
      setTranslationData({
        translatedContent: `### Motor local de demostración [${langToUse}]\n\n**Página Web**: ${activeUrl}\n\nNo se pudo contactar con el motor de IA, así que esta es una respuesta de ejemplo y **no una traducción real del sitio**.\n\nPara obtener traducciones de verdad, configura una GEMINI_API_KEY (en el servidor de la edición web o en el panel de IA de la Edición de Escritorio).`,
        targetLanguage: langToUse,
        url: activeUrl,
        provider: 'Motor local (demostración)'
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const recordVisit = (visitedUrl: string, title?: string) => {
    setHistory((prev) => {
      const existingIndex = prev.findIndex((item) => item.url === visitedUrl);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const [item] = updated.splice(existingIndex, 1);
        return [{
          ...item,
          visitCount: (item.visitCount || 1) + 1,
        }, ...updated];
      } else {
        const isInternal = visitedUrl.startsWith('navegador://') || visitedUrl.startsWith('navigatorx://');
        return [{
          id: Date.now().toString(),
          url: visitedUrl,
          title: title || visitedUrl,
          isInternal,
          visitCount: 1,
        }, ...prev];
      }
    });
  };

  /**
   * El viewport real informa de sus navegaciones, títulos y tiempos de carga.
   * Así la barra de direcciones, el historial y el indicador de latencia reflejan
   * lo que ocurre de verdad dentro de la página.
   */
  useEffect(() => {
    const offState = kernel.eventBus.subscribe('viewport.state', (event) => {
      const payload = event.payload as { url?: string; title?: string };
      if (!payload?.url) return;
      setBrowsingUrl(payload.url);
      setUrl((previous) => (isBrowsing ? payload.url! : previous));
      recordVisit(payload.url, payload.title);
    });

    const offLoading = kernel.eventBus.subscribe('viewport.loading', (event) => {
      const payload = event.payload as { loading?: boolean };
      setIsPageLoading(Boolean(payload?.loading));
    });

    const offLoadEnd = kernel.eventBus.subscribe('viewport.loadend', (event) => {
      const payload = event.payload as { durationMs?: number };
      if (typeof payload?.durationMs === 'number') setPageLoadSpeed(payload.durationMs);
      setIsPageLoading(false);
    });

    return () => {
      offState();
      offLoading();
      offLoadEnd();
    };
  }, [isBrowsing]);

  const navigateTo = (newUrl: string) => {
    applyUrlNavigation(newUrl, true);
  };

  /**
   * Publica el estado de enrutado y atiende las peticiones del panel de red,
   * que puede montarse después (al abrir la pestaña de VPN).
   */
  useEffect(() => {
    const publishRouteState = () => {
      const dedicated = tabPartitions[activeTabId];
      kernel.eventBus.publish(
        'route.state',
        {
          activeTabId,
          activePartition: dedicated || SHARED_PARTITION,
          sharedPartition: SHARED_PARTITION,
          dedicated: Boolean(dedicated),
          dedicatedCount: Object.keys(tabPartitions).length,
        },
        'App',
      );
    };

    publishRouteState();

    const offRequest = kernel.eventBus.subscribe('route.request', () => publishRouteState());
    const offCommand = kernel.eventBus.subscribe('route.command', (event) => {
      const payload = event.payload as { action?: string; tabId?: string };
      const targetTab = payload?.tabId || activeTabId;

      if (payload?.action === 'dedicate') {
        const partition = partitionForTab(targetTab);
        void desktopBridge()?.proxy.ensure(partition);
        setTabPartitions((prev) => ({ ...prev, [targetTab]: partition }));
      } else if (payload?.action === 'share') {
        setTabPartitions((prev) => {
          const next = { ...prev };
          delete next[targetTab];
          return next;
        });
      }
    });

    return () => {
      offRequest();
      offCommand();
    };
  }, [activeTabId, tabPartitions]);

  /** Las particiones de pestañas cerradas se liberan. */
  useEffect(() => {
    setTabPartitions((prev) => {
      const openIds = new Set(openTabs.map((tab) => tab.id));
      const ids = Object.keys(prev);
      if (ids.every((id) => openIds.has(id))) return prev;
      const next: Record<string, string> = {};
      for (const id of ids) {
        if (openIds.has(id)) next[id] = prev[id];
      }
      return next;
    });
  }, [openTabs]);

  const handleAutocompleteSelect = (item: HistoryItem) => {
    setIsAutocompleteOpen(false);
    applyUrlNavigation(item.url, true);
  };

  // Restore browsing session from IndexedDB on initial mount
  useEffect(() => {
    getBrowsingSession().then((session) => {
      if (session) {
        if (session.history && session.history.length > 0) {
          setHistory(session.history);
        }
        if (session.openTabs && session.openTabs.length > 0) {
          setOpenTabs(session.openTabs);
          if (session.activeTabId) {
            setActiveTabId(session.activeTabId);
          }
        }
        setActiveTab(session.activeTab || 'dashboard');
        setUrl(session.url || 'navegador://dashboard');
        setIsBrowsing(session.isBrowsing ?? false);
        setBrowsingUrl(session.browsingUrl || '');
        setRuntimeUri(session.runtimeUri || 'runtime://kernel');
        setNavHistory(session.navHistory && session.navHistory.length > 0 ? session.navHistory : ['navegador://dashboard']);
        setNavHistoryIndex(typeof session.navHistoryIndex === 'number' ? session.navHistoryIndex : 0);
        console.log('[App] Session context restored from IndexedDB successfully');
      }
      setSessionRestored(true);
    }).catch((err) => {
      console.warn('[App] Session restoration error:', err);
      setSessionRestored(true);
    });
  }, []);

  // Continuous Auto-Save browsing session to IndexedDB
  useEffect(() => {
    if (!sessionRestored) return;

    setIsSessionSaved(false);
    const timeout = setTimeout(() => {
      saveBrowsingSession({
        activeTab,
        url,
        isBrowsing,
        browsingUrl,
        runtimeUri,
        navHistory,
        navHistoryIndex,
        history,
        openTabs,
        activeTabId,
      }).then(() => {
        setIsSessionSaved(true);
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [activeTab, url, isBrowsing, browsingUrl, runtimeUri, navHistory, navHistoryIndex, history, openTabs, activeTabId, sessionRestored]);

  // Keep active openTab item updated with current navigation context
  useEffect(() => {
    if (!sessionRestored) return;
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === activeTabId) {
          // El nombre visible sale de la barra lateral, no del identificador interno:
          // así se lee «Bloqueador» y no «blocker».
          const tabTitle = isBrowsing
            ? browsingUrl.replace(/^https?:\/\//, '').split('/')[0] || browsingUrl
            : tabs.find((t) => t.id === activeTab)?.label ?? activeTab;

          return {
            ...tab,
            tabType: activeTab,
            url: url,
            isBrowsing: isBrowsing,
            browsingUrl: browsingUrl,
            runtimeUri: runtimeUri,
            navHistory: navHistory,
            navHistoryIndex: navHistoryIndex,
            title: tabTitle
          };
        }
        return tab;
      })
    );
  }, [activeTab, url, isBrowsing, browsingUrl, runtimeUri, navHistory, navHistoryIndex, activeTabId, sessionRestored]);

  const handleSelectTab = (tabId: string) => {
    const targetTab = openTabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    setActiveTabId(tabId);
    setActiveTab(targetTab.tabType);
    setUrl(targetTab.url);
    setIsBrowsing(targetTab.isBrowsing);
    setBrowsingUrl(targetTab.browsingUrl);
    setRuntimeUri(targetTab.runtimeUri);
    setNavHistory(targetTab.navHistory);
    setNavHistoryIndex(targetTab.navHistoryIndex);
  };

  const handleCloseTab = (tabId: string) => {
    if (openTabs.length <= 1) return;
    const remaining = openTabs.filter((t) => t.id !== tabId);
    setOpenTabs(remaining);
    if (activeTabId === tabId) {
      const nextTab = remaining[remaining.length - 1];
      handleSelectTab(nextTab.id);
    }
  };

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTabItem: TabSessionItem = {
      id: newId,
      title: 'Navegar',
      url: 'navegador://inicio',
      tabType: 'home',
      isBrowsing: false,
      browsingUrl: '',
      runtimeUri: 'runtime://kernel',
      navHistory: ['navegador://inicio'],
      navHistoryIndex: 0,
    };

    setOpenTabs((prev) => [...prev, newTabItem]);
    setActiveTabId(newId);
    setActiveTab('home');
    setUrl('navegador://inicio');
    setIsBrowsing(false);
    setBrowsingUrl('');
    setNavHistory(['navegador://inicio']);
    setNavHistoryIndex(0);
  };

  /**
   * Comandos nativos: menú de la aplicación, atajos de teclado y enlaces abiertos
   * desde otra instancia llegan aquí y se traducen a acciones de la interfaz.
   */
  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;

    return bridge.onCommand((payload) => {
      switch (payload.command) {
        case 'new-tab':
          handleNewTab();
          break;
        case 'close-tab':
          handleCloseTab(activeTabId);
          break;
        case 'toggle-downloads':
          setIsDownloadsOpen(true);
          break;
        case 'back':
          handleGoBack();
          break;
        case 'forward':
          handleGoForward();
          break;
        case 'reload':
          handleReload();
          break;
        case 'stop':
          kernel.eventBus.publish('viewport.command', { action: 'stop' }, 'App');
          break;
        case 'home':
          setIsBrowsing(false);
          setActiveTab('home');
          break;
        case 'focus-url':
          document.getElementById('navx-address-input')?.focus();
          break;
        case 'open-tab':
        case 'open-url':
          if (payload.url) applyUrlNavigation(payload.url, true);
          break;
        default:
          break;
      }
    });
  }, [activeTabId, openTabs]);

  useEffect(() => {
    // Immediate sub-10ms IndexedDB profile snapshot reconciliation
    getProfileSnapshotIDB().then((snapshot) => {
      if (snapshot && !auth.currentUser) {
        setUser((prev: any) => prev || {
          uid: snapshot.uid,
          email: snapshot.email,
          displayName: snapshot.displayName,
          photoURL: snapshot.photoURL,
        });
        if (snapshot.role === 'admin' || snapshot.role === 'root' || snapshot.email === 'cryptojacxas@gmail.com') {
          setIsAdmin(true);
        }
      }
    }).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        cacheUserSession(u);
        // Async non-blocking user profile check
        ensureUserProfile(u).catch(e => console.warn(e));
        // Sync role from Firestore
        const userRef = doc(db, 'users', u.uid);
        const unsubDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const role = snap.data().role;
            const isAdminRole = role === 'admin' || role === 'root' || u.email === 'cryptojacxas@gmail.com';
            setIsAdmin(isAdminRole);
            // Save updated snapshot to IndexedDB
            saveProfileSnapshotIDB({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              role,
              cachedAt: Date.now()
            }).catch(() => {});
          }
        }, (error) => {
          console.warn('[App] User doc snapshot error:', error);
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        });
        return () => unsubDoc();
      } else {
        // Fallback check IndexedDB before clearing
        getProfileSnapshotIDB().then((snapshot) => {
          if (!snapshot) {
            setUser(null);
            setIsAdmin(false);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleFastLogin = async () => {
    setIsFastAuthLoading(true);
    const startReconciliation = performance.now();

    // 1. Sub-10ms local IndexedDB snapshot pre-reconciliation
    try {
      const cachedSnapshot = await getProfileSnapshotIDB();
      if (cachedSnapshot) {
        setUser({
          uid: cachedSnapshot.uid,
          email: cachedSnapshot.email,
          displayName: cachedSnapshot.displayName,
          photoURL: cachedSnapshot.photoURL,
        });
        if (cachedSnapshot.role === 'admin' || cachedSnapshot.role === 'root' || cachedSnapshot.email === 'cryptojacxas@gmail.com') {
          setIsAdmin(true);
        }
        console.debug(`Sub-10ms UI state reconciliation finished in ${(performance.now() - startReconciliation).toFixed(2)}ms`);
      }
    } catch (e) {
      console.warn('IDB pre-reconciliation fallback:', e);
    }

    // 2. Perform OAuth/Firebase Google Sign-In
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        setUser(loggedUser);
        cacheUserSession(loggedUser);
        
        // Save persistent profile snapshot to IndexedDB
        await saveProfileSnapshotIDB({
          uid: loggedUser.uid,
          email: loggedUser.email,
          displayName: loggedUser.displayName,
          photoURL: loggedUser.photoURL,
          role: loggedUser.email === 'cryptojacxas@gmail.com' ? 'admin' : 'user',
          cachedAt: Date.now()
        });

        if (loggedUser.email === 'cryptojacxas@gmail.com') {
          setIsAdmin(true);
        }
      }
    } catch (err: any) {
      console.error('Error durante el inicio de sesión ultrarrápido:', err);
      setAuthMessage(describeAuthError(err));
    } finally {
      setIsFastAuthLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: 'home', icon: Globe, label: 'Navegar' },
    { id: 'runtime', icon: Terminal, label: 'Runtime OS' },
    { id: 'marketplace', icon: ShoppingBag, label: 'Mercado' },
    { id: 'vpn', icon: Shield, label: 'VPN X' },
    { id: 'blocker', icon: Ban, label: 'Bloqueador' },
    { id: 'miner', icon: Cpu, label: 'Minería' },
    { id: 'ai', icon: Sparkles, label: 'IA X' },
    { id: 'favorites', icon: Star, label: 'Favoritos' },
  ] as const;

  const adminTab = { id: 'admin', icon: ShieldCheck, label: 'Admin Panel' } as const;

  useEffect(() => {
    if (activeTab === 'dashboard') setUrl('navegador://dashboard');
    if (activeTab === 'home') setUrl(isBrowsing ? browsingUrl : 'navegador://inicio');
    if (activeTab === 'runtime') setUrl(runtimeUri);
    if (activeTab === 'vpn') setUrl('navegador://vpn');
    if (activeTab === 'blocker') setUrl('navegador://bloqueador');    if (activeTab === 'miner') setUrl('navegador://mineria');
    if (activeTab === 'ai') setUrl('navegador://ia');
    if (activeTab === 'marketplace') setUrl('navegador://mercado');
    if (activeTab === 'admin') setUrl('navegador://admin');
    if (activeTab === 'favorites') setUrl('navegador://favoritos');
  }, [activeTab, isBrowsing, browsingUrl, runtimeUri]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAutocompleteOpen(false);
    applyUrlNavigation(url, true);
  };

  // Esquema de la dirección actual: decide el icono y el anuncio para lectores de pantalla.
  const addressKind = addressScheme(url);

  // Escape cierra la capa superior: primero X-Ray, después el panel contextual de IA.
  useEscapeToClose(
    isXRayOpen || (isAiOpen && activeTab !== 'ai'),
    () => {
      if (isXRayOpen) setIsXRayOpen(false);
      else setIsAiOpen(false);
    },
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-space-black text-text-main selection:bg-brand-magenta/30 selection:text-brand-cyan">
      {/* Enlace de salto: primer elemento enfocable, invisible hasta que recibe el foco. */}
      <a
        href="#navx-main"
        className="sr-only rounded-md bg-brand-cyan px-3 py-2 text-xs font-bold text-black focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100]"
      >
        Saltar al contenido
      </a>

      {/* Barra de título propia: solo aparece en la Edición de Escritorio */}
      <DesktopTitleBar />

      {authMessage && (
        <div className="flex shrink-0 items-start gap-3 border-b border-amber-500/25 bg-amber-500/[0.07] px-4 py-2">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="flex-1 text-[11px] leading-relaxed text-amber-100/90">{authMessage}</p>
          <button
            type="button"
            onClick={() => setAuthMessage(null)}
            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300/80 transition-colors hover:bg-amber-400/10 hover:text-amber-200"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col border-r border-border-subtle bg-sidebar-bg transition-all duration-300 ease-in-out z-50",
          isSidebarExpanded ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        <div className="flex h-16 items-center px-4 border-b border-border-subtle">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-grad-x">
            <span className="font-bold text-black text-xs">X</span>
          </div>
          {isSidebarExpanded && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-3 font-bold tracking-tighter text-lg"
            >
              Navegador <span className="gradient-text">X</span>
            </motion.span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-2 py-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as Tab)}
                title={tab.label}
                aria-label={tab.label}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={cn(
                  "group relative flex w-full items-center rounded-xl px-2 py-3 transition-colors",
                  activeTab === tab.id 
                    ? "bg-white/5 text-brand-cyan" 
                    : "text-gray-500 hover:text-white"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center">
                  <Icon size={20} strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                </div>
                {isSidebarExpanded && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-3 text-xs font-bold uppercase tracking-widest"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </button>
            );
          })}
          
          {/* El panel del propietario se abre siempre en la edición de escritorio:
              la documentación de titularidad no debería depender de tener sesión iniciada.
              Las secciones sensibles siguen limitadas al rol de administrador. */}
          {(isAdmin || isDesktopApp()) && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              title="Panel de administración"
              aria-label="Panel de administración"
              aria-current={activeTab === 'admin' ? 'page' : undefined}
              className={cn(
                "group relative flex w-full items-center rounded-xl px-2 py-3 transition-colors border border-brand-magenta/10",
                activeTab === 'admin' 
                  ? "bg-brand-magenta/10 text-brand-magenta" 
                  : "text-gray-600 hover:text-brand-magenta"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center">
                <ShieldCheck size={20} strokeWidth={activeTab === 'admin' ? 2 : 1.5} />
              </div>
              {isSidebarExpanded && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-3 text-xs font-bold uppercase tracking-widest"
                >
                  Admin Panel
                </motion.span>
              )}
            </button>
          )}

          {/* Privacy Shield Dashboard Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsPrivacyShieldOpen(!isPrivacyShieldOpen);
              if (!isPrivacyShieldOpen) setIsDownloadsOpen(false);
            }}
            aria-label="Privacy Shield y anti-fingerprinting"
            aria-pressed={isPrivacyShieldOpen}
            className={cn(
              "group relative flex w-full items-center rounded-xl px-2 py-3 transition-all border cursor-pointer mt-2",
              isPrivacyShieldOpen 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                : "text-gray-400 hover:text-white hover:bg-white/5 border-white/5"
            )}
            title="Privacy Shield & Anti-Fingerprinting"
          >
            <div className="flex h-8 w-8 items-center justify-center relative">
              <ShieldCheck size={20} className={isPrivacyShieldOpen ? "text-emerald-400" : ""} />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            {isSidebarExpanded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-3 flex items-center justify-between flex-1 min-w-0"
              >
                <span className="text-xs font-bold uppercase tracking-widest truncate">Privacy Shield</span>
                <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                  SHIELD
                </span>
              </motion.div>
            )}
          </button>

          {/* Downloads Manager Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsDownloadsOpen(!isDownloadsOpen);
              if (!isDownloadsOpen) setIsPrivacyShieldOpen(false);
            }}
            aria-label="Gestor de descargas"
            aria-pressed={isDownloadsOpen}
            className={cn(
              "group relative flex w-full items-center rounded-xl px-2 py-3 transition-all border border-white/5 cursor-pointer mt-1",
              isDownloadsOpen 
                ? "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center relative">
              <Download size={20} strokeWidth={isDownloadsOpen ? 2 : 1.5} />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
            </div>
            {isSidebarExpanded && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-3 flex items-center justify-between flex-1 min-w-0"
              >
                <span className="text-xs font-bold uppercase tracking-widest truncate">Descargas</span>
                <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold shrink-0">
                  GESTOR
                </span>
              </motion.div>
            )}
          </button>
        </nav>

        <div className="border-t border-border-subtle p-2 space-y-1">
          {user ? (
            <div className="px-2 py-3 space-y-2 bg-white/[0.02] rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-grad-x flex items-center justify-center text-black font-bold text-xs uppercase shrink-0 shadow-sm">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
                {isSidebarExpanded && (
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-white truncate">{user.displayName || 'Usuario'}</p>
                      <span className="flex items-center text-[7px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                        ⚡ 0ms
                      </span>
                    </div>
                    <p className="text-[8px] font-mono text-gray-500 truncate">{user.email}</p>
                  </div>
                )}
              </div>
              <button 
                type="button"
                onClick={() => firebaseLogout()}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="flex w-full items-center rounded-lg px-2 py-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <div className="flex h-4 w-6 items-center justify-center">
                  <LogOut size={13} />
                </div>
                {isSidebarExpanded && <span className="text-[9px] font-bold uppercase tracking-widest ml-1">Cerrar Sesión</span>}
              </button>
            </div>
          ) : (
            <button 
              type="button"
              onClick={handleFastLogin}
              disabled={isFastAuthLoading}
              aria-label="Iniciar sesión con Google"
              title="Iniciar sesión con Google"
              className={cn(
                "group flex w-full items-center rounded-xl px-2 py-2.5 text-brand-cyan transition-all border shadow-sm cursor-pointer",
                isFastAuthLoading
                  ? "bg-brand-cyan/20 border-brand-cyan/40 animate-pulse"
                  : "bg-brand-cyan/10 hover:bg-brand-cyan/20 border-brand-cyan/30 hover:border-brand-cyan"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center relative">
                <UserIcon size={18} className={isFastAuthLoading ? "animate-spin text-brand-cyan" : ""} />
                <Zap size={10} className="absolute -top-1 -right-1 text-amber-400 fill-amber-400 animate-pulse" />
              </div>
              {isSidebarExpanded && (
                <div className="ml-2 flex flex-col text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-cyan group-hover:tracking-[0.15em] transition-all">
                    {isFastAuthLoading ? "Iniciando..." : "Inicio Ultra-Rápido"}
                  </span>
                  <span className="text-[8px] font-mono text-gray-400">⚡ FastPass 0ms</span>
                </div>
              )}
            </button>
          )}
          {/* Estos dos botones no hacían nada al pulsarlos. Se marcan como no
              disponibles en vez de aparentar que funcionan. */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Historial completo: todavía no disponible"
            className="flex w-full cursor-not-allowed items-center rounded-xl px-2 py-3 text-gray-600 opacity-60 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center">
              <History size={18} />
            </div>
            {isSidebarExpanded && (
              <span className="ml-3 text-left text-xs font-bold uppercase tracking-widest">
                Historial
                <span className="ml-2 font-mono text-[8px] normal-case tracking-normal text-gray-500">pronto</span>
              </span>
            )}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Ajustes: todavía no disponible"
            className="flex w-full cursor-not-allowed items-center rounded-xl px-2 py-3 text-gray-600 opacity-60 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center">
              <Settings size={18} />
            </div>
            {isSidebarExpanded && (
              <span className="ml-3 text-left text-xs font-bold uppercase tracking-widest">
                Ajustes
                <span className="ml-2 font-mono text-[8px] normal-case tracking-normal text-gray-500">pronto</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Slide-out Sidebar Privacy Shield Panel */}
      <AnimatePresence>
        {isPrivacyShieldOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 340 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-full border-r border-border-subtle z-40 bg-[#111215] overflow-hidden shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
          >
            <PrivacyShield currentUrl={isBrowsing ? browsingUrl : url} onClose={() => setIsPrivacyShieldOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Sidebar Downloads Manager Panel */}
      <AnimatePresence>
        {isDownloadsOpen && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 340 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-full border-r border-border-subtle z-40 bg-[#121316] overflow-hidden shrink-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
          >
            <DownloadManager isExpanded={isDownloadsOpen} onClose={() => setIsDownloadsOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main id="navx-main" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-hidden outline-none">
        {/* IndexedDB Session Persistent Tab Bar */}
        <SessionTabBar
          openTabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
          isSessionSaved={isSessionSaved}
        />

        {/* Top bar (Address bar) */}
        <header className="flex h-10 items-center gap-4 border-b border-border-subtle bg-[#121214] px-4">
          <div className="flex items-center gap-1">
            {/* Los tres puntos son decorativos: en la Edición de Escritorio la ventana
                ya tiene su propia barra de título con los controles reales, así que
                mostrarlos aquí duplicaba los botones de ventana. */}
            {!isDesktopApp() && (
              <div className="flex space-x-1.5 mr-3" aria-hidden="true">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>
            )}

            {/* Browser Controls: Back, Forward, Reload */}
            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <button
                type="button"
                onClick={handleGoBack}
                disabled={!canGoBack}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Atrás"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleGoForward}
                disabled={!canGoForward}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                title="Adelante"
              >
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleReload}
                className="p-1 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Recargar página"
              >
                <RotateCw size={13} className={isPageLoading ? "animate-spin text-brand-cyan" : ""} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center">
            <form 
              onSubmit={handleUrlSubmit} 
              className="group relative w-full max-w-xl mx-auto flex items-center"
            >
              <div className="flex items-center bg-[#1e1e20] px-3 py-1 rounded-md border border-[#3a3a3c] w-full focus-within:border-brand-magenta/50 transition-colors">
                 {/* Icono del esquema real de la dirección. Antes había un prefijo
                     fijo «navigatorx://» que se sumaba al valor y lo duplicaba. */}
                 <span
                   className="mr-2 flex shrink-0 items-center text-gray-500"
                   title={describeAddressScheme(addressKind)}
                 >
                   {addressKind === 'internal' ? <Terminal size={11} /> : addressKind === 'secure' ? <Lock size={11} /> : <Globe size={11} />}
                   <span id="navx-address-scheme" className="sr-only">{describeAddressScheme(addressKind)}</span>
                 </span>
                 <input 
                  id="navx-address-input"
                  type="text" 
                  value={url}
                  aria-label="Barra de direcciones"
                  aria-describedby="navx-address-scheme"
                  aria-expanded={isAutocompleteOpen}
                  aria-controls="navx-address-suggestions"
                  aria-autocomplete="list"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onFocus={() => setIsAutocompleteOpen(true)}
                  onBlur={() => setTimeout(() => setIsAutocompleteOpen(false), 200)}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (!isAutocompleteOpen) setIsAutocompleteOpen(true);
                  }}
                  placeholder="Busca en Google o escribe una dirección…"
                  className="bg-transparent border-none outline-none text-[11px] w-full py-0.5 text-text-main font-mono"
                />

                {/* Page Load Speed & Translation Bar */}
                <div className="flex items-center gap-1.5 ml-2 border-l border-[#3a3a3c] pl-2.5 my-0.5 shrink-0">
                  {/* Page Load Speed Indicator */}
                  <button
                    type="button"
                    onClick={() => measurePageLoadSpeed()}
                    disabled={isPageLoading}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer border shadow-xs select-none",
                      isPageLoading
                        ? "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 animate-pulse"
                        : pageLoadSpeed === null
                        ? "bg-white/5 text-gray-500 border-white/10"
                        : pageLoadSpeed < 200
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        : pageLoadSpeed < 400
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                    )}
                    aria-label={pageLoadSpeed !== null ? `Última medición real de carga: ${pageLoadSpeed} milisegundos. Pulsa para volver a medir.` : 'Medir la latencia real de carga de la página'}
                    title={pageLoadSpeed !== null ? `Última medición real de carga: ${pageLoadSpeed} ms. Haz clic para volver a medir.` : 'Latencia real de carga de la página. Haz clic para medir.'}
                  >
                    <Zap size={10} className={cn(isPageLoading ? "animate-bounce text-brand-cyan" : (pageLoadSpeed !== null && pageLoadSpeed < 200 ? "text-emerald-400" : "text-amber-400"))} />
                    <span>{isPageLoading ? "..." : pageLoadSpeed !== null ? `${pageLoadSpeed} ms` : "medir"}</span>
                  </button>

                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Idioma de destino para la traducción"
                    className="bg-[#121214] text-[9px] text-gray-300 font-mono rounded px-1.5 py-0.5 border border-white/10 outline-none cursor-pointer hover:border-brand-cyan/40"
                    title="Idioma de destino para traducción"
                  >
                    <option value="Español">ES</option>
                    <option value="English">EN</option>
                    <option value="Français">FR</option>
                    <option value="Deutsch">DE</option>
                    <option value="Português">PT</option>
                    <option value="Italiano">IT</option>
                    <option value="日本語">JA</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleInstantTranslate()}
                    disabled={isTranslating}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase transition-all whitespace-nowrap shadow-sm cursor-pointer",
                      isTranslating
                        ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 animate-pulse"
                        : "bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 hover:border-brand-cyan"
                    )}
                    title="Traducción Instantánea con Gemini AI"
                  >
                    <Languages size={11} className={isTranslating ? "animate-spin" : ""} />
                    <span>{isTranslating ? "Traduciendo..." : "Traducir"}</span>
                  </button>
                </div>
              </div>

              {/* URL Auto-complete Dropdown */}
              <URLAutocomplete
                isOpen={isAutocompleteOpen}
                inputValue={url}
                history={history}
                onSelect={handleAutocompleteSelect}
                onClose={() => setIsAutocompleteOpen(false)}
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
             {/* Tab CPU & Memory Real-Time Resource Monitor */}
             <TabResourceMonitor
               activeTabTitle={isBrowsing ? (browsingUrl || url) : activeTab}
               activeTabType={activeTab}
               isBrowsing={isBrowsing}
             />

             {/* Theme Switcher Component */}
             <ThemeSelector
               currentTheme={currentTheme}
               switchMode={switchMode}
               onThemeChange={handleThemeChange}
             />

             <div className="flex items-center gap-1.5 border-l border-white/10 pl-3" aria-hidden="true">
               <div className="h-4 w-4 rounded-full bg-grad-x opacity-80" />
               <span className="text-[10px] font-bold text-brand-magenta tracking-widest hidden sm:inline">X CORE</span>
             </div>
             
             {/* X-Ray DOM Mode Header Quick Trigger */}
             <button
               type="button"
               onClick={() => setIsXRayOpen(!isXRayOpen)}
               aria-label="Inspector X-Ray del DOM"
               aria-pressed={isXRayOpen}
               className={cn(
                 "group flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer",
                 isXRayOpen
                   ? "bg-brand-magenta text-black shadow-[0_0_12px_rgba(255,60,172,0.4)]"
                   : "bg-brand-magenta/10 text-brand-magenta hover:bg-brand-magenta/20 border border-brand-magenta/30"
               )}
               title="Activar Modo X-Ray Inspector de DOM"
             >
               <Scan size={12} className={isXRayOpen ? "" : "animate-pulse"} />
               <span className="hidden sm:inline">X-Ray</span>
             </button>

             <button 
              type="button"
              onClick={() => setIsAiOpen(!isAiOpen)}
              aria-label="Panel contextual de IA"
              aria-pressed={isAiOpen}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer",
                isAiOpen 
                  ? "bg-brand-magenta text-black"
                  : "bg-white/5 text-gray-400 hover:text-white border border-white/5 hover:border-white/20"
              )}
             >
               <Sparkles size={12} />
               <span>IA Layer</span>
             </button>
          </div>
        </header>

        {/* Real-time Privacy Shield Interception Toast Bar */}
        <div
          className="px-4 bg-[#0d0e11] border-b border-white/5"
          role="status"
          aria-live="polite"
          aria-atomic="false"
        >
          <PrivacyToast onOpenPrivacyShield={() => setIsPrivacyShieldOpen(true)} />
        </div>

        {/* Dynamic Content */}
        <div className="relative min-h-0 flex-1 overflow-auto bg-space-black">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              id="navx-tabpanel"
              role="tabpanel"
              aria-labelledby={`navx-tab-${activeTabId}`}
              className="h-full w-full overflow-auto"
            >
              {activeTab === 'dashboard' && (
                <DashboardView 
                  onNavigate={applyUrlNavigation} 
                  onOpenDownloads={() => setIsDownloadsOpen(true)} 
                />
              )}
              {activeTab === 'home' && (
                isBrowsing 
                  ? <BrowserMaskedPage
                      url={browsingUrl}
                      partition={tabPartitions[activeTabId] || SHARED_PARTITION}
                      onExit={() => setIsBrowsing(false)}
                    /> 
                  : <HomeView onNavigate={navigateTo} />
              )}
              {activeTab === 'vpn' && <VPNDashboard />}
              {activeTab === 'blocker' && <AdBlockerPanel />}
              {activeTab === 'miner' && <MinerDashboard />}
              {activeTab === 'ai' && (
                <React.Suspense fallback={<PanelLoading label="Cargando Cortex AI" />}>
                  <AIChat
                    currentUrl={isBrowsing ? browsingUrl : undefined}
                    onOpenXRay={() => setIsXRayOpen(true)}
                  />
                </React.Suspense>
              )}
              {activeTab === 'marketplace' && <MarketplaceView />}
              {activeTab === 'favorites' && (
                <BookmarksView 
                  onNavigate={navigateTo}
                  currentUrl={isBrowsing ? browsingUrl : url}
                />
              )}
              {activeTab === 'runtime' && (
                <RuntimeInspector 
                  initialUri={runtimeUri} 
                  onNavigateUri={(newUri) => {
                    setRuntimeUri(newUri);
                    setUrl(newUri);
                  }} 
                />
              )}
              {activeTab === 'admin' && <AdminPanel />}
            </motion.div>
          </AnimatePresence>

          {/* Contextual AI Panel Overlay (Floating) */}
          <AnimatePresence>
            {isAiOpen && activeTab !== 'ai' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                role="complementary"
                aria-label="Panel contextual de IA"
                className="absolute right-6 top-6 bottom-6 w-96 z-40"
              >
                <React.Suspense fallback={<PanelLoading label="Cargando Cortex AI" />}>
                  <AIChat
                    isFloating
                    onClose={() => setIsAiOpen(false)}
                    currentUrl={isBrowsing ? browsingUrl : undefined}
                    onOpenXRay={() => setIsXRayOpen(true)}
                  />
                </React.Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full Screen X-Ray DOM Inspector Modal Overlay */}
          <AnimatePresence>
            {isXRayOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label="Inspector X-Ray del DOM"
                className="fixed inset-4 sm:inset-8 z-50 rounded-2xl overflow-hidden shadow-[0_25px_100px_rgba(0,0,0,0.9)] border border-brand-magenta/40"
              >
                <React.Suspense fallback={<PanelLoading label="Cargando inspector X-Ray" />}>
                  <XRayDOMInspector
                    currentUrl={isBrowsing ? browsingUrl : url}
                    onClose={() => setIsXRayOpen(false)}
                    onSendToAI={(prompt) => {
                      setIsXRayOpen(false);
                      setIsAiOpen(true);
                    }}
                  />
                </React.Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      </div>

      {/* Full-screen AI Chat also needs the prop */}
      {/* Search for AI tab rendering */}
      {/* activeTab === 'ai' && <AIChat /> */}

      {/* Translation Overlay Modal */}
      <TranslationModal
        isOpen={showTranslationModal}
        onClose={() => setShowTranslationModal(false)}
        data={translationData}
        isLoading={isTranslating}
        onReTranslate={(newLang) => {
          setTargetLang(newLang);
          handleInstantTranslate(newLang);
        }}
        onOpenInAi={() => {
          setIsAiOpen(true);
        }}
      />

      {/* Decorative Gradients */}
      <div className="fixed bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-brand-magenta/5 blur-[120px] pointer-events-none" />
      <div className="fixed top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-brand-cyan/5 blur-[120px] pointer-events-none" />
    </div>
  );
}
