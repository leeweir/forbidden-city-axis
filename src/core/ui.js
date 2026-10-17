import { BUILDINGS, BUILDING_MAP, SHICHEN, DEFAULT_SHICHEN } from '../data/palace.js';

const fmtTime = (h) => `${String(h).padStart(2, '0')}:00`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class UI {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.activeId = null;
    this.timeIndex = DEFAULT_SHICHEN;
    this.tourActive = false;
    this.hoverId = null;

    this.axisList = document.getElementById('axis-list');
    this.panel = document.getElementById('panel');
    this.timepiece = document.getElementById('timepiece');
    this.marker = document.getElementById('marker');
    this.hint = document.getElementById('hint');
    this.loader = document.getElementById('loader');
    this.tourButton = document.querySelector('[data-action="tour"]');
    this.fullButton = document.querySelector('[data-action="fullscreen"]');
    this.resetButton = document.querySelector('[data-action="reset"]');

    this.buildAxis();
    this.buildTimepiece();
    this.renderOverview();
    this.bind();
    this.setTime(DEFAULT_SHICHEN, false);
    this.ready = false;
  }

  /* ---------------- 中轴九阙 ---------------- */
  buildAxis() {
    this.axisButtons = new Map();
    for (const b of BUILDINGS) {
      const btn = el('button', 'axis__item');
      btn.type = 'button';
      btn.dataset.id = b.id;
      btn.setAttribute('aria-label', `${b.order}，${b.name}，${b.rank}`);
      btn.append(
        el('span', 'axis__order', b.order),
        el('span', 'axis__name', b.name),
        el('span', 'axis__dot'),
      );
      btn.addEventListener('click', () => this.handlers.onSelect?.(b.id));
      this.axisList.append(btn);
      this.axisButtons.set(b.id, btn);
    }
  }

  setActive(id) {
    this.activeId = id;
    for (const [key, btn] of this.axisButtons) {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    }
    document.body.classList.toggle('has-selection', Boolean(id));
    if (id) {
      const data = BUILDING_MAP[id];
      if (data) this.renderBuilding(data);
    } else {
      this.renderOverview();
    }
  }

  /* ---------------- 信息卡 ---------------- */
  panelShell() {
    const inner = el('div', 'panel__inner');
    const watermark = el('div', 'panel__watermark');
    inner.append(watermark);
    this.panel.replaceChildren(inner);
    this.panel.classList.remove('is-entering');
    void this.panel.offsetWidth;
    this.panel.classList.add('is-entering');
    return inner;
  }

  renderOverview() {
    this.panel.classList.add('panel--overview');
    const inner = this.panelShell();
    inner.querySelector('.panel__watermark').textContent = '紫';
    const close = el('button', 'panel__close');
    close.type = 'button';
    close.innerHTML = '<span></span><span></span>';
    close.setAttribute('aria-label', '收起');
    close.classList.add('is-hidden');
    inner.append(close);

    const eyebrow = el('div', 'panel__eyebrow');
    eyebrow.append(el('span', 'panel__eyebrow-dot'), el('span', '', '概览 · 宫城'), el('span', 'panel__index', 'THE AXIS'));
    const title = el('h2', 'panel__title panel__title--overview');
    title.append(
      el('span', 'panel__title-line', '一座宫城'),
      el('span', 'panel__title-line', '一条中轴'),
      el('span', 'panel__en', 'THE FORBIDDEN CITY'),
    );
    const desc = el('p', 'panel__desc');
    desc.textContent = '自明永乐十八年建成，南北纵贯约九百六十米。九座门殿沿子午线依次铺展，把晨昏、日影与典礼收束在同一条轴线上。';
    const facts = el('dl', 'facts');
    for (const [k, v] of [
      ['始建', '明 · 1420 年'],
      ['占地', '约 72 万平方米'],
      ['中轴', '约 960 米'],
      ['世界遗产', '1987 年列入'],
    ]) {
      const item = el('div', 'fact');
      item.append(el('dt', '', k), el('dd', '', v));
      facts.append(item);
    }
    const foot = el('div', 'panel__foot');
    foot.append(el('span', 'panel__hintline', '点击殿宇或右侧中轴，开始巡礼'));
    const tourBtn = el('button', 'panel__next', '开始巡游');
    tourBtn.type = 'button';
    tourBtn.addEventListener('click', () => this.handlers.onTour?.());
    foot.append(tourBtn);
    inner.append(eyebrow, title, desc, facts, foot);
  }

  renderBuilding(data) {
    this.panel.classList.remove('panel--overview');
    const inner = this.panelShell();
    inner.querySelector('.panel__watermark').textContent = data.order;

    const close = el('button', 'panel__close');
    close.type = 'button';
    close.innerHTML = '<span></span><span></span>';
    close.setAttribute('aria-label', '返回概览');
    close.addEventListener('click', () => this.handlers.onOverview?.());
    inner.append(close);

    const eyebrow = el('div', 'panel__eyebrow');
    eyebrow.append(
      el('span', 'panel__eyebrow-dot'),
      el('span', '', data.court),
      el('span', 'panel__index', `NO.${String(BUILDINGS.indexOf(data) + 1).padStart(2, '0')}`),
    );
    const title = el('h2', 'panel__title');
    title.append(document.createTextNode(data.name), el('span', 'panel__en', data.en));
    const rank = el('p', 'panel__rank', data.rank);
    const ribbon = el('p', 'panel__ribbon', data.ribbon);
    const desc = el('p', 'panel__desc');
    desc.textContent = data.desc;

    const facts = el('dl', 'facts');
    for (const [k, v] of data.facts) {
      const item = el('div', 'fact');
      item.append(el('dt', '', k), el('dd', '', v));
      facts.append(item);
    }

    const idx = BUILDINGS.indexOf(data);
    const next = BUILDINGS[(idx + 1) % BUILDINGS.length];
    const foot = el('div', 'panel__foot');
    foot.append(el('span', 'panel__hintline', `${data.pinyin} · 中轴第${data.order}座`));
    const nextBtn = el('button', 'panel__next', `下一站 · ${next.name}`);
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => this.handlers.onSelect?.(next.id));
    foot.append(nextBtn);

    inner.append(eyebrow, title, rank, ribbon, desc, facts, foot);
  }

  /* ---------------- 天光 ---------------- */
  buildTimepiece() {
    const head = el('div', 'timepiece__head');
    head.append(
      el('span', 'eyebrow', '天光 · 十二时辰'),
      el('span', 'timepiece__coord', '39°54′N / 116°23′E'),
    );

    const row = el('div', 'timepiece__row');
    const prev = el('button', 'timepiece__step', '‹');
    prev.type = 'button';
    prev.setAttribute('aria-label', '上一时辰');
    prev.addEventListener('click', () => this.stepTime(-1));
    const now = el('div', 'timepiece__now');
    this.timeName = el('span', 'timepiece__name');
    this.timeDesc = el('span', 'timepiece__desc');
    now.append(this.timeName, this.timeDesc);
    const next = el('button', 'timepiece__step', '›');
    next.type = 'button';
    next.setAttribute('aria-label', '下一时辰');
    next.addEventListener('click', () => this.stepTime(1));
    row.append(prev, now, next);

    const rail = el('div', 'timepiece__rail');
    this.ticks = el('div', 'ticks');
    for (let i = 0; i < SHICHEN.length; i++) {
      const t = el('i');
      t.style.left = `${(i / (SHICHEN.length - 1)) * 100}%`;
      this.ticks.append(t);
    }
    this.timeInput = el('input', 'timepiece__input');
    this.timeInput.type = 'range';
    this.timeInput.min = '0';
    this.timeInput.max = String(SHICHEN.length - 1);
    this.timeInput.step = '1';
    this.timeInput.value = String(DEFAULT_SHICHEN);
    this.timeInput.setAttribute('aria-label', '十二时辰');
    this.timeInput.addEventListener('input', () => {
      const value = Number(this.timeInput.value);
      this.setTime(value);
      this.handlers.onTimeChange?.(value);
    });
    rail.append(this.ticks, this.timeInput);

    const labels = el('div', 'timepiece__labels');
    this.timeLabels = [];
    for (let i = 0; i < SHICHEN.length; i++) {
      const l = el('span', '', SHICHEN[i].name);
      l.style.left = `${(i / (SHICHEN.length - 1)) * 100}%`;
      labels.append(l);
      this.timeLabels.push(l);
    }

    this.timepiece.append(head, row, rail, labels);
  }

  setTime(index, notify = false) {
    const i = ((index % SHICHEN.length) + SHICHEN.length) % SHICHEN.length;
    this.timeIndex = i;
    const s = SHICHEN[i];
    this.timeName.textContent = s.label;
    this.timeDesc.textContent = `${s.desc} · ${fmtTime(s.hour)}`;
    this.timeInput.value = String(i);
    this.timeInput.style.setProperty('--p', `${(i / (SHICHEN.length - 1)) * 100}%`);
    this.timeInput.setAttribute('aria-valuetext', `${s.label} ${fmtTime(s.hour)}，${s.desc}`);
    this.ticks.querySelectorAll('i').forEach((t, k) => t.classList.toggle('is-past', k <= i));
    this.timeLabels?.forEach((t, k) => t.classList.toggle('is-active', k === i));
    if (notify) this.handlers.onTimeChange?.(i);
  }

  stepTime(dir) {
    this.setTime(this.timeIndex + dir, true);
  }

  setSkyHour(hour) {
    const h = ((hour % 24) + 24) % 24;
    const approx = SHICHEN.reduce((best, s, i) => (Math.abs(s.hour - h) < Math.abs(SHICHEN[best].hour - h) ? i : best), 0);
    if (approx !== this.timeIndex) this.setTime(approx, false);
  }

  /* ---------------- 巡游 / 全屏 ---------------- */
  bind() {
    this.tourButton?.addEventListener('click', () => this.handlers.onTour?.());
    this.resetButton?.addEventListener('click', () => this.handlers.onReset?.());
    this.fullButton?.addEventListener('click', () => this.handlers.onFullscreen?.());
    document.addEventListener('fullscreenchange', () => {
      this.setFullscreen(Boolean(document.fullscreenElement));
    });
  }

  setTourActive(active) {
    this.tourActive = active;
    document.body.classList.toggle('is-touring', active);
    if (this.tourButton) {
      this.tourButton.querySelector('.tool__label').textContent = active ? '结束巡游' : '巡游';
      this.tourButton.classList.toggle('is-on', active);
      this.tourButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  setFullscreen(active) {
    if (!this.fullButton) return;
    this.fullButton.querySelector('.tool__label').textContent = active ? '退出全屏' : '全屏';
    this.fullButton.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  /* ---------------- 地标 ---------------- */
  showMarker(data, x, y, active = false) {
    if (!this.marker || !data) {
      this.hideMarker();
      return;
    }
    if (this.markerId !== data.id) {
      this.marker.querySelector('.marker__name').textContent = data.name;
      this.marker.querySelector('.marker__en').textContent = data.en;
      this.markerId = data.id;
    }
    this.positionMarker(x, y);
    this.marker.classList.add('is-visible');
    this.marker.classList.toggle('is-active', active);
  }

  positionMarker(x, y) {
    if (!this.marker) return;
    this.marker.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
  }

  hideMarker() {
    this.marker?.classList.remove('is-visible');
    this.markerId = null;
  }

  /* ---------------- 提示与装载 ---------------- */
  showHint(text) {
    if (!this.hint) return;
    if (text) this.hint.textContent = text;
    this.hint.classList.add('is-visible');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hint.classList.remove('is-visible'), 9000);
  }

  dismissHint() {
    clearTimeout(this.hintTimer);
    this.hint?.classList.remove('is-visible');
  }

  finishLoading() {
    if (this.ready) return;
    this.ready = true;
    document.body.classList.add('is-ready');
    if (this.loader) {
      this.loader.classList.add('is-done');
      this.loader.setAttribute('aria-hidden', 'true');
      setTimeout(() => this.loader.remove(), 1200);
    }
  }

  setLoadingStatus(text) {
    const node = this.loader?.querySelector('.loader__status');
    if (node) node.textContent = text;
  }
}
