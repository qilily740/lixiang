(() => {
  const eventsKey = 'ideal-machine-calendar-events';
  const coupleKey = 'ideal-machine-couple';
  const chatKey = 'ideal-machine-chat';
  const app = document.createElement('div'); app.className = 'calendar-app';
  document.body.appendChild(app);
  const today = new Date(); let month = new Date(); let selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; let editorOpen = false;
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = () => `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const readEvents = () => { try { const events = JSON.parse(localStorage.getItem(eventsKey) || '[]'); return Array.isArray(events) ? events : []; } catch { return []; } };
  const readChat = () => { try { const value = JSON.parse(localStorage.getItem(chatKey) || '{}'); return { contacts: value.contacts || [] }; } catch { return { contacts: [] }; } };
  const saveEvents = events => { localStorage.setItem(eventsKey, JSON.stringify(events)); try { const couple = JSON.parse(localStorage.getItem(coupleKey) || '{}'); couple.events = events; localStorage.setItem(coupleKey, JSON.stringify(couple)); } catch {} window.IdealMachineRenderCalendar?.(); };
  const roleName = id => { const role = readChat().contacts.find(item => item.id === id); return role?.nickname || role?.name || '未绑定角色'; };
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthTitle = () => `${month.getFullYear()}年${month.getMonth() + 1}月`;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  function render() {
    const events = readEvents(); const monthEvents = events.filter(item => String(item.date || '').startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`));
    const selectedEvents = events.filter(item => item.date === selectedDate);
    const cells = []; for (let i = 0; i < firstDay; i += 1) cells.push('<span class="calendar-empty-day"></span>'); for (let day = 1; day <= daysInMonth; day += 1) { const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day)); const has = events.some(item => item.date === key); cells.push(`<button class="calendar-date-cell ${key === selectedDate ? 'is-selected' : ''} ${has ? 'has-event' : ''}" data-calendar-date="${key}" type="button">${day}</button>`); }
    app.innerHTML = `<section class="calendar-page"><header class="calendar-app-header"><div><span>PERSONAL CALENDAR</span><h1>日历</h1></div><button data-calendar-close type="button">×</button></header><main class="calendar-main"><section class="calendar-month-head"><button data-calendar-prev type="button">‹</button><h2>${monthTitle()}</h2><button data-calendar-next type="button">›</button></section><section class="calendar-week-head"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></section><section class="calendar-month-grid">${cells.join('')}</section><section class="calendar-day-section"><div class="calendar-day-title"><div><span>${selectedDate}</span><h2>这一天</h2></div><button class="calendar-add" data-calendar-add type="button">添加</button></div>${selectedEvents.length ? selectedEvents.map(eventCard).join('') : '<p class="calendar-empty">这一天还没有安排。</p>'}</section><section class="calendar-upcoming"><span>THIS MONTH</span><h2>本月纪念日</h2>${monthEvents.length ? monthEvents.map(eventCard).join('') : '<p class="calendar-empty">本月还没有纪念日。</p>'}</section></main>${editorOpen ? editor() : ''}</section>`;
  }
  function eventCard(item) { return `<article class="calendar-event-card"><div class="calendar-event-mark ${item.author === 'role' ? 'is-role' : ''}">♡</div><div><b>${esc(item.title)}</b><small>${esc(item.date)} · ${item.author === 'role' ? `角色添加：${esc(roleName(item.authorId))}` : `和${esc(roleName(item.contactId))}的纪念日`}</small></div><button data-calendar-delete="${esc(item.id)}" type="button">×</button></article>`; }
  function editor() { const contacts = readChat().contacts; return `<div class="calendar-editor"><div class="calendar-editor-backdrop" data-calendar-editor-close></div><section><header><h2>添加纪念日</h2><button data-calendar-editor-close type="button">×</button></header><label>纪念日名称<input id="calendarEventTitle" placeholder="例如：第一次见面"></label><label>日期<input id="calendarEventDate" type="date" value="${esc(selectedDate)}"></label><label>关联角色<select id="calendarEventContact"><option value="">不绑定角色</option>${contacts.map(item => `<option value="${esc(item.id)}">${esc(item.nickname || item.name)}</option>`).join('')}</select></label><footer><button data-calendar-editor-close type="button">取消</button><button data-calendar-editor-save type="button">保存</button></footer></section></div>`; }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-app-key="rili"]')) { app.classList.add('is-open'); render(); return; }
    if (!app.classList.contains('is-open')) return;
    if (event.target.closest('[data-calendar-close]')) { app.classList.remove('is-open'); return; }
    if (event.target.closest('[data-calendar-prev]')) { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); render(); return; }
    if (event.target.closest('[data-calendar-next]')) { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); render(); return; }
    const date = event.target.closest('[data-calendar-date]'); if (date) { selectedDate = date.dataset.calendarDate; month = new Date(`${selectedDate}T12:00:00`); render(); return; }
    if (event.target.closest('[data-calendar-add]')) { editorOpen = true; render(); return; }
    if (event.target.closest('[data-calendar-editor-close]')) { editorOpen = false; render(); return; }
    const del = event.target.closest('[data-calendar-delete]'); if (del) { if (window.confirm('确定删除这条日程吗？')) { saveEvents(readEvents().filter(item => item.id !== del.dataset.calendarDelete)); render(); } return; }
    if (event.target.closest('[data-calendar-editor-save]')) { const title = app.querySelector('#calendarEventTitle')?.value.trim(); const date = app.querySelector('#calendarEventDate')?.value; if (!title || !date) return window.alert('请填写纪念日名称和日期。'); const events = readEvents(); events.push({ id: uid(), title, date, contactId: app.querySelector('#calendarEventContact')?.value || '', author: 'user' }); saveEvents(events); selectedDate = date; month = new Date(`${date}T12:00:00`); editorOpen = false; render(); }
  });
  window.IdealMachineApps = window.IdealMachineApps || {}; window.IdealMachineApps.rili = { name: '日历' };
})();
