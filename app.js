(() => {
  const storageKey = 'ideal-machine-desktop';
  const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
  localStorage.removeItem('ideal-machine-layout');
  localStorage.removeItem('ideal-machine-removed-widgets');
  if (!state['calendar-image'] && state['calendar-avatar']) state['calendar-image'] = state['calendar-avatar'];
  const modal = document.querySelector('#editModal');
  const form = document.querySelector('#editForm');
  const title = document.querySelector('#editTitle');
  const desktop = document.querySelector('.desktop-scroll-wrap');
  const pageDots = [...document.querySelectorAll('.page-indicator .dot')];
  let activeGroup = null;

  const textLabels = { 'user-name': '用户昵称', 'char-name': '角色昵称', signature: '个性签名', 'calendar-note': '日历寄语' };
  const imageLabels = { 'user-avatar': '用户头像', 'char-avatar': '角色头像', 'calendar-image': '图片', 'photo-0': '第一张图片', 'photo-1': '第二张图片', 'photo-2': '第三张图片' };
  const groups = { profile: ['user-name', 'char-name', 'signature', 'user-avatar', 'char-avatar'], photos: ['photo-0', 'photo-1', 'photo-2'], calendar: ['calendar-note', 'calendar-image'] };
  const groupForKey = Object.fromEntries(Object.entries(groups).flatMap(([group, keys]) => keys.map(key => [key, group])));

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cssUrl = value => String(value).replace(/[)'"\\]/g, char => `\\${char}`);
  const saveState = () => localStorage.setItem(storageKey, JSON.stringify(state));
  function readImageFile(file, maxSize = 900, quality = .68) {
    return new Promise(resolve => {
      if (!file) return resolve('');
      let finished = false;
      const finish = value => { if (finished) return; finished = true; resolve(value || ''); };
      const reader = new FileReader();
      reader.onerror = () => finish('');
      reader.onload = () => {
        const source = String(reader.result || '');
        const image = new Image();
        image.onload = () => { try { const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale)); canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); const webp = canvas.toDataURL('image/webp', quality); finish(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)); } catch { finish(source); } };
        image.onerror = () => finish(source);
        image.src = source;
      };
      reader.readAsDataURL(file);
      setTimeout(() => finish(''), 8000);
    });
  }
  window.IdealMachineReadImage = readImageFile;
  const assetDBPromise = typeof indexedDB === 'undefined' ? Promise.resolve(null) : new Promise(resolve => { const request = indexedDB.open('ideal-machine-assets', 1); request.onupgradeneeded = () => request.result.createObjectStore('images'); request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null); });
  function putImageAsset(value) { return assetDBPromise.then(db => new Promise(resolve => { if (!db) return resolve(value); const id = 'idb:image:' + Date.now() + ':' + Math.random().toString(36).slice(2); const transaction = db.transaction('images', 'readwrite'); transaction.objectStore('images').put(String(value || ''), id); transaction.oncomplete = () => resolve(id); transaction.onerror = () => resolve(value); })); }
  function getImageAsset(value) { if (!String(value || '').startsWith('idb:image:')) return Promise.resolve(value); return assetDBPromise.then(db => new Promise(resolve => { if (!db) return resolve(''); const request = db.transaction('images').objectStore('images').get(value); request.onsuccess = () => resolve(request.result || ''); request.onerror = () => resolve(''); })); }
  window.IdealMachinePutImage = putImageAsset;
  window.IdealMachineGetImage = getImageAsset;
  function compactImageData(source, maxSize = 900, quality = .62) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL('image/webp', quality);
        const compacted = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
        resolve(compacted.length < String(source).length ? compacted : source);
      };
      image.onerror = () => resolve(source);
      image.src = source;
    });
  }
  async function compactStoredValue(value) {
    if (typeof value === 'string') return /^data:image\//i.test(value) && value.length > 120000 ? compactImageData(value) : value;
    if (Array.isArray(value)) return Promise.all(value.map(item => compactStoredValue(item)));
    if (value && typeof value === 'object') { const result = {}; for (const [key, item] of Object.entries(value)) result[key] = await compactStoredValue(item); return result; }
    return value;
  }
  window.IdealMachineCompactStoredValue = compactStoredValue;

  function imageField(key) {
    const value = state[key] || '';
    const urlValue = value.startsWith('data:') || value.startsWith('idb:image:') ? '' : value;
    return `<div class="edit-field image-edit-field"><label>${imageLabels[key]}</label><input data-image-url="${key}" type="url" placeholder="粘贴图片地址（可选）" value="${escapeHtml(urlValue)}"><label class="file-picker">选择图片<input class="edit-file" data-image-file="${key}" type="file" accept="image/*"></label><div class="edit-preview" data-image-preview="${key}"></div></div>`;
  }

  function fieldMarkup(key) {
    if (textLabels[key]) {
      const fallback = document.querySelector(`[data-edit="${key}"]`)?.textContent || '';
      return `<div class="edit-field"><label for="editText-${key}">${textLabels[key]}</label><input id="editText-${key}" type="text" maxlength="80" value="${escapeHtml(state[key] ?? fallback)}"></div>`;
    }
    if (key === 'todo') return `<div class="edit-field"><label for="editText-todo">每行一项待办</label><textarea id="editText-todo" placeholder="例如：\n买菜\n整理房间">${escapeHtml(state.todo || '')}</textarea></div>`;
    return imageField(key);
  }

  function fontSizeFields() {
    const fields = [['user-name', '用户昵称字号', state['user-name-size'] || 18], ['char-name', '角色昵称字号', state['char-name-size'] || 18], ['signature', '个性签名字号', state['signature-size'] || 13]];
    return fields.map(([key, label, value]) => `<div class="edit-field font-size-control"><label for="fontSize-${key}">${label}</label><input id="fontSize-${key}" data-font-size="${key}" type="number" min="10" max="30" step="1" value="${value}"><span class="font-size-value" data-font-value="${key}">px</span></div>`).join('');
  }

  function calendarFields() {
    return `<div class="edit-field font-size-control"><label for="fontSize-calendar-note">寄语字号</label><input id="fontSize-calendar-note" data-font-size="calendar-note" type="number" min="9" max="24" step="1" value="${state['calendar-note-size'] || 11}"><span class="font-size-value" data-font-value="calendar-note">px</span></div><div class="edit-field font-size-control"><label for="calendarNoteLeft">寄语左边距</label><input id="calendarNoteLeft" type="number" min="80" max="360" step="1" value="${state['calendar-note-left'] ?? 205}"><span class="font-size-value">px</span></div><div class="edit-field"><label for="calendarNoteAlign">寄语对齐方式</label><select id="calendarNoteAlign" class="edit-select"><option value="left" ${state['calendar-note-align'] !== 'center' && state['calendar-note-align'] !== 'right' ? 'selected' : ''}>左对齐</option><option value="center" ${state['calendar-note-align'] === 'center' ? 'selected' : ''}>居中对齐</option><option value="right" ${state['calendar-note-align'] === 'right' ? 'selected' : ''}>右对齐</option></select></div>`;
  }

  function openEditor(key) {
    activeGroup = groups[key] ? key : (groupForKey[key] || key);
    const keys = groups[activeGroup] || [activeGroup];
    title.textContent = activeGroup === 'profile' ? '编辑个人资料' : activeGroup === 'photos' ? '编辑图片' : activeGroup === 'calendar' ? '编辑日历' : activeGroup === 'todo' ? '编辑待办' : imageLabels[activeGroup] || '编辑';
    form.innerHTML = keys.map(fieldMarkup).join('') + (activeGroup === 'profile' ? fontSizeFields() : activeGroup === 'calendar' ? calendarFields() : activeGroup === 'todo' ? '<div class="edit-field font-size-control"><label for="fontSize-todo">待办文字字号</label><input id="fontSize-todo" data-font-size="todo" type="number" min="9" max="24" step="1" value="' + (state['todo-size'] || 12) + '"><span class="font-size-value" data-font-value="todo">px</span></div>' : '');
    form.querySelectorAll('[data-image-file]').forEach(input => input.addEventListener('change', previewLocalImage));
    form.querySelectorAll('[data-font-size]').forEach(input => input.addEventListener('input', event => { document.querySelector(`[data-font-value="${event.target.dataset.fontSize}"]`).textContent = `${event.target.value}px`; }));
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    keys.filter(key => String(state[key] || '').startsWith('idb:image:')).forEach(key => window.IdealMachineGetImage(state[key]).then(value => setBackground(document.querySelector(`[data-image-preview="${key}"]`), value)));
    form.querySelector('input, textarea')?.focus();
  }

  function closeEditor() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    form.replaceChildren();
    activeGroup = null;
  }

  function previewLocalImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBackground(document.querySelector(`[data-image-preview="${event.target.dataset.imageFile}"]`), reader.result);
    reader.readAsDataURL(file);
  }

  function readFile(file) {
    return window.IdealMachineReadImage(file);
  }

  async function saveEditor() {
    if (!activeGroup) return;
    const keys = groups[activeGroup] || [activeGroup];
    for (const key of keys) {
      if (textLabels[key] || key === 'todo') state[key] = document.querySelector(`#editText-${key}`).value.trim();
      else {
        const file = document.querySelector(`[data-image-file="${key}"]`).files[0];
        const url = document.querySelector(`[data-image-url="${key}"]`).value.trim();
        const uploadedImage = await readFile(file);
        if (uploadedImage) state[key] = window.IdealMachinePutImage ? await window.IdealMachinePutImage(uploadedImage) : uploadedImage;
        else if (url) state[key] = url;
      }
    }
    if (activeGroup === 'profile') ['user-name', 'char-name', 'signature'].forEach(key => { state[`${key}-size`] = Number(document.querySelector(`[data-font-size="${key}"]`).value); });
    if (activeGroup === 'calendar') { state['calendar-note-size'] = Number(document.querySelector('[data-font-size="calendar-note"]').value); state['calendar-note-left'] = Number(document.querySelector('#calendarNoteLeft').value); state['calendar-note-align'] = document.querySelector('#calendarNoteAlign').value; }
    if (activeGroup === 'todo') state['todo-size'] = Number(document.querySelector('[data-font-size="todo"]').value);
    try { saveState(); } catch (error) { try { const compacted = await compactStoredValue(state); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, compacted); saveState(); } catch { return window.alert('图片保存失败：Safari 的本地存储空间不足，请先清理旧图片后重试。'); } }
    render();
    closeEditor();
  }

  function setBackground(element, value) {
    if (!element || !value) return;
    element.style.backgroundImage = `url("${String(value).replace(/"/g, '\\"')}")`;
  }

  function render() {
    Object.keys(textLabels).forEach(key => {
      const element = document.querySelector(`[data-edit="${key}"]`);
      if (element && state[key]) element.textContent = state[key];
      if (element && state[`${key}-size`]) element.style.fontSize = `${state[`${key}-size`]}px`;
      if (element && key === 'calendar-note' && state['calendar-note-left'] !== undefined) element.style.left = `${state['calendar-note-left']}px`;
      if (element && key === 'calendar-note' && state['calendar-note-align']) element.style.textAlign = state['calendar-note-align'];
    });
    const todoSize = state['todo-size'] || 12;
    document.querySelectorAll('.todo-title, .todo-list, .todo-new-row').forEach(element => { element.style.fontSize = `${todoSize}px`; });
    const todoList = document.querySelector('.todo-list');
    if (todoList) todoList.innerHTML = (state.todo || '').split('\n').map(item => item.trim()).filter(Boolean).map(item => `<div class="todo-item">□ ${escapeHtml(item)}</div>`).join('');
    const todoHint = document.querySelector('.todo-new-row');
    if (todoHint) todoHint.style.display = (state.todo || '').trim() ? 'none' : '';
    Object.keys(imageLabels).forEach(key => {
      const element = document.querySelector(`[data-edit="${key}"]`);
      if (!element || !state[key]) return;
      const value = state[key];
      const applyImage = resolved => { if (!resolved) return; if (key === 'calendar-image') { element.replaceChildren(); const image = document.createElement('img'); image.src = resolved; image.alt = '图片'; element.appendChild(image); } else { setBackground(element, resolved); const preview = document.querySelector(`[data-image-preview="${key}"]`); if (preview) setBackground(preview, resolved); } };
      if (window.IdealMachineGetImage && String(value).startsWith('idb:image:')) window.IdealMachineGetImage(value).then(applyImage); else applyImage(value);
    });
  }

  async function migrateDesktopImages() { if (!window.IdealMachinePutImage) return; let changed = false; for (const key of Object.keys(imageLabels)) { const value = state[key]; if (!String(value || '').startsWith('data:image/')) continue; state[key] = await window.IdealMachinePutImage(value); changed = true; } if (changed) { try { saveState(); render(); } catch {} } }

  compactStoredValue(state).then(compacted => { Object.keys(state).forEach(key => delete state[key]); Object.assign(state, compacted); try { saveState(); render(); } catch {} });

  function updatePageIndicator() {
    if (!desktop || !pageDots.length) return;
    const pageIndex = Math.min(pageDots.length - 1, Math.round(desktop.scrollLeft / desktop.clientWidth));
    pageDots.forEach((dot, index) => dot.classList.toggle('active', index === pageIndex));
  }

  function formatDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

  function renderCalendar() {
    const daysElement = document.querySelector('.calendar-days');
    if (!daysElement) return;
    const today = new Date();
    let calendarEvents = [];
    try { calendarEvents = JSON.parse(localStorage.getItem('ideal-machine-calendar-events') || '[]'); } catch {}
    const eventDates = new Map(calendarEvents.map(item => [item.date, item.title || '纪念日']));
    const todayKey = formatDateKey(today);
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    document.querySelector('.date-calendar-year').textContent = `${today.getFullYear()}年`;
    document.querySelector('.date-calendar-month-day').textContent = `${today.getMonth() + 1}月${today.getDate()}日`;
    document.querySelector('.date-calendar-weekday').textContent = weekdayNames[today.getDay()];
    const firstWeek = new Date(today);
    firstWeek.setDate(today.getDate() - today.getDay() - 26 * 7);
    const weeks = [];
    let todayWeekIndex = 0;
    for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
      const weekStart = new Date(firstWeek);
      weekStart.setDate(firstWeek.getDate() + weekIndex * 7);
      const week = document.createElement('div'); week.className = 'calendar-week';
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = new Date(weekStart); date.setDate(weekStart.getDate() + dayIndex);
        const dateKey = formatDateKey(date);
        const day = document.createElement('span'); day.className = `calendar-day${dateKey === todayKey ? ' today' : ''}${eventDates.has(dateKey) ? ' has-event' : ''}`; day.textContent = date.getDate();
        if (eventDates.has(dateKey)) day.title = eventDates.get(dateKey);
        day.setAttribute('aria-label', `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`); week.appendChild(day);
        if (dateKey === todayKey) todayWeekIndex = weekIndex;
      }
      weeks.push(week);
    }
    daysElement.replaceChildren(...weeks);
    requestAnimationFrame(() => { daysElement.scrollTop = Math.max(0, todayWeekIndex * 22 - (daysElement.clientHeight - 20) / 2); });
  }
  window.IdealMachineRenderCalendar = renderCalendar;

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-edit]');
    if (target && !event.target.closest('#editModal')) openEditor(target.dataset.edit);
    if (event.target.closest('[data-edit-close]')) closeEditor();
  });
  document.querySelector('#editSave').addEventListener('click', saveEditor);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeGroup) closeEditor(); });
  desktop?.addEventListener('scroll', updatePageIndicator, { passive: true });
  window.addEventListener('resize', updatePageIndicator);
  renderCalendar();
  render();
  updatePageIndicator();
  migrateDesktopImages();

  const imageUrlSelectors = '#beautyWallpaperUrl, .chat-wallpaper-url, #contactAvatarUrl, #profileAvatarUrl, input[data-image-url], input[data-beauty-url]';
  function decorateImageUrlInputs(root = document) {
    root.querySelectorAll(imageUrlSelectors).forEach(input => {
      if (input.dataset.hasFetchButton) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'url-fetch-button'; button.dataset.urlFetch = 'true'; button.textContent = '获取';
      const field = document.createElement('div'); field.className = 'url-fetch-field'; input.replaceWith(field); field.append(input, button); input.dataset.hasFetchButton = 'true';
    });
  }
  function previewImageUrl(input) {
    const value = input.value.trim(); if (!value) return;
    const set = (element, url) => { if (element) element.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`; };
    if (input.matches('#beautyWallpaperUrl')) { set(document.body, value); set(document.querySelector('#beautyWallpaperPreview'), value); return; }
    if (input.matches('.chat-wallpaper-url')) { set(document.querySelector('.chat-conversation'), value); set(document.querySelector('.chat-wallpaper-preview'), value); return; }
    if (input.matches('input[data-image-url]')) { set(document.querySelector(`[data-image-preview="${input.dataset.imageUrl}"]`), value); return; }
    if (input.matches('input[data-beauty-url]')) { set(document.querySelector(`[data-beauty-preview="${input.dataset.beautyUrl}"]`), value); return; }
    const avatar = input.closest('.chat-avatar-picker')?.querySelector('.chat-editor-avatar');
    if (avatar) { avatar.innerHTML = `<img src="${value.replace(/"/g, '&quot;')}" alt="头像预览">`; avatar.style.backgroundImage = ''; }
  }
  document.addEventListener('click', event => { const button = event.target.closest('[data-url-fetch]'); if (!button) return; const input = button.previousElementSibling?.matches('input[type="url"]') ? button.previousElementSibling : button.parentElement?.querySelector('input[type="url"]'); if (input) { previewImageUrl(input); input.dispatchEvent(new Event('change', { bubbles: true })); } });
  decorateImageUrlInputs();
  new MutationObserver(() => decorateImageUrlInputs()).observe(document.body, { childList: true, subtree: true });
})();
