(() => {
  'use strict';

  const sections = {
    '/': ['top', 'Eyad Aly — Pricing & Data Intelligence'],
    '/dashboard/': ['dashboard', 'Dashboard — Eyad Aly'],
    '/work/': ['work', 'Case study — Eyad Aly'],
    '/pricing/': ['pricing', 'Pricing study — Eyad Aly'],
    '/expertise/': ['expertise', 'Expertise — Eyad Aly'],
    '/about/': ['about', 'About — Eyad Aly'],
    '/process/': ['method', 'Process — Eyad Aly'],
    '/contact/': ['contact', 'Contact — Eyad Aly']
  };
  const legacyPaths = {
    top: '/', main: '/', dashboard: '/dashboard/', work: '/work/', pricing: '/pricing/',
    expertise: '/expertise/', about: '/about/', method: '/process/',
    contact: '/contact/'
  };
  const isHomePage = Boolean(document.getElementById('dashboard'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollBehavior = () => reducedMotion.matches ? 'auto' : 'smooth';

  const skip = event => {
    const button = event.target.closest('[data-skip-target]');
    if (!button) return;
    const target = document.getElementById(button.dataset.skipTarget);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  };
  document.addEventListener('click', skip);

  if (!isHomePage) {
    if (location.pathname === '/cv/index.html') {
      history.replaceState(null, '', '/cv/' + location.search);
    }
    if (location.hash === '#resume-main') {
      history.replaceState(null, '', location.pathname + location.search);
      window.addEventListener('load', () => document.getElementById('resume-main').scrollIntoView(), { once: true });
    }
    return;
  }

  history.scrollRestoration = 'manual';
  const routeForId = id => legacyPaths[id] || (id === 'cv' ? '/cv/' : null);
  const currentPath = () => location.pathname.replace(/index\.html$/, '') || '/';
  const visit = (path, behavior = scrollBehavior()) => {
    const route = sections[path];
    if (!route) return;
    document.title = route[1];
    document.querySelectorAll('#site-nav a[aria-current="page"]').forEach(link => link.removeAttribute('aria-current'));
    document.querySelector(`#site-nav a[href="${path}"]`)?.setAttribute('aria-current', 'page');
    if (path === '/') window.scrollTo({ top: 0, behavior });
    else document.getElementById(route[0])?.scrollIntoView({ behavior, block: 'start' });
  };

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !sections[url.pathname] || url.hash || url.search) return;
    event.preventDefault();
    if (currentPath() !== url.pathname) history.pushState(null, '', url.pathname);
    visit(url.pathname);
  });

  window.addEventListener('popstate', () => visit(currentPath(), 'auto'));
  window.addEventListener('hashchange', () => {
    const path = routeForId(location.hash.slice(1));
    if (!path) return;
    if (path === '/cv/') { location.replace(path); return; }
    history.replaceState(null, '', path);
    visit(path, 'auto');
  });

  const legacy = routeForId(location.hash.slice(1));
  if (legacy === '/cv/') { location.replace(legacy); return; }
  if (legacy) history.replaceState(null, '', legacy + location.search);
  else if (currentPath() !== location.pathname) history.replaceState(null, '', currentPath() + location.search);
  const startPath = currentPath();
  const start = () => visit(startPath, 'auto');
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
