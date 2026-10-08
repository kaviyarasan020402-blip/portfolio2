/* ==========================================================
   Kaviyarasan V — Video Editor Portfolio — main.js
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try { initLoader(reduceMotion); } catch (e) {}
  try { initSprocketStrip(); } catch (e) {}
  try { initNav(); } catch (e) {}
  try { initHeaderScroll(); } catch (e) {}
  try { initTypingEffect(reduceMotion); } catch (e) {}
  try { initSkillTracks(reduceMotion); } catch (e) {}
  try { initEditorFX(reduceMotion); } catch (e) {}
  try { initSectionReveal(reduceMotion); } catch (e) {}
  loadPortfolio();
});

/* ---------- Portfolio data: loaded from api.php (same for every visitor) ---------- */
async function loadPortfolio(){
  let data = { photo: null, work: [], videos: [] };
  try{
    const res = await fetch('api.php?action=list&_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  }catch(e){ console.warn('Could not load portfolio data from api.php (PHP hosting needed).', e); }

  const hero = document.getElementById('heroPhoto');
  if (hero && data.photo) hero.src = data.photo;

  renderSection('work', 'workGrid', data.work || [], buildWorkCard, '.work-card');
  renderSection('reels', 'reelGrid', data.videos || [], buildReelCard, '.reel-card');
}

// Fills a grid; hides the whole section (and its nav link) when there is nothing to show.
function renderSection(sectionId, gridId, items, builder, cardSel){
  const section = document.getElementById(sectionId);
  const grid = document.getElementById(gridId);
  if (!section || !grid) return;
  const navLink = document.querySelector('#navList a[href="#' + sectionId + '"]');
  if (!items.length){
    section.style.display = 'none';
    if (navLink && navLink.parentElement) navLink.parentElement.style.display = 'none';
    return;
  }
  grid.innerHTML = '';
  items.forEach((item, i) => grid.appendChild(builder(item, i)));
  observeReveal(grid.querySelectorAll(cardSel));
}

function buildWorkCard(item){
  const card = document.createElement('div');
  card.className = 'work-card';

  const thumb = document.createElement('div');
  thumb.className = 'work-thumb';
  if (item.image){
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.onerror = () => { card.style.display = 'none'; };
    thumb.appendChild(img);
  }
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = item.category || 'Work';
  thumb.appendChild(tag);

  const body = document.createElement('div');
  body.className = 'reel-body';
  const h3 = document.createElement('h3');
  h3.textContent = item.title || '';
  const p = document.createElement('p');
  p.textContent = item.description || '';
  body.appendChild(h3);
  body.appendChild(p);

  card.appendChild(thumb);
  card.appendChild(body);
  return card;
}

/* ---------- Header: add a shadow/tighten once the page scrolls ---------- */
function initHeaderScroll(){
  const header = document.querySelector('header');
  if (!header) return;
  const apply = () => header.classList.toggle('scrolled', window.scrollY > 12);
  window.addEventListener('scroll', apply, { passive: true });
  apply();
}

/* ---------- Section heads + timeline items: same wipe-reveal as reel cards ---------- */
function initSectionReveal(reduceMotion){
  const targets = document.querySelectorAll('.section-head, .t-item');
  if (!targets.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)){
    targets.forEach(t => t.classList.add('reveal-in'));
    return;
  }
  requestAnimationFrame(() => {
    targets.forEach(t => t.classList.add('reveal-ready'));
    requestAnimationFrame(() => {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting){
            setTimeout(() => entry.target.classList.add('reveal-in'), i * 70);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      targets.forEach(t => io.observe(t));
    });
  });
}

/* ---------- Ambient editor-tool layer: drifts on mousemove + scroll ---------- */
function initEditorFX(reduceMotion){
  const layer = document.getElementById('editorFx');
  if (!layer) return;
  const icons = Array.from(layer.querySelectorAll('.efx-icon'));
  if (!icons.length || reduceMotion) return; // keep them static for reduced-motion users

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let scrollY = window.scrollY;
  let ticking = false;

  function apply(){
    icons.forEach(icon => {
      const depth = parseFloat(icon.dataset.depth) || 0.03;
      const baseRot = parseFloat(icon.dataset.rot) || 0;
      const dx = (mouseX - window.innerWidth / 2) * depth;
      const dy = (mouseY - window.innerHeight / 2) * depth + scrollY * depth * 0.35;
      const rot = baseRot + scrollY * depth * 0.05;
      icon.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
    });
    ticking = false;
  }

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!ticking){ requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    if (!ticking){ requestAnimationFrame(apply); ticking = true; }
  }, { passive: true });

  apply();
}

