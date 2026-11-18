/**
 * Guía para instalar el juego como app en el móvil (Android e iPhone).
 *
 * - Se muestra sola la primera vez que se abre el juego en el navegador.
 * - No se muestra si el juego ya está abierto como app instalada.
 * - Después se puede volver a abrir con el botón "Cómo instalar la app".
 *
 * La marca de "ya la he visto" se guarda en el navegador. Si el navegador no
 * deja guardarla (modo privado, datos bloqueados), la guía simplemente
 * aparecerá otra vez: no pasa nada grave.
 */

type Plataforma = 'android' | 'iphone';

const CLAVE_VISTA = 'mr-guia-instalar-vista';

function yaEstaInstalada(): boolean {
  const esStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  // iOS usa una propiedad propia en lugar de display-mode.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return esStandalone || iosStandalone;
}

function esIphone(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function yaLaVio(): boolean {
  try {
    return localStorage.getItem(CLAVE_VISTA) === '1';
  } catch {
    return false;
  }
}

function marcarComoVista(): void {
  try {
    localStorage.setItem(CLAVE_VISTA, '1');
  } catch {
    /* Sin almacenamiento: la guía volverá a salir, sin más consecuencias. */
  }
}

export function iniciarGuiaInstalar(): void {
  const guia = document.getElementById('screen-instalar');
  const botonAbrir = document.getElementById('btn-instalar');
  if (!guia) return;

  const botonesPlataforma = guia.querySelectorAll<HTMLButtonElement>('[data-plataforma]');
  const listas: Record<Plataforma, HTMLElement | null> = {
    android: document.getElementById('guia-android'),
    iphone: document.getElementById('guia-iphone'),
  };

  const mostrarPlataforma = (p: Plataforma): void => {
    (Object.keys(listas) as Plataforma[]).forEach((k) => {
      const lista = listas[k];
      if (lista) lista.hidden = k !== p;
    });
    botonesPlataforma.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.plataforma === p));
    });
  };

  const abrir = (): void => guia.classList.add('active');
  const cerrar = (): void => {
    guia.classList.remove('active');
    marcarComoVista();
  };

  botonesPlataforma.forEach((b) => {
    b.addEventListener('click', () => mostrarPlataforma(b.dataset.plataforma as Plataforma));
  });
  guia.querySelectorAll<HTMLElement>('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
  botonAbrir?.addEventListener('click', abrir);

  // Primera visita: primero la pestaña del móvil que estamos usando.
  mostrarPlataforma(esIphone() ? 'iphone' : 'android');
  if (!yaEstaInstalada() && !yaLaVio()) abrir();
}
