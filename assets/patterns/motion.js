/* mld-motion — the cinematic layer: reveal on scroll, card lift, cursor spotlight.

   Motion only. Nothing here touches layout: every effect runs on transform and
   opacity, so the browser composites it and no element's box ever moves. That
   matters because four WebGL hosts on this site are absolutely positioned at
   their element's document coordinates and re-measure on scroll - if a reveal
   shifted one of them, the painted surface would slide off its card.

   For the same reason this round skips everything that carries a canvas: the
   hero, the stat row, the About founder card and the footer are all excluded
   below and stay perfectly still.

   Mounted by script after load, into elements React already owns, only ever
   setting a class or a custom property - so hydration is untouched. */
(function () {
  var EASE = 'cubic-bezier(.16,1,.3,1)';

  /* Cards get the full treatment: reveal, lift, spotlight. */
  var CARD_SEL = [
    '#works-list article',
    'article:has(> blockquote)',
    'li:has(> article) > article'
  ].join(',');

  /* Text blocks get the reveal only. */
  var REVEAL_SEL = [
    'main section > h1',
    'main section > h2',
    'main section > p',
    'main h2:not(.mld-kicker)'
  ].join(',');

  /* The hero is the one canvas area that does take the reveal: only its
     children move, never the section, so the field's host - which is sized
     from the section's box - has nothing to re-measure. These animate on load
     rather than on scroll, since they are already on screen. */
  var HERO_SEL = [
    'section:has(#hero-calendly) h1',
    'section:has(#hero-calendly) h2.mld-kicker',
    /* The button's wrapper, not the link: the link carries its own
       transition from the stock stylesheet at a weight not worth fighting,
       and the row of buttons is the natural unit to bring in anyway. */
    'section:has(#hero-calendly) div:has(> a#hero-calendly)',
    '.mld-proof > div'
  ].join(',');

  /* Anything that hosts, or is tracked by, a live canvas stays put this round.
     Also the logo strip, which already carries its own scroll animation. */
  var EXCLUDE = [
    'footer', '.mld-stats', '.mld-stat', '.clients-list',
    'section:has(#hero-calendly)', 'div.c1wm8bso.cvgvfj9',
    /* Carousel slides sit outside the viewport horizontally, so they never
       intersect and would stay invisible until swiped - and then fade in on
       every swipe. They already have the slider's own motion. */
    '.swiper-slide', '.swiper-wrapper'
  ].join(',');

  var CSS =
    /* Doubled class for weight: some elements carry their own transition from
       the stock stylesheet, and a single class ties with it - the CTA snapped
       to full opacity instead of fading. */
    '.mld-rv.mld-rv{opacity:0;transform:translateY(24px);' +
    'transition:opacity .6s ' + EASE + ',transform .6s ' + EASE + '}' +
    '.mld-rv.mld-rv.mld-in{opacity:1;transform:none}' +
    /* The lift rides on top of the reveal's transform, so it only arms once the
       reveal has finished and translateY is back to zero. */
    '.mld-card-fx{transition:transform .3s ' + EASE + ',box-shadow .3s ' + EASE + '}' +
    '.mld-card-fx.mld-armed:hover{transform:translateY(-4px)}' +
    /* Spotlight: a soft pool of the grey token that follows the pointer. Painted
       on a pseudo-element under the content, clipped to the card's own radius. */
    '.mld-card-fx{position:relative}' +
    '.mld-card-fx::after{content:"";position:absolute;inset:0;z-index:0;' +
    'pointer-events:none;border-radius:inherit;opacity:0;' +
    'transition:opacity .3s ' + EASE + ';' +
    /* A light source, not a tint: plain white at low alpha, so it brightens
       both the pale cards and the dark ones. A token would flip with the theme
       and darken one of the two. */
    'background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),' +
    'rgb(255 255 255 / .16),transparent 70%)}' +
    '.mld-card-fx.mld-armed:hover::after{opacity:1}' +
    '.mld-card-fx > *{position:relative;z-index:1}' +
    '@media(prefers-reduced-motion:reduce){' +
    '.mld-rv{opacity:1;transform:none;transition:none}' +
    '.mld-card-fx,.mld-card-fx::after{transition:none}' +
    '.mld-card-fx.mld-armed:hover{transform:none}' +
    '.mld-card-fx.mld-armed:hover::after{opacity:0}}';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function excluded(el) {
    return !!(el.closest(EXCLUDE) || el.querySelector('canvas'));
  }

  function style() {
    if (document.getElementById('mld-motion-css')) return;
    var st = document.createElement('style');
    st.id = 'mld-motion-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* Stagger is per group of siblings, not per page: each row of cards cascades
     on its own rather than inheriting a delay from everything above it.
     The trigger is a rootMargin, not a ratio: an element taller than the
     viewport can never reach an 18% ratio, so a threshold would leave the
     longest text blocks stuck invisible forever. */
  function reveal(els) {
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('mld-in', 'mld-armed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      var groups = new Map();
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, parent = el.parentElement;
        var n = groups.get(parent) || 0;
        groups.set(parent, n + 1);
        el.style.transitionDelay = (n * 0.08) + 's';
        el.classList.add('mld-in');
        io.unobserve(el);                  // once, never on the way back up
        setTimeout(function () {
          el.style.transitionDelay = '';
          el.classList.add('mld-armed');   // hover effects only after landing
        }, 600 + n * 80);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    els.forEach(function (el) { io.observe(el); });
  }

  function spotlight(card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
      card.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* On-load cascade: the hero pieces come up in reading order rather than all
     at once, which is what makes the first screen feel staged. */
  function heroIn() {
    var els = [].slice.call(document.querySelectorAll(HERO_SEL))
      .filter(function (el) { return !el.classList.contains('mld-rv'); });
    var unveil = function () { document.documentElement.classList.remove('mld-prehero'); };
    if (!els.length || reduced) { unveil(); return; }
    els.forEach(function (el, i) {
      el.classList.add('mld-rv');
      el.style.transitionDelay = (0.08 * i) + 's';
    });
    /* Order matters: .mld-rv has to be painted before the pre-paint guard
       comes off, or the hero flashes at full opacity for a frame. */
    requestAnimationFrame(function () {
      unveil();
      requestAnimationFrame(function () {
        els.forEach(function (el, i) {
          el.classList.add('mld-in');
          setTimeout(function () { el.style.transitionDelay = ''; }, 600 + i * 80);
        });
      });
    });
  }

  function build() {
    style();
    heroIn();
    var cards = [].slice.call(document.querySelectorAll(CARD_SEL))
      .filter(function (el) { return !excluded(el) && !el.classList.contains('mld-card-fx'); });
    var texts = [].slice.call(document.querySelectorAll(REVEAL_SEL))
      .filter(function (el) { return !excluded(el) && !el.classList.contains('mld-rv'); });

    cards.forEach(function (c) {
      c.classList.add('mld-card-fx');
      if (!reduced) spotlight(c);
    });

    if (reduced) {
      cards.concat(texts).forEach(function (el) { el.classList.add('mld-armed'); });
      return;
    }

    var all = cards.concat(texts);
    all.forEach(function (el) { el.classList.add('mld-rv'); });
    /* Anything already on screen at load reveals immediately - no blank first
       viewport while the observer waits for a scroll. */
    requestAnimationFrame(function () {
      var late = [];
      all.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
          el.classList.add('mld-in', 'mld-armed');
        } else late.push(el);
      });
      reveal(late);
    });
  }

  function boot() { requestAnimationFrame(function () { requestAnimationFrame(build); }); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  [1500, 3000, 5000, 8000].forEach(function (ms) { setTimeout(boot, ms); });
})();