/* ---------- Skill tracks: fill like a render bar when scrolled into view ---------- */
function initSkillTracks(reduceMotion){
  const tracks = document.querySelectorAll('.skill-track');
  if (!tracks.length) return;
  tracks.forEach(t => t.style.setProperty('--level', (t.dataset.level || 0) + '%'));

  if (reduceMotion || !('IntersectionObserver' in window)){
    tracks.forEach(t => t.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting){
        setTimeout(() => entry.target.classList.add('in-view'), i * 90);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  tracks.forEach(t => io.observe(t));
}

/* ---------- Loader: one-time "render" progress bar ---------- */
function initLoader(reduceMotion){
  const loader = document.getElementById('loader');
  if (reduceMotion || !loader){
    if (loader) loader.classList.add('done');
    return;
  }
  const fill = document.getElementById('loaderFill');
  const pct = document.getElementById('loaderPct');
  let progress = 0;
  const timer = setInterval(() => {
    progress += Math.random() * 18 + 6;
    if (progress >= 100){
      progress = 100;
      clearInterval(timer);
      setTimeout(() => loader.classList.add('done'), 250);
    }
    fill.style.width = progress + '%';
    pct.textContent = Math.floor(progress) + '%';
  }, 110);
}

/* ---------- Sprocket strip: fill with hole marks responsively ---------- */
function initSprocketStrip(){
  const strip = document.getElementById('sprocketStrip');
  if (!strip) return;
  const count = Math.ceil(window.innerWidth / 16) + 4;
  strip.innerHTML = '<span></span>'.repeat(count);
}

/* ---------- Mobile nav toggle ---------- */
function initNav(){
  const toggle = document.getElementById('navToggle');
  const list = document.getElementById('navList');
  if (!toggle || !list) return;
  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  });
  list.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    list.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

/* ---------- Hero typing effect: cycles through edit-related words ---------- */
function initTypingEffect(reduceMotion){
  const el = document.getElementById('typedWord');
  if (!el) return;
  const words = ['story', 'reel', 'brand', 'moment'];
  if (reduceMotion){
    el.textContent = words[0];
    return;
  }
  let wordIndex = 0;
  let charIndex = words[0].length;
  let deleting = false;

  function tick(){
    const word = words[wordIndex];
    if (!deleting){
      charIndex++;
      if (charIndex > word.length){
        deleting = true;
        setTimeout(tick, 1400);
        return;
      }
    } else {
      charIndex--;
      if (charIndex < 0){
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        charIndex = 0;
      }
    }
    el.textContent = word.slice(0, charIndex);
    setTimeout(tick, deleting ? 45 : 90);
  }
  setTimeout(tick, 1200);
}

/* ---------- Reel cards ---------- */
// Uploaded video file (path like uploads/videos/x.mp4) vs. external link (Instagram/YouTube)
function isLocalVideoFile(url){
  if (!url) return false;
  return !/^https?:\/\//i.test(url) && /\.(mp4|m4v|mov|webm)$/i.test(url);
}

// A small set of original outline icons (not brand logos) so each card gets
// a distinct watermark even when no real thumbnail image exists yet.
const CLIP_ICONS = [
  '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z"/></svg>', // play
  '<svg viewBox="0 0 24 24"><circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><path d="M9 7.3L19 17M9 16.7L19 7"/></svg>', // scissors
  '<svg viewBox="0 0 24 24"><path d="M3 8l3-3 2 2 12-3v3L8 9.5 5 10.5 3 8z"/><rect x="3" y="10" width="18" height="9" rx="1"/></svg>', // clapperboard
  '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 8h18M3 16h18M7 4v4M7 16v4M17 4v4M17 16v4"/></svg>', // filmstrip
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>', // aperture
  '<svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-1v-6h3M4 18v-5h3v6H6a2 2 0 0 1-2-2z"/></svg>' // headphones
];

function buildReelCard(reel, index){
  const isLocalVideo = isLocalVideoFile(reel.video_url);
  const card = document.createElement('div');
  card.className = 'reel-card';

  const thumb = document.createElement('div');
  thumb.className = 'reel-thumb';
  if (isLocalVideo){
    thumb.classList.add('has-video');
  } else if (reel.poster_url){
    thumb.style.setProperty('--frame', `url("${reel.poster_url}") center/cover no-repeat`);
  }

  const clipNo = document.createElement('span');
  clipNo.className = 'clip-no';
  clipNo.textContent = 'CLIP ' + String(index + 1).padStart(2, '0');
  thumb.appendChild(clipNo);

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = reel.category || 'Reel';
  thumb.appendChild(tag);

  if (isLocalVideo){
    const video = document.createElement('video');
    video.className = 'reel-video';
    video.src = reel.video_url + '#t=0.1';   // #t shows the first frame on phones
    if (reel.poster_url) video.poster = reel.poster_url;
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    thumb.appendChild(video);
  } else {
    const clipIcon = document.createElement('span');
    clipIcon.className = 'clip-icon';
    clipIcon.setAttribute('aria-hidden', 'true');
    clipIcon.innerHTML = CLIP_ICONS[index % CLIP_ICONS.length];
    thumb.appendChild(clipIcon);

    const play = document.createElement('div');
    play.className = 'play';
    play.setAttribute('aria-hidden', 'true');
    play.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z"/></svg>';
    thumb.appendChild(play);
  }

  const body = document.createElement('div');
  body.className = 'reel-body';
  const h3 = document.createElement('h3');
  h3.textContent = reel.title || '';
  const p = document.createElement('p');
  p.textContent = reel.description || '';
  if (reel.description) p.title = reel.description;
  body.appendChild(h3);
  body.appendChild(p);

  const a = document.createElement('a');
  a.className = 'watch';
  a.href = reel.video_url || '#';
  a.target = '_blank';
  a.rel = 'noopener';
  if (isLocalVideo) a.textContent = 'Open full video ↗';
  else if (/instagram\.com/i.test(reel.video_url)) a.textContent = 'Watch on Instagram →';
  else if (/youtu\.?be/i.test(reel.video_url)) a.textContent = 'Watch on YouTube →';
  else a.textContent = 'Watch video →';
  body.appendChild(a);

  card.appendChild(thumb);
  card.appendChild(body);
  return card;
}

/* ---------- Scroll reveal: clip-path "wipe" cut, not a generic fade-slide ---------- */
function observeReveal(cards){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window) || !cards.length){
    cards.forEach(c => c.classList.add('reveal-in'));
    return;
  }

  // Safety net: whatever happens with the observer, nothing stays
  // invisible for more than a moment.
  const forceReveal = () => cards.forEach(c => c.classList.add('reveal-in'));
  const safety = setTimeout(forceReveal, 1200);

  // Apply the hidden starting state only right before the browser paints,
  // so a card is never left stuck hidden if this script errors elsewhere.
  requestAnimationFrame(() => {
    cards.forEach(c => c.classList.add('reveal-ready'));
    requestAnimationFrame(() => {
      try {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry, i) => {
            if (entry.isIntersecting){
              setTimeout(() => entry.target.classList.add('reveal-in'), i * 60);
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });
        cards.forEach(c => io.observe(c));
      } catch (e) {
        clearTimeout(safety);
        forceReveal();
      }
    });
  });
}