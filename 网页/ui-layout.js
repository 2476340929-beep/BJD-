/* Group existing controls without replacing their event handlers. */
(() => {
  const controls = document.querySelector('#controls');
  const top = controls.querySelector('.crow.top');
  const appearance = document.createElement('div');
  appearance.className = 'property-group'; appearance.id = 'appearanceTools';
  const position = document.createElement('div');
  position.className = 'property-group'; position.id = 'positionTools'; position.hidden = true;
  function move(target, selectors) { selectors.forEach(selector => target.append(controls.querySelector(selector))); }
  move(appearance, ['#opSlider', '.lbl', '#blendSel']);
  move(position, ['.angle-lbl', '#angMinus', '#angPlus', '#flipBtn', '#pairBtn', '.step-btns', '#stepVal']);
  const opacityLabel = document.createElement('label'); opacityLabel.htmlFor = 'opSlider'; opacityLabel.textContent = '不透明度'; appearance.prepend(opacityLabel);
  const tabs = document.createElement('div'); tabs.className = 'property-tabs'; tabs.setAttribute('aria-label', '属性分组');
  for (const [name, panel] of [['外观', appearance], ['位置', position]]) {
    const button = document.createElement('button'); button.textContent = name; button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-pressed', String(!panel.hidden));
    button.onclick = () => { appearance.hidden = panel !== appearance; position.hidden = panel !== position; tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); syncBarH(); };
    tabs.append(button);
  }
  const remove = document.createElement('button'); remove.id = 'removeSelected'; remove.textContent = '删除选中'; remove.className = 'danger';
  remove.onclick = () => { const d = sel(); if (d) removeDecal(d.id); };
  position.append(remove);
  controls.querySelectorAll('.crow:not(.top)').forEach(row => row.remove());
  controls.append(tabs, appearance, position);
  const eye = document.querySelector('#eyeBtn'); eye.classList.add('lib-btn'); eye.append(document.createTextNode('眼珠微调'));
  new ResizeObserver(syncBarH).observe(controls);

  const panel = document.querySelector('#sheet .panel');
  const heading = panel.querySelector('h3'); heading.textContent = '底图与方案';
  const header = document.createElement('div'); header.className = 'sheet-heading';
  const close = document.createElement('button'); close.textContent = '完成'; close.onclick = () => document.querySelector('#sheet').classList.remove('open');
  header.append(heading, close); panel.prepend(header);
  const body = document.createElement('div'); body.className = 'sheet-body'; panel.append(body);
  function section(title, ids) {
    const group = document.createElement('section'); const h = document.createElement('h4'); h.textContent = title; group.append(h);
    ids.forEach(id => group.append(document.getElementById(id))); body.append(group);
  }
  section('底图', ['embedDefaultBtn','embedAnanBtn','uploadBaseBtn','centerBaseBtn','adjBaseBtn','resetBaseBtn']);
  section('眼眶修整', ['redetectEyesBtn','pickEyeBtn','editEdgesBtn','clearEyesBtn']);
  section('方案', ['savedLbl','newProjBtn','projList']);
  section('应用', ['installBtn']);
  panel.querySelectorAll(':scope > h3').forEach(h => h.remove());
  body.append(document.querySelector('#sheetCancel'));
  document.querySelector('#eyeBgPick').setAttribute('aria-label','自选眼孔底色');
  const library = document.querySelector('#drawer');
  const manage = document.createElement('button'); manage.id = 'libraryManage'; manage.textContent = '管理'; manage.setAttribute('aria-pressed', 'false');
  manage.onclick = () => library.classList.toggle('managing');
  library.querySelector('.dr-head').insertBefore(manage, document.querySelector('#drawerClose'));
  new MutationObserver(() => {
    if (!library.classList.contains('open') && library.classList.contains('managing')) library.classList.remove('managing');
    const active = library.classList.contains('managing');
    manage.textContent = active ? '完成管理' : '管理'; manage.setAttribute('aria-pressed', String(active));
  }).observe(library, {attributes:true, attributeFilter:['class']});
  syncBarH();
})();
