/* ══════════════════════════════════════════════════════════════
   2PROVI TOOLS — common.js
   สคริปต์ร่วมของทุกหน้า: ธีม Light/Dark, ฟอร์แมตตัวเลข,
   toast/modal (แทน alert/confirm ที่ถูกบล็อกใน sandboxed iframe),
   แท็บ, และการส่งออก PDF พร้อม fallback เป็น window.print()
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── DOM helpers ───────────────────────────────────────── */
  const $  = (sel, root) => (root || document).querySelector(sel[0] === '#' && !/[ .>\[:]/.test(sel) ? sel : sel);
  const byId = (id) => document.getElementById(id);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ── Storage ที่ปลอดภัย ──
     localStorage โยน error ได้ใน sandboxed iframe / โหมดส่วนตัว
     จึงต้องห่อ try/catch เสมอ ไม่งั้นสคริปต์ทั้งหน้าตายตั้งแต่บรรทัดแรก */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  /* ── ตัวเลข ────────────────────────────────────────────── */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function numOf(id) { const el = byId(id); return el ? num(el.value) : 0; }
  function intOf(id, dflt) { const el = byId(id); const n = parseInt(el ? el.value : '', 10); return isFinite(n) ? n : (dflt || 0); }
  function floatOf(id, dflt) { const el = byId(id); const n = parseFloat(el ? el.value : ''); return isFinite(n) ? n : (dflt === undefined ? 0 : dflt); }

  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return '—';
    const d = dec || 0;
    return n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(n, dec) { return fmt(Math.round((n || 0) * Math.pow(10, dec || 0)) / Math.pow(10, dec || 0), dec); }
  function pct(r, dec) { return (r * 100).toFixed(dec === undefined ? 2 : dec) + '%'; }

  /* ── ช่องกรอกเงิน: ใส่ comma สดๆ โดยรักษาตำแหน่งเคอร์เซอร์ ──
     (เวอร์ชันเดิมคำนวณ caret จากผลต่างความยาว ทำให้เคอร์เซอร์
     กระโดดไปท้ายช่องเวลาแก้กลางตัวเลขบนมือถือ) */
  function bindMoneyInput(el, onChange) {
    if (!el || el.dataset.moneyBound === '1') return;
    el.dataset.moneyBound = '1';
    if (!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'decimal');
    el.setAttribute('autocomplete', 'off');

    el.addEventListener('input', function () {
      const caret = this.selectionStart;
      const before = this.value;
      const digitsBefore = (before.slice(0, caret).match(/[\d.\-]/g) || []).length;

      let raw = before.replace(/,/g, '').replace(/[^\d.\-]/g, '');
      // เก็บได้แค่จุดทศนิยมเดียว และเครื่องหมายลบตัวแรก
      raw = raw.replace(/(?!^)-/g, '');
      const firstDot = raw.indexOf('.');
      if (firstDot !== -1) raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');

      if (raw === '' || raw === '-' || raw === '.') { this.value = raw; return; }

      const negative = raw[0] === '-';
      const body = negative ? raw.slice(1) : raw;
      const parts = body.split('.');
      const intPart = parts[0] === '' ? '0' : parts[0];
      const grouped = Number(intPart).toLocaleString('en-US');
      let out = (negative ? '-' : '') + grouped + (parts.length > 1 ? '.' + parts[1] : '');

      this.value = out;

      // วางเคอร์เซอร์กลับตรงหลักเดิม (นับจากจำนวนตัวเลขที่อยู่ก่อนหน้า)
      let seen = 0, pos = out.length;
      for (let i = 0; i < out.length; i++) {
        if (/[\d.\-]/.test(out[i])) seen++;
        if (seen >= digitsBefore) { pos = i + 1; break; }
      }
      try { this.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      if (typeof onChange === 'function') onChange(this);
    });
  }
  function bindAllMoney(root) {
    $$('[data-money]', root).forEach(el => bindMoneyInput(el));
  }

  /* ── Toast (แทน alert) ─────────────────────────────────── */
  let toastHost = null;
  function toast(msg, type, ms) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      document.body.appendChild(toastHost);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' is-' + type : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    toastHost.appendChild(t);
    setTimeout(() => {
      t.classList.add('is-out');
      setTimeout(() => t.remove(), 260);
    }, ms || 3200);
  }

  /* ── Confirm modal (แทน window.confirm) ────────────────── */
  function confirmModal(message, onOk, opts) {
    opts = opts || {};
    const host = document.createElement('div');
    host.className = 'modal-host';
    host.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<p></p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn" data-act="cancel">' + (opts.cancelText || 'ยกเลิก') + '</button>' +
          '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" data-act="ok">' + (opts.okText || 'ยืนยัน') + '</button>' +
        '</div>' +
      '</div>';
    host.querySelector('p').textContent = message;
    document.body.appendChild(host);

    const close = () => { host.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    host.addEventListener('click', (e) => { if (e.target === host) close(); });
    host.querySelector('[data-act="cancel"]').addEventListener('click', close);
    host.querySelector('[data-act="ok"]').addEventListener('click', () => { close(); if (onOk) onOk(); });
    host.querySelector('[data-act="ok"]').focus();
  }

  /* ── คัดลอกข้อความ ──
     navigator.clipboard ใช้ไม่ได้ใน iframe ที่ไม่ได้รับสิทธิ์ /
     บริบทที่ไม่ปลอดภัย จึงมี fallback เป็น textarea + execCommand */
  function copyText(text) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select(); ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        ta.remove();
        toast(ok ? 'คัดลอกข้อมูลแล้ว' : 'คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง', ok ? 'ok' : 'error');
      } catch (e) {
        toast('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง', 'error');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('คัดลอกข้อมูลแล้ว', 'ok'),
        fallback
      );
    } else { fallback(); }
  }

  /* ── ธีม Light / Dark ──────────────────────────────────── */
  const THEME_KEY = '2provi-theme';
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    $$('[data-theme-toggle]').forEach(btn => {
      btn.textContent = mode === 'light' ? '🌙' : '☀️';
      btn.setAttribute('aria-label', mode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง');
      btn.setAttribute('title', mode === 'light' ? 'สลับเป็นโหมดมืด' : 'สลับเป็นโหมดสว่าง');
    });
  }
  function initTheme() {
    // ค่าเริ่มต้นเป็นโหมดมืดเสมอ (ให้หน้าตาเหมือนกันทุกเครื่อง)
    // แล้วจำค่าที่ผู้ใช้เลือกไว้ใช้ครั้งต่อไป
    let mode = store.get(THEME_KEY);
    if (mode !== 'light' && mode !== 'dark') mode = 'dark';
    applyTheme(mode);
    $$('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next); store.set(THEME_KEY, next);
      });
    });
  }

  /* ── แท็บ ──────────────────────────────────────────────── */
  function initTabs(opts) {
    opts = opts || {};
    const tabs = $$('[data-tab]');
    const panels = $$('[data-tabpanel]');
    if (!tabs.length) return null;

    function go(name, silent) {
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.tabpanel === name));
      const idx = tabs.findIndex(t => t.dataset.tab === name);
      $$('[data-step-dot]').forEach((d, i) => {
        d.classList.toggle('is-active', i === idx);
        d.classList.toggle('is-done', i < idx);
      });
      // เลื่อนขึ้นบนสุดเสมอเมื่อเปลี่ยนแท็บ — บนมือถือเดิมจะค้างอยู่กลางหน้า
      if (!silent) {
        const top = document.querySelector('[data-scroll-anchor]');
        if (top) {
          const y = top.getBoundingClientRect().top + global.pageYOffset - 70;
          global.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }
      if (typeof opts.onChange === 'function') opts.onChange(name, idx);
    }

    tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
    $$('[data-goto-tab]').forEach(b => b.addEventListener('click', () => go(b.dataset.gotoTab)));
    go(opts.initial || tabs[0].dataset.tab, true);
    return { go };
  }

  /* ── โหลดสคริปต์ภายนอกแบบ lazy ─────────────────────────── */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.dataset.loaded === '1') return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('โหลดไลบรารีไม่สำเร็จ: ' + src));
      document.head.appendChild(s);
    });
  }

  /* ── สลับ input/select/textarea เป็นข้อความก่อนแคปเจอร์ ──
     html2canvas วาดค่าใน form element ไม่ครบ จึงต้องวาง <span>
     ทับไว้ชั่วคราว (ใช้ display:none กับตัวจริง ไม่แตะ position
     เพื่อไม่ให้ layout ยุบระหว่างสร้าง PDF) */
  function swapFieldsToText(root) {
    const items = [];
    $$('input, textarea, select', root).forEach(el => {
      if (el.type === 'range' || el.type === 'hidden' || el.offsetParent === null) return;
      let text;
      if (el.tagName === 'SELECT') {
        text = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
      } else {
        text = el.value !== '' ? el.value : (el.placeholder || '');
      }
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const span = document.createElement('span');
      span.textContent = text;
      span.dataset.pdfReplica = '1';
      span.style.cssText =
        'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
        'padding:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + ';' +
        'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';font-weight:' + cs.fontWeight + ';' +
        'text-align:' + cs.textAlign + ';border-radius:' + cs.borderRadius + ';';
      el.style.display = 'none';
      el.insertAdjacentElement('afterend', span);
      items.push({ el, span });
    });
    return items;
  }
  function restoreFields(items) {
    items.forEach(({ el, span }) => { el.style.display = ''; if (span) span.remove(); });
  }

  /* ไลบรารีสร้าง PDF — เก็บไว้ในเว็บเองเพื่อให้ทำงานได้ตอนออฟไลน์
     ถ้าไฟล์ในเครื่องหาย/เสีย ค่อยถอยไปโหลดจาก CDN */
  const LIB_H2C   = ['assets/vendor/html2canvas.min.js',
                     'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'];
  const LIB_JSPDF = ['assets/vendor/jspdf.umd.min.js',
                     'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];

  async function loadFirstAvailable(sources) {
    let lastErr;
    for (const src of sources) {
      try { await loadScript(src); return src; }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('โหลดไลบรารีไม่สำเร็จ');
  }

  /* ── ส่งออก PDF ────────────────────────────────────────────
     ลำดับการทำงาน:
     1) โหลด html2canvas + jsPDF (lazy) → สร้าง PDF จริง
     2) เปิดในแท็บใหม่ ถ้า popup ถูกบล็อกจะแสดงใน modal แทน
     3) ถ้าโหลดไลบรารีไม่ได้ (ออฟไลน์/CDN ถูกบล็อก) → window.print()
     4) ถ้า print ถูกบล็อกด้วย (sandboxed iframe) → แจ้งเตือนแทนการเงียบ */
  async function exportPDF(opts) {
    opts = opts || {};
    const target = typeof opts.target === 'string' ? document.querySelector(opts.target) : (opts.target || document.body);
    const fileName = (opts.fileName || 'report') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    const btn = opts.button || null;
    const label = btn ? (btn.querySelector('[data-btn-label]') || btn) : null;
    const original = label ? label.textContent : '';

    if (btn) { btn.disabled = true; }
    if (label) label.textContent = '⏳ กำลังสร้าง PDF...';

    let swapped = [];
    try {
      await Promise.all([loadFirstAvailable(LIB_H2C), loadFirstAvailable(LIB_JSPDF)]);
      if (!global.html2canvas || !global.jspdf) throw new Error('ไลบรารีไม่พร้อมใช้งาน');

      global.scrollTo(0, 0);
      document.body.classList.add('exporting-pdf');
      if (typeof opts.beforeCapture === 'function') opts.beforeCapture();
      await nextFrame(); await nextFrame();

      swapped = swapFieldsToText(target);
      await nextFrame(); await nextFrame();

      const SCALE = Math.min(2, (global.devicePixelRatio || 1) + 1);
      const rect = target.getBoundingClientRect();

      /* ตำแหน่งของแถวตารางทุกแถว — ใช้เลี่ยงไม่ให้จุดตัดหน้า PDF
         ไปตัดกลางแถว (ปัญหา "ตารางขาดครึ่ง") */
      const rowRanges = $$('tr', target).map(tr => {
        const r = tr.getBoundingClientRect();
        return { top: (r.top - rect.top) * SCALE, bottom: (r.bottom - rect.top) * SCALE };
      }).filter(r => r.bottom > r.top);

      const canvas = await global.html2canvas(target, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: target.scrollWidth,
        height: target.scrollHeight,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
        scrollX: 0, scrollY: 0
      });

      restoreFields(swapped); swapped = [];
      document.body.classList.remove('exporting-pdf');

      const { jsPDF } = global.jspdf;
      const pdf = new jsPDF('p', 'pt', 'a4');
      const MARGIN = 28;                                  // ~1 ซม.
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const contentW = pw - MARGIN * 2;
      const contentH = ph - MARGIN * 2;
      const pxPerPt = canvas.width / contentW;
      const pageHpx = contentH * pxPerPt;

      function safeBreak(boundary) {
        let changed = true, guard = 0;
        while (changed && guard++ < 12) {
          changed = false;
          for (const r of rowRanges) {
            if (boundary > r.top + 1 && boundary < r.bottom - 1) { boundary = r.top; changed = true; }
          }
        }
        return boundary;
      }

      let done = 0, page = 0;
      while (done < canvas.height - 1) {
        let boundary = Math.min(done + pageHpx, canvas.height);
        boundary = safeBreak(boundary);
        if (boundary <= done + 10) boundary = Math.min(done + pageHpx, canvas.height);

        const h = boundary - done;
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = h;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, done, canvas.width, h, 0, 0, canvas.width, h);

        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', MARGIN, MARGIN, contentW, h / pxPerPt);
        done = boundary; page++;
      }

      const url = URL.createObjectURL(pdf.output('blob'));
      const win = global.open(url, '_blank');
      if (!win) showPdfModal(url, fileName);
      return true;

    } catch (err) {
      restoreFields(swapped);
      document.body.classList.remove('exporting-pdf');
      // ── fallback: สั่งพิมพ์ตรงๆ ──
      try {
        if (typeof global.print === 'function') { global.print(); return true; }
        throw new Error('print ไม่พร้อมใช้งาน');
      } catch (e2) {
        toast('สร้าง PDF ไม่สำเร็จ: ' + (err && err.message ? err.message : err) +
              '\nกรุณาเปิดหน้านี้ในแท็บใหม่แล้วลองอีกครั้ง', 'error', 6000);
        return false;
      }
    } finally {
      restoreFields(swapped);
      document.body.classList.remove('exporting-pdf');
      if (typeof opts.afterCapture === 'function') opts.afterCapture();
      if (label) label.textContent = original;
      if (btn) btn.disabled = false;
    }
  }

  function nextFrame() { return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

  function showPdfModal(url, fileName) {
    const host = document.createElement('div');
    host.className = 'modal-host';
    host.innerHTML =
      '<div class="pdf-modal">' +
        '<div class="pdf-modal-bar">' +
          '<span class="name">📄 ' + fileName + '</span>' +
          '<span style="display:flex;gap:8px;flex-shrink:0">' +
            '<a class="btn btn-primary" download="' + fileName + '" href="' + url + '">⬇ ดาวน์โหลด</a>' +
            '<button type="button" class="btn" data-act="close">✕ ปิด</button>' +
          '</span>' +
        '</div>' +
        '<iframe title="ตัวอย่าง PDF" src="' + url + '"></iframe>' +
      '</div>';
    document.body.appendChild(host);
    host.querySelector('[data-act="close"]').addEventListener('click', () => {
      host.remove(); URL.revokeObjectURL(url);
    });
  }

  /* ── ปุ่มพิมพ์/ส่งออกอัตโนมัติ ─────────────────────────── */
  function initExportButtons() {
    $$('[data-export-pdf]').forEach(btn => {
      btn.addEventListener('click', () => exportPDF({
        target: btn.dataset.exportPdf || '[data-print-area]',
        fileName: btn.dataset.fileName || 'report',
        button: btn,
        beforeCapture: global.__beforeExport || null,
        afterCapture: global.__afterExport || null
      }));
    });
    $$('[data-print]').forEach(btn => {
      btn.addEventListener('click', () => {
        try { global.print(); }
        catch (e) { toast('เบราว์เซอร์บล็อกการสั่งพิมพ์ในกรอบนี้ กรุณาใช้ปุ่ม "บันทึก PDF" แทน', 'error', 5000); }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     PWA — ติดตั้งเป็นแอป / ทำงานออฟไลน์ / แจ้งเตือนเวอร์ชันใหม่
     ══════════════════════════════════════════════════════════ */
  const DISMISS_KEY = '2provi-install-dismissed';

  function isStandalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches)
        || global.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  let deferredPrompt = null;

  function showInstallCard(opts) {
    if (document.querySelector('.install-card')) return;
    const card = document.createElement('div');
    card.className = 'install-card';
    card.innerHTML =
      '<span class="ic" aria-hidden="true">📲</span>' +
      '<span class="tx"><b>' + opts.title + '</b><span>' + opts.body + '</span></span>' +
      (opts.action ? '<button type="button" class="btn btn-primary" data-act="go">' + opts.action + '</button>' : '') +
      '<button type="button" class="x" data-act="close" aria-label="ปิด">✕</button>';
    document.body.appendChild(card);

    const close = (remember) => {
      card.remove();
      if (remember) store.set(DISMISS_KEY, String(Date.now()));
    };
    card.querySelector('[data-act="close"]').addEventListener('click', () => close(true));
    const go = card.querySelector('[data-act="go"]');
    if (go) go.addEventListener('click', async () => {
      close(false);
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const res = await deferredPrompt.userChoice.catch(() => null);
        if (res && res.outcome === 'dismissed') store.set(DISMISS_KEY, String(Date.now()));
        deferredPrompt = null;
      }
    });
    setTimeout(() => { if (document.body.contains(card)) close(false); }, 20000);
  }

  function recentlyDismissed() {
    const t = parseInt(store.get(DISMISS_KEY) || '0', 10);
    return t > 0 && (Date.now() - t) < 14 * 24 * 3600 * 1000;   // เงียบไว้ 14 วัน
  }

  function initInstallPrompt() {
    if (isStandalone()) return;

    global.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (recentlyDismissed()) return;
      setTimeout(() => showInstallCard({
        title: 'ติดตั้งเป็นแอปได้',
        body: 'เพิ่มลงหน้าจอหลัก เปิดเร็วขึ้นและใช้งานได้แม้ไม่มีเน็ต',
        action: 'ติดตั้ง'
      }), 2500);
    });

    global.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      document.querySelectorAll('.install-card').forEach(c => c.remove());
      toast('ติดตั้งเป็นแอปเรียบร้อยแล้ว', 'ok');
    });

    // iOS ไม่รองรับ beferoinstallprompt — ต้องบอกวิธีเพิ่มเอง
    if (isIOS() && !recentlyDismissed()) {
      setTimeout(() => showInstallCard({
        title: 'เพิ่มลงหน้าจอหลัก',
        body: 'กดปุ่มแชร์ ⬆️ ด้านล่าง แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"',
        action: ''
      }), 3500);
    }
  }

  /* ป้ายแจ้งเมื่อไม่มีอินเทอร์เน็ต */
  function initOfflineBar() {
    let bar = null;
    const render = () => {
      const off = !navigator.onLine;
      document.body.classList.toggle('is-offline', off);
      if (off && !bar) {
        bar = document.createElement('div');
        bar.className = 'offline-bar';
        bar.setAttribute('role', 'status');
        bar.textContent = '📡 ออฟไลน์อยู่ — ใช้เครื่องมือและบันทึก PDF ได้ตามปกติ';
        document.body.appendChild(bar);
      } else if (!off && bar) {
        bar.remove(); bar = null;
      }
    };
    global.addEventListener('online', () => { render(); toast('กลับมาออนไลน์แล้ว', 'ok', 2000); });
    global.addEventListener('offline', render);
    render();
  }

  let updateAccepted = false;

  /* ลงทะเบียน service worker + แจ้งเมื่อมีเวอร์ชันใหม่ */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;      // เปิดจากไฟล์ตรงๆ ใช้ sw ไม่ได้

    global.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(reg);
            }
          });
        });
      }).catch((e) => console.warn('[pwa] ลงทะเบียน service worker ไม่สำเร็จ', e));

      /* โหลดหน้าใหม่เฉพาะตอนที่ผู้ใช้กด "อัปเดต" เท่านั้น
         (ถ้า reload ทุกครั้งที่ controller เปลี่ยน หน้าจะเด้งเองตั้งแต่
          เข้าเว็บครั้งแรก และข้อมูลที่กรอกค้างไว้จะหายหมด) */
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!updateAccepted || reloading) return;
        reloading = true;
        location.reload();
      });
    });
  }

  function showUpdateToast(reg) {
    const host = document.createElement('div');
    host.className = 'install-card';
    host.innerHTML =
      '<span class="ic" aria-hidden="true">✨</span>' +
      '<span class="tx"><b>มีเวอร์ชันใหม่แล้ว</b><span>กดอัปเดตเพื่อใช้เวอร์ชันล่าสุด</span></span>' +
      '<button type="button" class="btn btn-primary" data-act="go">อัปเดต</button>' +
      '<button type="button" class="x" data-act="close" aria-label="ปิด">✕</button>';
    document.body.appendChild(host);
    host.querySelector('[data-act="close"]').addEventListener('click', () => host.remove());
    host.querySelector('[data-act="go"]').addEventListener('click', () => {
      host.remove();
      updateAccepted = true;
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      else location.reload();
    });
  }

  /* เงาใต้แถบบนเมื่อเลื่อนหน้า — ให้รู้ว่าเนื้อหาเลื่อนอยู่ใต้แถบ */
  function initStickyBar() {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const onScroll = () => bar.classList.toggle('is-stuck', global.scrollY > 4);
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── init ทั่วไป ───────────────────────────────────────── */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(() => {
    initTheme();
    bindAllMoney(document);
    initExportButtons();
    initStickyBar();
    initOfflineBar();
    initInstallPrompt();
    // ปีปัจจุบันใน footer
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear() + 543; });
  });

  initServiceWorker();

  global.App = {
    $, $$, byId, num, numOf, intOf, floatOf, fmt, money, pct,
    bindMoneyInput, bindAllMoney, toast, confirm: confirmModal, copyText,
    initTabs, exportPDF, ready, store, isStandalone
  };
})(window);
