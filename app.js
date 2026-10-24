/* ===== EASY CUSTOMIZATION =====
 * Replace the address below with your own contact email before publishing.
 * Example: const CONTACT_EMAIL = 'hello@yourdomain.com';
 * No server, database, cookies, analytics or paid API required.
 */
const CONTACT_EMAIL = 'ADD_YOUR_EMAIL_HERE';
const CONTACT_SUBJECT = 'Pricing and data analysis project enquiry';

const sampleProducts = [
  {sku:'SKU-104',category:'Services',premium:true,current:'Services'},
  {sku:'SKU-207',category:'Storage',premium:false,current:'Storage'},
  {sku:'SKU-332',category:'Servers',premium:true,current:'Servers'},
  {sku:'SKU-441',category:'Software',premium:false,current:'Software'},
  {sku:'SKU-521',category:'Services',premium:false,current:'Services'},
  {sku:'SKU-638',category:'Storage',premium:true,current:'Premium Storage'},
  {sku:'SKU-713',category:'Services',premium:true,current:'Premium Services'},
  {sku:'SKU-809',category:'Servers',premium:false,current:'Services'},
  {sku:'SKU-905',category:'Accessories',premium:false,current:'Accessories'},
  {sku:'SKU-106',category:'Storage',premium:false,current:'Storage'},
  {sku:'SKU-117',category:'Software',premium:true,current:'Software'},
  {sku:'SKU-228',category:'Servers',premium:false,current:'Servers'}
];

const auditedProducts = sampleProducts.map(p => ({
  ...p,
  expected:p.premium ? `Premium ${p.category}` : p.category,
  flagged:p.current !== (p.premium ? `Premium ${p.category}` : p.category)
}));
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);

function initContact(){
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT_EMAIL);
  document.querySelectorAll('.contact-link').forEach(link=>{
    if(validEmail){link.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;}
    else {link.href='#contact';link.title='Site owner: add your email in app.js to enable contact';}
  });
  if(!validEmail){$('#contact-status').textContent='SETUP REMINDER: Add your real email address in app.js before publishing.';}
}
function initNavigation(){
  const toggle=$('#menu-toggle');const nav=$('#mobile-nav');
  toggle.addEventListener('click',()=>{
    const show=nav.hidden;
    nav.hidden=!show;toggle.setAttribute('aria-expanded',String(show));
    toggle.setAttribute('aria-label',show?'Close navigation':'Open navigation');
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.hidden=true;toggle.setAttribute('aria-expanded','false');}));
}
function initReveals(){
  if(!('IntersectionObserver' in window)){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{threshold:.08,rootMargin:'0px 0px 40px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}
function renderAudit(filter='all'){
  const flagged=auditedProducts.filter(p=>p.flagged).length;
  $('#total-count').textContent=auditedProducts.length;
  $('#flagged-count').textContent=flagged;
  $('#quality-score').textContent=Math.round(100*(auditedProducts.length-flagged)/auditedProducts.length)+'%';
  const filtered=auditedProducts.filter(p=>filter==='all'||(filter==='flagged'?p.flagged:!p.flagged));
  // All fields are fixed sample data declared above, never user-supplied HTML.
  $('#audit-rows').innerHTML=filtered.map(p=>`<tr><td>${p.sku}</td><td>${p.category}</td><td class="${p.premium?'premium-yes':''}">${p.premium?'TRUE':'FALSE'}</td><td><span class="data-pill">${p.current}</span></td><td>${p.expected}</td><td><span class="state-badge ${p.flagged?'flagged':''}">${p.flagged?'Needs review':'Matched'}</span></td></tr>`).join('');
}
function initAudit(){
  renderAudit();
  document.querySelectorAll('.filter-btn').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('.filter-btn').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
    renderAudit(button.dataset.filter);
  }));
}
function initTabs(){
  const tabs=[{button:$('#tab-audit'),panel:$('#classification')},{button:$('#tab-calc'),panel:$('#calculator')}];
  const activate=index=>tabs.forEach((item,i)=>{
    const selected=i===index;
    item.button.classList.toggle('active',selected);
    item.button.setAttribute('aria-selected',String(selected));
    item.button.tabIndex=selected?0:-1;
    item.panel.hidden=!selected;
  });
  tabs.forEach((item,i)=>{
    item.button.addEventListener('click',()=>activate(i));
    item.button.addEventListener('keydown',event=>{
      const next=event.key==='ArrowRight'?i+1:event.key==='ArrowLeft'?i-1:null;
      if(next!==null){event.preventDefault();const to=(next+tabs.length)%tabs.length;activate(to);tabs[to].button.focus();}
    });
  });
  function checkHash(){
    const hash=window.location.hash;
    if(hash==='#calculator'||hash==='#classification'){
      activate(hash==='#calculator'?1:0);
      requestAnimationFrame(()=>$('#lab').scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }
  window.addEventListener('hashchange',checkHash);checkHash();
}
function initCalculator(){
  const revenue=$('#revenue'),exposure=$('#exposure'),leakage=$('#leakage');
  function update(){
    const r=Number(revenue.value),e=Number(exposure.value)/100,l=Number(leakage.value)/100;
    $('#revenue-value').textContent=money(r);
    $('#exposure-value').textContent=Math.round(e*100)+'%';
    $('#leakage-value').textContent=(l*100).toFixed(1)+'%';
    $('#opportunity').textContent=money(r*e*l);
    $('#affected-sales').textContent=money(r*e);
    $('#unaffected-sales').textContent=money(r*(1-e));
    [revenue,exposure,leakage].forEach(input=>{
      const percent=100*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min));
      input.style.background=`linear-gradient(to right, #cefc68 ${percent}%, #43554b ${percent}%)`;
    });
  }
  [revenue,exposure,leakage].forEach(input=>input.addEventListener('input',update));
  $('#reset-calc').addEventListener('click',()=>{revenue.value=4500000;exposure.value=18;leakage.value=3;update();});
  update();
}
document.addEventListener('DOMContentLoaded',()=>{
  initContact();initNavigation();initReveals();initAudit();initTabs();initCalculator();
  $('#year').textContent=new Date().getFullYear();
});
