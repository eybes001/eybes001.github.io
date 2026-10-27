(() => {
  'use strict';
  const data = window.RETAIL_DATA;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const node = (tag, className = '', value) => { const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = String(value); return el; };
  const put = (selector, value) => { const el = $(selector); if (el) el.textContent = String(value); };
  const count = n => new Intl.NumberFormat('en-GB').format(n || 0);
  const money = n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(n || 0);
  const compact = n => { const abs = Math.abs(n || 0); return abs >= 1e6 ? `£${(n / 1e6).toFixed(2)}m` : abs >= 1e3 ? `£${(n / 1e3).toFixed(1)}k` : money(n); };
  const percent = n => n == null ? '—' : `${(n * 100).toFixed(1)}%`;
  let tab = 'overview';
  let ranking = 'net';
  const allowedTabs = ['overview', 'products', 'customers', 'quality'];
  const allowedRankings = ['net', 'credits'];
  const shareUrl = () => {
    const url = new URL('/dashboard/', location.origin);
    url.searchParams.set('tab', tab);
    url.searchParams.set('period', $('#period-select').value);
    url.searchParams.set('market', $('#market-select').value);
    if (tab === 'products') url.searchParams.set('ranking', ranking);
    return url;
  };
  const syncUrl = () => {
    if (location.pathname.replace(/index\.html$/, '') === '/dashboard/') {
      history.replaceState(null, '', shareUrl().pathname + shareUrl().search);
    }
  };
  const restoreUrl = () => {
    if (location.pathname.replace(/index\.html$/, '') !== '/dashboard/') return;
    const params = new URLSearchParams(location.search);
    const period = params.get('period'), market = params.get('market');
    if (period && [...$('#period-select').options].some(option => option.value === period)) $('#period-select').value = period;
    if (market && [...$('#market-select').options].some(option => option.value === market)) $('#market-select').value = market;
    const nextRanking = params.get('ranking');
    ranking = allowedRankings.includes(nextRanking) ? nextRanking : 'net';
    $$('[data-ranking]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ranking === ranking)));
    const nextTab = params.get('tab');
    activate(allowedTabs.includes(nextTab) ? nextTab : 'overview');
    render();
  };
  const menu = $('.menu-toggle');
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); $('.site-nav').classList.toggle('is-open', open); });
  $$('#site-nav a').forEach(link => link.addEventListener('click', () => { menu.setAttribute('aria-expanded', 'false'); $('.site-nav').classList.remove('is-open'); }));
  if (!data) { $('.dashboard-shell').textContent = 'Dashboard data is unavailable. Rebuild it with the processing pipeline in README.md.'; return; }
  const view = () => data.views[`${$('#period-select').value}:${$('#market-select').value}`];
  function renderTrend(v) {
    const target = $('#trend-chart'); target.replaceChildren();
    const max = Math.max(1, ...v.trend.map(row => Math.max(0, row.net)));
    for (const row of v.trend) {
      const col = node('div', 'trend-col');
      const label = row.month.slice(5) === '12' ? `Dec ’${row.month.slice(2, 4)}` : new Date(`${row.month}-01T12:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
      col.title = `${row.month}: ${money(row.net)} net`;
      const value = node('span', '', compact(row.net));
      const bar = node('i'); bar.style.height = `${Math.max(2, Math.max(0, row.net) / max * 145)}px`;
      col.append(value, bar, node('small', '', label)); target.append(col);
    }
    target.setAttribute('aria-label', `Monthly net revenue: ${v.trend.map(r => `${r.month} ${money(r.net)}`).join('; ')}`);
  }
  function renderMarkets(v) {
    const target = $('#market-bars'); target.replaceChildren();
    const rows = v.countries.filter(r => r.net > 0).slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r.net));
    for (const row of rows) {
      const item = node('div', 'market-row'); const heading = node('div');
      heading.append(node('span', '', row.country), node('b', '', compact(row.net)));
      const track = node('div', 'market-track'), fill = node('i'); fill.style.width = `${row.net / max * 100}%`; track.append(fill); item.append(heading, track); target.append(item);
    }
  }
  function renderProducts(v) {
    put('#positive-skus', count(v.summary.positive_skus)); put('#abc-skus', count(v.summary.abc80_count)); put('#top20-share', percent(v.summary.top20_share));
    const target = $('#product-rows'); target.replaceChildren();
    const rows = ranking === 'credits' ? v.credit_products : v.products;
    rows.forEach((row, i) => { const tr = node('tr'); const product = node('td'); product.append(node('b', '', row.description || 'Unnamed product'), node('small', '', row.sku));
      [i + 1, product, money(row.net), money(row.gross), money(row.credits), count(row.orders)].forEach(value => { if (value instanceof Node) tr.append(value); else tr.append(node('td', '', value)); }); target.append(tr); });
  }
  const segmentNotes = { 'Champions': 'Recent buyers with five or more observed orders.', 'Loyal buyers': 'Repeat buyers outside the champion rule.', 'Recent first order': 'One observed order in the last 30 days.', 'High-value, inactive': 'Top-quartile observed spend; no order for over 90 days.', 'Other inactive': 'No observed order for over 90 days.', 'Developing': 'One observed order; not recently active.' };
  function renderCustomers(v) {
    put('#buyer-count', count(v.customer.customers)); put('#repeat-share', percent(v.summary.repeat_share)); put('#identified-share', percent(v.summary.identified_share));
    const target = $('#segments'); target.replaceChildren(); const max = Math.max(1, ...v.segments.map(r => r.customers));
    for (const row of v.segments) { const card = node('article', 'segment-card'); const track = node('div', 'track'), fill = node('i'); fill.style.width = `${row.customers / max * 100}%`; track.append(fill); card.append(node('span', '', row.label), node('strong', '', `${count(row.customers)} buyers`), node('small', '', `${money(row.gross)} gross observed spend`), track, node('p', '', segmentNotes[row.label] || 'Observed buyer group.')); target.append(card); }
  }
  function renderQuality() {
    const labels = { sale: 'Merchandise sales', credit: 'Cancellation credits', duplicate: 'Exact duplicates', non_merchandise: 'Non-merchandise', nonpositive_price: 'Nonpositive price', other_adjustment: 'Other adjustments' };
    const target = $('#quality-waterfall'); target.replaceChildren();
    const total = node('div', 'quality-item'); total.append(node('span', '', 'SOURCE LINES'), node('strong', '', count(data.source.raw_rows)), node('small', '', 'Original workbook')); target.append(total);
    for (const row of data.quality) { const card = node('div', 'quality-item'); card.append(node('span', '', labels[row.disposition] || row.disposition), node('strong', '', count(row.rows)), node('small', '', `${compact(row.amount)} signed value`)); target.append(card); }
    const facts = $('#quality-facts'); facts.replaceChildren();
    [['Source rows', count(data.source.raw_rows)], ['Accepted ledger lines', count(data.source.ledger_rows)], ['Rows without customer ID', count(data.profile.missing_customer_rows)], ['Source SHA-256', `${data.source.sha256.slice(0, 12)}…`]].forEach(([label, value]) => { const row = node('div', 'fact'); row.append(node('span', '', label), node('strong', '', value)); facts.append(row); });
    const checks = $('#validation-checks'); checks.replaceChildren(); data.profile.checks.forEach(item => { const row = node('div', 'check'); row.append(node('b', '', '✓'), node('span', '', item.name)); checks.append(row); });
    const exceptions = $('#exception-rows'); exceptions.replaceChildren(); data.exceptions.slice(0, 12).forEach(row => { const tr = node('tr'); [row.source_row, row.invoice, row.sku, labels[row.disposition] || row.disposition, money(row.signed_value)].forEach(value => tr.append(node('td', '', value))); exceptions.append(tr); });
  }
  function render() {
    const v = view(); if (!v) return;
    const period = data.periods.find(x => x.id === v.period), market = data.markets.find(x => x.id === v.market);
    put('#scope-label', `${period.label} · ${market.label}`); put('#scope-foot', `${period.label} · ${market.label}`); put('#date-label', `${v.start} → ${v.end}`);
    put('#kpi-net', compact(v.summary.net)); put('#kpi-gross', compact(v.summary.gross)); put('#kpi-credits', compact(v.summary.credits)); put('#kpi-orders', count(v.summary.orders)); put('#credit-rate', `${percent(v.summary.credit_ratio)} of gross sales`);
    put('#revenue-bridge', `${money(v.summary.gross)} gross − ${money(v.summary.credits)} credits = ${money(v.summary.net)} net`);
    put('#scope-detail', `${count(v.summary.lines)} ledger lines · ${count(v.summary.countries)} markets · ${count(v.summary.skus)} SKUs`);
    renderTrend(v); renderMarkets(v); renderProducts(v); renderCustomers(v);
  }
  function activate(next) {
    tab = next; const titles = { overview: 'Executive overview', products: 'Product portfolio', customers: 'Customer signals', quality: 'Data quality & controls' }; put('#dash-title', titles[next]);
    $$('.dash-tabs button').forEach(button => { const selected = button.dataset.tab === next; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    ['overview', 'products', 'customers', 'quality'].forEach(name => { $(`#panel-${name}`).hidden = name !== next; });
  }
  $$('.dash-tabs button').forEach(button => button.addEventListener('click', () => { activate(button.dataset.tab); syncUrl(); }));
  $('.dash-tabs').addEventListener('keydown', event => { const tabs = $$('.dash-tabs button'), index = tabs.indexOf(document.activeElement); if (index < 0) return; let next; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = tabs.length - 1; else return; event.preventDefault(); activate(tabs[next].dataset.tab); tabs[next].focus(); syncUrl(); });
  $$('#period-select, #market-select').forEach(select => select.addEventListener('change', () => { render(); syncUrl(); }));
  $$('[data-ranking]').forEach(button => button.addEventListener('click', () => { ranking = button.dataset.ranking; $$('[data-ranking]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderProducts(view()); syncUrl(); }));
  $$('[data-open-view]').forEach(link => link.addEventListener('click', () => { if (link.dataset.openRanking) { ranking = link.dataset.openRanking; $$('[data-ranking]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ranking === ranking))); } activate(link.dataset.openView); renderProducts(view()); queueMicrotask(syncUrl); }));
  window.addEventListener('popstate', restoreUrl);
  $('#share-view').addEventListener('click', async () => {
    const url = shareUrl().href;
    const status = $('#share-status');
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Dashboard view link copied.';
      $('#share-view').textContent = 'Link copied ✓';
      setTimeout(() => { $('#share-view').textContent = 'Copy view link ↗'; }, 2500);
    } catch {
      status.textContent = 'Copy this dashboard link from the address bar.';
      window.prompt('Copy this dashboard link:', url);
    }
  });
  const csv = value => { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  $('#export-view').addEventListener('click', () => { const v = view(); let rows = tab === 'overview' ? v.trend : tab === 'products' ? (ranking === 'credits' ? v.credit_products : v.products) : tab === 'customers' ? v.segments : data.quality; if (!rows.length) return; const columns = Object.keys(rows[0]); const text = [columns.join(','), ...rows.map(row => columns.map(column => csv(row[column])).join(','))].join('\r\n') + '\r\n'; const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); const link = node('a'); link.href = url; link.download = `retail-${tab}-${v.period}-${v.market}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  if (window.PRICING_STUDY) {
    put('#pricing-flagged', count(window.PRICING_STUDY.flagged_skus));
    const target = $('#pricing-rows');
    window.PRICING_STUDY.examples.slice(0, 6).forEach(row => {
      const tr = node('tr');
      const product = node('td');
      product.append(node('b', '', row.description), node('small', '', row.sku));
      tr.append(product, node('td', '', count(row.sale_lines)), node('td', '', money(row.p10_gbp)), node('td', '', money(row.p90_gbp)), node('td', '', `${row.p90_to_p10.toFixed(1)}×`));
      target.append(tr);
    });
  }
  renderQuality(); restoreUrl(); render();
})();
