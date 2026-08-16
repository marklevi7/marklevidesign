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
  /* A soft ease-out, not an expo one. The old curve reached 95% of the way in
     the first fifth of its run and then crawled, which read as a snap followed
     by a wait - "sharp and hard" in the owner's words. This one spends its
     speed evenly and settles instead of arriving. */
  var EASE = 'cubic-bezier(.25,.6,.35,1)';

  /* One entrance length, and one stagger step, both a quarter slower than the
     first pass. Everything below reads these rather than repeating numbers. */
  var IN_MS = 750;
  var STEP_MS = 100;
  var IN_S = (IN_MS / 1000) + 's';

  /* Cards get the full treatment: reveal, lift, spotlight. */
  var CARD_SEL = [
    '#works-list article',
    '.mld-stats .mld-stat',
    'article:has(> blockquote)',
    'li:has(> article) > article'
  ].join(',');

  /* Text blocks get the reveal only. */
  var REVEAL_SEL = [
    'main section > h1',
    'main section > h2',
    'main section > p',
    'main h2:not(.mld-kicker)',
    /* The testimonial carousel comes in as one piece: its viewport, which the
       slider never transforms, plus the arrows and the link beside it. The
       slides themselves stay excluded - they sit off-screen horizontally and
       would fade in again on every swipe. */
    'div:has(> ul.swiper-wrapper)',
    'section:has(.swiper-wrapper) button',
    'section:has(.swiper-wrapper) a[href*="testimonial"]'
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
    'section:has(#hero-calendly) div:has(> a#hero-calendly)'
  ].join(',');

  /* The proof card is held back from that cascade: it sits below the fold on
     most screens, so firing it on load meant it had already finished by the
     time you scrolled to it. It is hidden by the same pre-paint guard, but it
     comes in on the scroll trigger like everything else down the page. */
  var PROOF_SEL = '.mld-proof > div';

  /* The footer's field is painted by a host in the body, not by the footer
     itself, so its content can move freely - the background never does. The
     legal row is skipped on purpose: it carries a translateY that positions it
     over the field, and a reveal transform would fight it. Its chips come in
     individually instead. */
  var FOOTER_SEL = [
    'footer h2', 'footer p',
    'footer a[href^="mailto"]', 'footer a[href*="calendly"]', 'footer a[href*="wa.me"]',
    'footer a[aria-label*="account"]',
    'footer a[href*="privacy"]', 'footer a[href*="terms"]', 'footer a[href*="accessibility"]'
  ].join(',');

  /* Anything that hosts, or is tracked by, a live canvas stays put this round.
     Also the logo strip, which already carries its own scroll animation. */
  var EXCLUDE = [
    /* .mld-stat is not listed: the stat cards no longer carry a pixel field,
       so they take the reveal like any other card. Any card that still holds a
       live canvas is caught by the querySelector check below regardless. */
    'footer', '.clients-list',
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
    'transition:opacity ' + IN_S + ' ' + EASE + ',transform ' + IN_S + ' ' + EASE + '}' +
    '.mld-rv.mld-rv.mld-in{opacity:1;transform:none}' +
    /* The lift rides on top of the reveal's transform, so it only arms once the
       reveal has finished and translateY is back to zero. */
    '.mld-card-fx{transition:transform .3s ' + EASE + ',box-shadow .3s ' + EASE + '}' +
    '.mld-card-fx.mld-armed:hover{transform:translateY(-4px)}' +
    /* Spotlight: a soft pool of light that follows the pointer, painted on a
       pseudo-element under the content and clipped to the card's own radius.

       The card is made its own stacking context so the pool can sit at z-index
       -1: inside a stacking context that layer lands above the card's own
       background and below everything in it, which is exactly where a pool of
       light belongs. The earlier version instead raised every direct child to
       position:relative, and that quietly re-parented the ones that were
       absolute - the testimonial portraits hang 54px above their card, and they
       dropped into the flow and landed on top of the quote. Nothing here
       touches a child any more. */
    '.mld-card-fx{position:relative;isolation:isolate}' +
    '.mld-card-fx::after{content:"";position:absolute;inset:0;z-index:-1;' +
    'pointer-events:none;border-radius:inherit;opacity:0;' +
    'transition:opacity .3s ' + EASE + ';' +
    /* A light source, not a tint: plain white at low alpha, so it brightens
       both the pale cards and the dark ones. A token would flip with the theme
       and darken one of the two. */
    'background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),' +
    'rgb(255 255 255 / .16),transparent 70%)}' +
    '.mld-card-fx.mld-armed:hover::after{opacity:1}' +
    '@media(prefers-reduced-motion:reduce){' +
    '.mld-rv{opacity:1;transform:none;transition:none}' +
    '.mld-card-fx,.mld-card-fx::after{transition:none}' +
    '.mld-card-fx.mld-armed:hover{transform:none}' +
    '.mld-card-fx.mld-armed:hover::after{opacity:0}}';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function excluded(el) {
    if (el.closest(EXCLUDE) || el.querySelector('canvas')) return true;
    /* Zero-size means hidden - the retired Dribbble chip, for one. It could
       never intersect, so it would stay at opacity 0 for good. */
    var r = el.getBoundingClientRect();
    return !r.width || !r.height;
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
        el.style.transitionDelay = (n * STEP_MS / 1000) + 's';
        el.classList.add('mld-in');
        io.unobserve(el);                  // once, never on the way back up
        setTimeout(function () {
          el.style.transitionDelay = '';
          el.classList.add('mld-armed');   // hover effects only after landing
        }, IN_MS + n * STEP_MS);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    els.forEach(function (el) { io.observe(el); });

    /* The bottom inset means anything sitting below the trigger line when the
       page runs out of scroll never fires - the legal chips ride 120px down
       into the footer field and land exactly there. Flush the remainder once
       the scroll bottoms out. */
    var flush = function () {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      els.forEach(function (el, i) {
        if (el.classList.contains('mld-in')) return;
        el.style.transitionDelay = ((i % 6) * STEP_MS / 1000) + 's';
        el.classList.add('mld-in');
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; el.classList.add('mld-armed'); }, IN_MS + 6 * STEP_MS);
      });
      window.removeEventListener('scroll', flush);
    };
    window.addEventListener('scroll', flush, { passive: true });
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
    var proof = [].slice.call(document.querySelectorAll(PROOF_SEL))
      .filter(function (el) { return !el.classList.contains('mld-rv'); });
    var unveil = function () { document.documentElement.classList.remove('mld-prehero'); };
    if ((!els.length && !proof.length) || reduced) { unveil(); return; }
    els.forEach(function (el, i) {
      el.classList.add('mld-rv');
      el.style.transitionDelay = (i * STEP_MS / 1000) + 's';
    });
    /* Marked hidden in the same breath as the rest, so the guard can come off
       without it flashing - but handed to the scroll observer, not the cascade. */
    proof.forEach(function (el) { el.classList.add('mld-rv'); });
    /* Order matters: .mld-rv has to be painted before the pre-paint guard
       comes off, or the hero flashes at full opacity for a frame. */
    requestAnimationFrame(function () {
      unveil();
      requestAnimationFrame(function () {
        els.forEach(function (el, i) {
          el.classList.add('mld-in');
          setTimeout(function () { el.style.transitionDelay = ''; }, IN_MS + i * STEP_MS);
        });
        /* Handled only now, a frame after the hidden state was painted. Any
           earlier and the class lands with no starting style committed, so on a
           screen where the card is already visible it snapped instead of
           fading. If it is on screen it comes in here; if not, the scroll
           observer takes it, which is the whole point of holding it back. */
        var late = [];
        proof.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
            el.classList.add('mld-in');
          } else late.push(el);
        });
        if (late.length) reveal(late);
      });
    });
  }

  function footerIn() {
    var els = [].slice.call(document.querySelectorAll(FOOTER_SEL))
      .filter(function (el) {
        var r = el.getBoundingClientRect();
        return !el.classList.contains('mld-rv') && r.width && r.height;
      });
    if (!els.length || reduced) return;
    els.forEach(function (el) { el.classList.add('mld-rv'); });
    reveal(els);
  }

  function build() {
    style();
    heroIn();
    footerIn();
    var cards = [].slice.call(document.querySelectorAll(CARD_SEL))
      .filter(function (el) { return !excluded(el) && !el.classList.contains('mld-card-fx'); });
    /* A card comes in as one piece. Its own title is an h2 like any other, so
       the text sweep picked it up and gave it a second reveal with a delay of
       its own - on the work page that read as 26 titles arriving separately
       from the cards holding them. Anything inside a card is the card's. */
    var texts = [].slice.call(document.querySelectorAll(REVEAL_SEL))
      .filter(function (el) {
        return !excluded(el) && !el.classList.contains('mld-rv') && !el.closest(CARD_SEL);
      });

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
