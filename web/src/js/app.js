/* 兴隆沟村官网：原生渐进增强，不依赖外部服务。
   菜单断点与 style.css 同步；静态正文和统计始终可读。 */
(function () {
  'use strict';

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileQuery = window.matchMedia('(max-width: 1024px)');
  var reduceMotion = motionQuery.matches;
  var header = document.getElementById('siteHeader');
  var nav = document.getElementById('primaryNav');
  var navToggle = document.getElementById('navToggle');
  var backTop = document.getElementById('backTop');
  var home = document.getElementById('home');
  var desktopDash = document.querySelector('.nav-wrap > .nav-dash');

  function watchMedia(query, callback) {
    if (query.addEventListener) query.addEventListener('change', callback);
    else query.addListener(callback);
  }

  watchMedia(motionQuery, function (event) {
    reduceMotion = event.matches;
    // 立即停止已开始的平滑滚动；后续原生锚点由 CSS 媒体查询接管。
    if (reduceMotion) {
      window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'auto' });
    }
  });

  function focusTarget(target) {
    if (!target) return;
    var temporaryTabIndex = !target.matches('a[href], button, input, select, textarea, [tabindex]');
    if (temporaryTabIndex) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', function () {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
    target.focus({ preventScroll: true });
  }

  /* ---------- 非模态移动导航：保持自然 Tab 顺序 ---------- */
  function menuIsOpen() {
    return nav && navToggle && navToggle.getAttribute('aria-expanded') === 'true';
  }

  function setMenu(open, restoreFocus) {
    if (!nav || !navToggle) return;
    var isOpen = mobileQuery.matches && open;
    // Escape 或隐藏当前焦点前，先把焦点交还给可见触发器。
    if (!isOpen && restoreFocus && mobileQuery.matches) navToggle.focus({ preventScroll: true });
    nav.hidden = mobileQuery.matches && !isOpen;
    nav.classList.toggle('open', isOpen);
    navToggle.classList.toggle('active', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', navToggle.getAttribute(isOpen ? 'data-label-close' : 'data-label-open'));
  }

  function resetMenu() {
    if (!nav || !navToggle) return;
    var active = document.activeElement;
    var focusWasInNav = nav.contains(active);
    setMenu(false, false);
    if (mobileQuery.matches && (focusWasInNav || active === desktopDash)) {
      navToggle.focus({ preventScroll: true });
    } else if (!mobileQuery.matches && active === navToggle) {
      focusTarget(nav.querySelector('a'));
    }
  }

  if (nav && navToggle && header) {
    header.classList.add('nav-ready');
    resetMenu();
    watchMedia(mobileQuery, resetMenu);

    navToggle.addEventListener('click', function () {
      setMenu(!menuIsOpen(), false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuIsOpen()) {
        event.preventDefault();
        setMenu(false, true);
      }
    });

    document.addEventListener('focusin', function (event) {
      if (menuIsOpen() && !nav.contains(event.target) && !navToggle.contains(event.target)) {
        setMenu(false, false);
      }
    });

    // Tab 移到页面其他区域时收起，不锁住焦点，也不拦截正常 Tab。
    document.addEventListener('focusout', function () {
      if (!menuIsOpen()) return;
      window.setTimeout(function () {
        if (menuIsOpen() && !nav.contains(document.activeElement) && document.activeElement !== navToggle) {
          setMenu(false, false);
        }
      }, 0);
    });
  }

  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    var link = event.target.closest('a');
    var regularClick = !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (menuIsOpen()) {
      if (!nav.contains(event.target) && !navToggle.contains(event.target)) {
        setMenu(false, nav.contains(document.activeElement));
      } else if (link && nav.contains(link) && regularClick) {
        setMenu(false, false);
      }
    }

    if (!link || !regularClick || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(href.slice(1))); }
    catch (error) { return; }
    // 保留原生 URL/hash/历史与滚动行为，只补足键盘落点。
    focusTarget(target);
  });

  /* ---------- 滚动状态：一帧一次，活动链接同时提供 aria-current ---------- */
  var navLinks = document.querySelectorAll('.nav a[href^="#"]');
  var sections = [];
  navLinks.forEach(function (link) {
    var section = document.getElementById(link.getAttribute('href').slice(1));
    if (section) sections.push({ link: link, section: section });
  });
  var scrollFrame = null;

  function updateScrollState() {
    scrollFrame = null;
    var y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('scrolled', y > 10);
    if (backTop) {
      var showBackTop = y > 620;
      if (!showBackTop && document.activeElement === backTop) focusTarget(home);
      backTop.hidden = !showBackTop;
      backTop.tabIndex = showBackTop ? 0 : -1;
      backTop.classList.toggle('show', showBackTop);
    }

    var activeLink = null;
    var threshold = (header ? header.offsetHeight : 0) + 80;
    sections.forEach(function (item) {
      if (item.section.getBoundingClientRect().top <= threshold) activeLink = item.link;
    });
    if (sections.length && y + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      activeLink = sections[sections.length - 1].link;
    }
    navLinks.forEach(function (link) {
      var active = link === activeLink;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scheduleScrollState() {
    if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(updateScrollState);
  }
  window.addEventListener('scroll', scheduleScrollState, { passive: true });
  window.addEventListener('resize', scheduleScrollState, { passive: true });
  window.addEventListener('pageshow', scheduleScrollState);
  updateScrollState();

  /* ---------- 复制：防重复提交、读屏反馈、失败保留手工记录路径 ---------- */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  var toastAnnounceTimer = null;

  function copyLabel(name) {
    return toastEl ? toastEl.getAttribute('data-copy-' + name) || '' : '';
  }

  function showToast(message, success) {
    if (!toastEl) return;
    window.clearTimeout(toastTimer);
    window.clearTimeout(toastAnnounceTimer);
    // 清空后再更新，使连续复制相同内容也能被 live region 宣读。
    toastEl.textContent = '';
    toastEl.classList.remove('show');
    toastEl.setAttribute('data-state', success ? 'success' : 'error');
    toastAnnounceTimer = window.setTimeout(function () {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      toastTimer = window.setTimeout(function () {
        toastEl.classList.remove('show');
        toastEl.textContent = '';
      }, success ? 5000 : 8000);
    }, 50);
  }

  function copyText(text) {
    if (!text) return Promise.reject(new Error('Empty copy value'));
    if (navigator.clipboard && window.isSecureContext) {
      return new Promise(function (resolve, reject) {
        var timeout = window.setTimeout(function () {
          reject(new Error('Clipboard request timed out'));
        }, 10000);
        Promise.resolve().then(function () {
          return navigator.clipboard.writeText(text);
        }).then(function () {
          window.clearTimeout(timeout);
          resolve();
        }, function (error) {
          window.clearTimeout(timeout);
          reject(error);
        });
      });
    }

    return new Promise(function (resolve, reject) {
      var active = document.activeElement;
      var selection = window.getSelection();
      var ranges = [];
      if (selection) {
        for (var i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i).cloneRange());
      }
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.className = 'clipboard-helper';
      textarea.setAttribute('readonly', '');
      textarea.setAttribute('tabindex', '-1');
      textarea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textarea);
      try {
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
        if (active && active.isConnected) active.focus({ preventScroll: true });
        if (selection) {
          selection.removeAllRanges();
          ranges.forEach(function (range) { selection.addRange(range); });
        }
      }
    });
  }

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    var originalLabel = button.textContent;
    var pending = false;
    var resetTimer = null;

    function finishCopy(success, value) {
      pending = false;
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
      button.setAttribute('data-copy-state', success ? 'success' : 'error');
      button.textContent = copyLabel(success ? 'success-label' : 'error-label') || originalLabel;
      showToast(copyLabel(success ? 'success' : 'error') + value, success);
      resetTimer = window.setTimeout(function () {
        button.textContent = originalLabel;
        button.removeAttribute('data-copy-state');
      }, 8000);
    }

    button.addEventListener('click', function () {
      if (pending) return;
      pending = true;
      window.clearTimeout(resetTimer);
      var value = button.getAttribute('data-copy') || '';
      // 保持焦点可见，用 aria-disabled + pending 防止重复提交。
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('data-copy-state', 'busy');
      button.textContent = copyLabel('busy') || originalLabel;
      copyText(value).then(function () {
        finishCopy(true, value);
      }, function () {
        finishCopy(false, value);
      });
    });
  });

  /* ---------- 返回顶部与页脚年份 ---------- */
  if (backTop) {
    backTop.addEventListener('click', function () {
      focusTarget(home);
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
