(() => {
  const storageKey = 'ideal-machine-worldbooks';
  const categories = { global: '全局世界书', local: '局部世界书', forum: '论坛世界书' };
  const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
  Object.keys(categories).forEach(key => { if (!Array.isArray(data[key])) data[key] = []; });
  let activeCategory = 'global';
  let activeBookId = null;
  let editorTarget = null;
  let analysisBookId = null;
  let analysisText = '';
  let analysisBusy = false;
  let apiHint = '';

  const app = document.createElement('div');
  app.className = 'worldbook-app';
  app.innerHTML = `<div class="worldbook-page"><header class="worldbook-header"><div><div class="worldbook-kicker">KNOWLEDGE SYSTEM</div><h1>世界书</h1><p>将设定、关系与秩序，安静地收纳在一起。</p></div><button class="worldbook-close" data-world-close type="button">×</button></header><nav class="worldbook-tabs" aria-label="世界书分类">${Object.entries(categories).map(([key, label]) => `<button data-world-category="${key}" type="button">${label}</button>`).join('')}</nav><main class="worldbook-main"><section class="worldbook-books"><div class="worldbook-section-head"><div><span class="worldbook-eyebrow">LIBRARIES</span><h2 id="worldbookCategoryTitle"></h2></div><button class="worldbook-add-book" data-world-add-book type="button">＋ 新建</button></div><div class="worldbook-book-list" id="worldbookBookList"></div></section><section class="worldbook-entries"><div class="worldbook-section-head"><div><span class="worldbook-eyebrow">ENTRIES</span><h2 id="worldbookBookTitle">选择一本世界书</h2></div><div class="worldbook-entry-actions"><button class="worldbook-analyze" data-world-analyze type="button">AI 分析</button><button class="worldbook-add-entry" data-world-add-entry type="button">＋ 条目</button></div><small class="worldbook-api-hint" id="worldbookApiHint"></small></div><div class="worldbook-entry-list" id="worldbookEntryList"></div><section class="worldbook-analysis" id="worldbookAnalysis" hidden></section></section></main></div><div class="world-editor" id="worldEditor" aria-hidden="true"><div class="world-editor-backdrop" data-world-editor-close></div><section class="world-editor-sheet"><div class="world-editor-head"><div><span class="worldbook-eyebrow">EDIT</span><h2 id="worldEditorTitle">编辑世界书</h2></div><button type="button" data-world-editor-close>×</button></div><div id="worldEditorForm"></div><div class="world-editor-actions"><button type="button" class="world-editor-cancel" data-world-editor-close>取消</button><button type="button" class="world-editor-save" data-world-editor-save>保存</button></div></section></div>`;
  document.body.appendChild(app);
  const worldbookTabs = app.querySelector('.worldbook-tabs');
  const worldbookAddBook = app.querySelector('[data-world-add-book]');
  const worldbookLibraryHead = app.querySelector('.worldbook-books > .worldbook-section-head');
  if (worldbookTabs && worldbookAddBook && worldbookLibraryHead) worldbookLibraryHead.appendChild(worldbookAddBook);

  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const save = () => localStorage.setItem(storageKey, JSON.stringify(data));
  const books = () => data[activeCategory];
  const activeBook = () => books().find(book => book.id === activeBookId);

  function render() {
    document.querySelector('#worldbookCategoryTitle').textContent = categories[activeCategory];
    document.querySelectorAll('[data-world-category]').forEach(button => button.classList.toggle('is-active', button.dataset.worldCategory === activeCategory));
    const bookList = document.querySelector('#worldbookBookList');
    bookList.innerHTML = books().length ? books().map(book => `<div class="worldbook-book ${book.id === activeBookId ? 'is-active' : ''}" data-world-book="${book.id}" role="button" tabindex="0"><span class="worldbook-book-mark"></span><span class="worldbook-book-info"><b>${esc(book.name)}</b><small>${book.entries.length} 个条目</small></span><span class="worldbook-book-actions"><button class="worldbook-book-edit" data-world-edit-book="${book.id}" type="button">编辑</button><button class="worldbook-book-delete" data-world-delete-book="${book.id}" type="button">删除</button></span></div>`).join('') : '<div class="worldbook-empty">还没有世界书<br><small>从右上角新建一本开始</small></div>';
    const book = activeBook();
    document.querySelector('#worldbookBookTitle').textContent = book ? book.name : '选择一本世界书';
    document.querySelector('[data-world-add-entry]').disabled = !book;
    const analyzeButton = document.querySelector('[data-world-analyze]');
    analyzeButton.hidden = activeCategory !== 'local';
    analyzeButton.disabled = activeCategory !== 'local' || !book || analysisBusy;
    document.querySelector('#worldbookApiHint').textContent = activeCategory === 'local' ? apiHint : '';
    const entryList = document.querySelector('#worldbookEntryList');
    entryList.innerHTML = book ? (book.entries.length ? book.entries.map(entry => `<article class="worldbook-entry"><div class="worldbook-entry-copy"><h3>${esc(entry.name)}</h3><p>${esc(entry.content).replace(/\n/g, '<br>')}</p></div><div class="worldbook-entry-actions"><button data-world-edit-entry="${entry.id}" type="button">编辑</button><button data-world-delete-entry="${entry.id}" type="button">删除</button></div></article>`).join('') : '<div class="worldbook-empty">这本世界书还没有条目<br><small>添加一个设定、人物或规则</small></div>') : '<div class="worldbook-empty">选择左侧世界书查看条目</div>';
    const analysis = document.querySelector('#worldbookAnalysis');
    analysis.hidden = !(activeCategory === 'local' && analysisBookId === activeBookId && analysisText);
    analysis.innerHTML = analysis.hidden ? '' : `<div class="worldbook-analysis-head"><span class="worldbook-eyebrow">AI READING</span><b>世界书解析</b></div><div class="worldbook-analysis-copy">${esc(analysisText).replace(/\n/g, '<br>')}</div>`;
  }

  async function analyzeBook() {
    const book = activeBook();
    const config = window.IdealMachineAPI?.getConfig?.();
    const model = window.IdealMachineAPI?.getModel?.('worldbook');
    if (!book || activeCategory !== 'local') return;
    if (!config?.endpoint || !config.key || !model) { apiHint = '请在设置中接入并选择世界书 API 模型。'; render(); return; }
    apiHint = '';
    analysisBusy = true; analysisBookId = book.id; analysisText = '正在分析整本世界书，请稍候…'; render();
    const entries = book.entries.map(entry => `【${entry.name}】\n${entry.content}`).join('\n\n');
    const prompt = `请分析以下${categories[activeCategory]}设定。只依据提供的内容，使用中文输出结构清晰的分析，包含：\n1. NPC 清单与每个 NPC 的身份、性格、动机；\n2. 角色时间线，按时间顺序整理；\n3. 关键事件及其影响；\n4. 人物关系网，用“人物A — 关系 — 人物B”列出；\n5. 设定中存在的冲突、空白或待确认信息。\n\n世界书分类：${categories[activeCategory]}\n世界书名称：${book.name}\n\n${entries}`;
    try {
      const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` }, body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: '你是一个严谨的世界观编辑。' }, { role: 'user', content: prompt }] }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      analysisText = payload.choices?.[0]?.message?.content || 'API 没有返回分析内容。';
    } catch (error) { analysisText = `分析失败：${error.message}`; }
    analysisBusy = false; render();
  }

  function openEditor(target, payload = {}) {
    editorTarget = target;
    const isEntry = target === 'entry';
    document.querySelector('#worldEditorTitle').textContent = isEntry ? (payload.id ? '编辑世界书条目' : '新增世界书条目') : (payload.id ? '编辑世界书' : '新增世界书');
    document.querySelector('#worldEditorForm').innerHTML = isEntry ? `<label class="world-editor-field">条目名称<input id="worldEntryName" maxlength="60" value="${esc(payload.name || '')}" placeholder="例如：城市的季节规律"></label><label class="world-editor-field">条目内容<textarea id="worldEntryContent" placeholder="写下这个条目的完整设定、规则或背景">${esc(payload.content || '')}</textarea></label>` : `<label class="world-editor-field">世界书名称<input id="worldName" maxlength="40" value="${esc(payload.name || '')}" placeholder="例如：角色关系设定"></label>`;
    document.querySelector('#worldEditor').classList.add('is-open');
    document.querySelector('#worldEditor').setAttribute('aria-hidden', 'false');
    document.querySelector('#worldEditorForm input, #worldEditorForm textarea')?.focus();
  }

  function closeEditor() { document.querySelector('#worldEditor').classList.remove('is-open'); document.querySelector('#worldEditor').setAttribute('aria-hidden', 'true'); editorTarget = null; }

  function saveEditor() {
    if (editorTarget === 'book') {
      const name = document.querySelector('#worldName').value.trim();
      if (!name) return;
      const existing = activeBook();
      if (existing) existing.name = name;
      else { const book = { id: uid('book'), name, entries: [] }; books().unshift(book); activeBookId = book.id; }
    } else if (editorTarget === 'entry') {
      const book = activeBook();
      if (!book) return;
      const name = document.querySelector('#worldEntryName').value.trim();
      const content = document.querySelector('#worldEntryContent').value.trim();
      if (!name || !content) return;
      const targetId = document.querySelector('#worldEditorForm').dataset.entryId;
      const existing = book.entries.find(entry => entry.id === targetId);
      if (existing) { existing.name = name; existing.content = content; }
      else book.entries.push({ id: uid('entry'), name, content });
    }
    save(); render(); closeEditor();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-app-key="shijieshu"]')) { app.classList.add('is-open'); render(); return; }
    if (!app.classList.contains('is-open')) return;
    if (event.target.closest('[data-world-close]')) { app.classList.remove('is-open'); closeEditor(); return; }
    const category = event.target.closest('[data-world-category]');
    if (category) { activeCategory = category.dataset.worldCategory; activeBookId = null; apiHint = ''; render(); return; }
    const bookButton = event.target.closest('[data-world-book]');
    if (bookButton && !event.target.closest('[data-world-edit-book]') && !event.target.closest('[data-world-delete-book]')) { activeBookId = bookButton.dataset.worldBook; render(); return; }
    const editBook = event.target.closest('[data-world-edit-book]');
    if (editBook) { const book = books().find(item => item.id === editBook.dataset.worldEditBook); if (book) { activeBookId = book.id; openEditor('book', book); } return; }
    const deleteBook = event.target.closest('[data-world-delete-book]');
    if (deleteBook) {
      const index = books().findIndex(item => item.id === deleteBook.dataset.worldDeleteBook);
      if (index >= 0 && window.confirm('确定删除这本世界书吗？其中的所有条目也会被删除。')) {
        const deletedId = books()[index].id;
        books().splice(index, 1);
        if (activeBookId === deletedId) activeBookId = books()[0]?.id || null;
        save(); render();
      }
      return;
    }
    if (event.target.closest('[data-world-add-book]')) { activeBookId = null; openEditor('book'); return; }
    if (event.target.closest('[data-world-add-entry]')) { document.querySelector('#worldEditorForm').dataset.entryId = ''; openEditor('entry'); return; }
    if (event.target.closest('[data-world-analyze]')) { analyzeBook(); return; }
    const editEntry = event.target.closest('[data-world-edit-entry]');
    if (editEntry) { const entry = activeBook()?.entries.find(item => item.id === editEntry.dataset.worldEditEntry); if (entry) { document.querySelector('#worldEditorForm').dataset.entryId = entry.id; openEditor('entry', entry); } }
    const deleteEntry = event.target.closest('[data-world-delete-entry]');
    if (deleteEntry) {
      const book = activeBook();
      const index = book?.entries.findIndex(item => item.id === deleteEntry.dataset.worldDeleteEntry) ?? -1;
      if (book && index >= 0 && window.confirm('确定删除这个世界书条目吗？')) {
        book.entries.splice(index, 1);
        save(); render();
      }
      return;
    }
    if (event.target.closest('[data-world-editor-close]')) closeEditor();
    if (event.target.closest('[data-world-editor-save]')) saveEditor();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && app.classList.contains('is-open')) { if (document.querySelector('#worldEditor').classList.contains('is-open')) closeEditor(); else app.classList.remove('is-open'); } });
})();
