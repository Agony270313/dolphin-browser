const tabs = [];
let activeTabId = null;
let incognitoMode = false;
let adBlockEnabled = true;
let tabCounter = 0;

const tabsContainer = document.getElementById('tabs-container');
const webviewContainer = document.getElementById('webview-container');
const addressBar = document.getElementById('address-bar');
const bookmarksBar = document.getElementById('bookmarks-bar');
const downloadPanel = document.getElementById('download-panel');
const downloadList = document.getElementById('download-list');
const newtabContainer = document.getElementById('newtab-container');
const menuDropdown = document.getElementById('menu-dropdown');
const autocompleteDropdown = document.getElementById('address-autocomplete');
const tabPreview = document.getElementById('tab-preview');
const gestureOverlay = document.getElementById('gesture-overlay');
const gestureHint = document.getElementById('gesture-hint');

let bookmarks = JSON.parse(localStorage.getItem('dolphin_bookmarks') || '[]');

/* ===================== SETTINGS ===================== */
const DEFAULT_SETTINGS = {
  theme: 'dark',
  searchEngine: 'google',
  startup: 'newtab',
  adBlock: true,
  saveHistory: true,
  mouseGestures: true,
  tabDiscard: true,
  backgroundThrottle: true,
  autoCleanup: true
};

function getSettings() {
  try {
    const s = localStorage.getItem('dolphin_settings');
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem('dolphin_settings', JSON.stringify(settings));
  applySettings(settings);
}

function applySettings(settings) {
  if (settings.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  adBlockEnabled = settings.adBlock;
  const adBtn = document.getElementById('btn-adblock');
  if (adBtn) adBtn.classList.toggle('active', adBlockEnabled);

  const themeSel = document.getElementById('setting-theme');
  const engineSel = document.getElementById('setting-search-engine');
  const startupSel = document.getElementById('setting-startup');
  const adCheck = document.getElementById('setting-adblock');
  const histCheck = document.getElementById('setting-save-history');
  const gestureCheck = document.getElementById('setting-mouse-gestures');
  const discardCheck = document.getElementById('setting-tab-discard');
  const throttleCheck = document.getElementById('setting-background-throttle');
  const cleanupCheck = document.getElementById('setting-auto-cleanup');

  if (themeSel) themeSel.value = settings.theme;
  if (engineSel) engineSel.value = settings.searchEngine;
  if (startupSel) startupSel.value = settings.startup;
  if (adCheck) adCheck.checked = settings.adBlock;
  if (histCheck) histCheck.checked = settings.saveHistory;
  if (gestureCheck) gestureCheck.checked = settings.mouseGestures;
  if (discardCheck) discardCheck.checked = settings.tabDiscard;
  if (throttleCheck) throttleCheck.checked = settings.backgroundThrottle;
  if (cleanupCheck) cleanupCheck.checked = settings.autoCleanup;
}

function getSearchUrl(query, engine) {
  const encoded = encodeURIComponent(query);
  switch (engine) {
    case 'duckduckgo': return `https://duckduckgo.com/?q=${encoded}`;
    case 'bing': return `https://www.bing.com/search?q=${encoded}`;
    default: return `https://www.google.com/search?q=${encoded}`;
  }
}

/* ===================== HISTORY ===================== */
function addHistoryItem(url, title) {
  const settings = getSettings();
  if (!settings.saveHistory) return;
  if (!url || url === 'about:blank' || url.startsWith('chrome://') || url.startsWith('data:')) return;

  let history = JSON.parse(localStorage.getItem('dolphin_history') || '[]');
  if (history.length > 0 && history[0].url === url) {
    history[0].title = title || history[0].title;
    history[0].timestamp = Date.now();
  } else {
    history.unshift({ url, title: title || url, timestamp: Date.now(), id: Date.now().toString() + Math.random().toString(36).substr(2, 5) });
  }
  if (history.length > 1000) history = history.slice(0, 1000);
  localStorage.setItem('dolphin_history', JSON.stringify(history));
  renderHistory();
}

function getHistory() {
  return JSON.parse(localStorage.getItem('dolphin_history') || '[]');
}

function clearHistory() {
  localStorage.removeItem('dolphin_history');
  renderHistory();
}

function deleteHistoryItem(id) {
  let history = getHistory();
  history = history.filter(h => h.id !== id);
  localStorage.setItem('dolphin_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const history = getHistory();

  if (!list || !empty) return;

  if (history.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = '';

  const groups = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  history.forEach(item => {
    const date = new Date(item.timestamp).toDateString();
    let label;
    if (date === today) label = 'Bugun';
    else if (date === yesterday) label = 'Dun';
    else label = new Date(item.timestamp).toLocaleDateString('tr-TR');

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  Object.keys(groups).forEach(label => {
    const groupEl = document.createElement('div');
    groupEl.className = 'history-group';
    groupEl.innerHTML = `<div class="history-date">${escapeHtml(label)}</div>`;

    groups[label].forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-info">
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-url">${escapeHtml(item.url)}</div>
        </div>
        <button class="history-delete" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      el.querySelector('.history-info').addEventListener('click', () => {
        closeAllPanels();
        performSearch(item.url);
      });
      el.querySelector('.history-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });
      groupEl.appendChild(el);
    });

    list.appendChild(groupEl);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ===================== PANELS ===================== */
function closeAllPanels() {
  ['history-panel', 'settings-panel', 'download-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  if (menuDropdown) menuDropdown.classList.add('hidden');
  if (autocompleteDropdown) autocompleteDropdown.classList.add('hidden');
}

function openPanel(panelId) {
  closeAllPanels();
  const el = document.getElementById(panelId);
  if (el) el.classList.remove('hidden');
}

/* ===================== TOP SITES ===================== */
function getTopSites() {
  let stored = JSON.parse(localStorage.getItem('dolphin_topsites') || '[]');
  if (stored.length === 0) {
    stored = [
      { url: 'https://www.google.com', title: 'Google', count: 100 },
      { url: 'https://www.youtube.com', title: 'YouTube', count: 100 },
      { url: 'https://github.com', title: 'GitHub', count: 100 },
      { url: 'https://twitter.com', title: 'X', count: 100 },
      { url: 'https://www.reddit.com', title: 'Reddit', count: 100 },
      { url: 'https://www.wikipedia.org', title: 'Wikipedia', count: 100 },
      { url: 'https://stackoverflow.com', title: 'Stack Overflow', count: 100 },
      { url: 'https://news.ycombinator.com', title: 'Hacker News', count: 100 },
    ];
  }
  return stored.slice(0, 8);
}

function updateTopSites(url, title) {
  if (!url || !/^https?:\/\//.test(url)) return;
  let stored = JSON.parse(localStorage.getItem('dolphin_topsites') || '[]');
  const idx = stored.findIndex(s => s.url === url);
  if (idx >= 0) {
    stored[idx].count = (stored[idx].count || 0) + 1;
    if (title) stored[idx].title = title;
  } else {
    stored.push({ url, title: title || url, count: 1 });
  }
  stored.sort((a, b) => (b.count || 0) - (a.count || 0));
  localStorage.setItem('dolphin_topsites', JSON.stringify(stored));
}

function getFaviconLetter(title) {
  return (title && title[0]) ? title[0].toUpperCase() : '?';
}

/* ===================== SEARCH ===================== */
function performSearch(rawInput) {
  const input = rawInput.trim();
  if (!input) return;
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;

  const settings = getSettings();
  let url = input;
  if (!/^https?:\/\//i.test(input)) {
    if (input.includes('.') && !input.includes(' ')) {
      url = 'https://' + input;
    } else {
      url = getSearchUrl(input, settings.searchEngine);
    }
  }

  activeTab.isNewTab = false;
  activeTab.webview.style.display = 'flex';
  newtabContainer.classList.add('hidden');
  activeTab.webview.loadURL(url);
  addressBar.value = url;
  autocompleteDropdown.classList.add('hidden');
}

/* ===================== NEW TAB PAGE ===================== */
function renderNewtab() {
  newtabContainer.innerHTML = `
    <div class="newtab-content">
      <div class="newtab-brand">
        <div class="newtab-icon">
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: var(--accent)">
            <path d="M75 65C70 75 55 85 40 80C30 77 20 65 18 50C16 35 28 20 45 15C55 12 65 18 70 25C72 28 75 30 80 28C82 27 85 28 87 30C88 32 87 34 85 35C80 38 75 45 78 52C80 58 78 62 75 65Z" fill="currentColor"/>
            <circle cx="62" cy="28" r="3" fill="var(--bg-secondary)"/>
            <path d="M40 80C35 88 25 92 15 90" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/>
            <path d="M20 65C12 68 5 62 2 55" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>
            <path d="M45 50C55 55 70 50 80 40" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>
          </svg>
        </div>
        <div class="newtab-title">Dolphin</div>
      </div>
      <div class="newtab-search-box">
        <input type="text" id="newtab-search" placeholder="Arama yap veya adres gir..." autocomplete="off">
      </div>
      <div class="newtab-topsites" id="topsites-grid"></div>
    </div>
  `;

  const searchInput = document.getElementById('newtab-search');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });
  setTimeout(() => searchInput.focus(), 50);

  renderTopSites();
}

function renderTopSites() {
  const grid = document.getElementById('topsites-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const sites = getTopSites();
  sites.forEach(site => {
    const el = document.createElement('div');
    el.className = 'topsite-item';
    el.title = site.url;
    el.innerHTML = `
      <div class="topsite-icon">${getFaviconLetter(site.title)}</div>
      <div class="topsite-title">${escapeHtml(site.title)}</div>
    `;
    el.addEventListener('click', () => performSearch(site.url));
    grid.appendChild(el);
  });
}

/* ===================== TABS ===================== */
function createTab(url = null, isIncognito = false) {
  tabCounter++;
  const tabId = tabCounter;
  const partition = isIncognito ? `private-${Date.now()}-${tabId}` : 'persist:dolphin';

  const webview = document.createElement('webview');
  webview.setAttribute('src', 'about:blank');
  webview.setAttribute('partition', partition);
  webview.setAttribute('allowpopups', 'on');
  webview.setAttribute('nodeintegration', 'no');
  webview.setAttribute('plugins', 'no');
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.display = 'none';

  // Audio events
  webview.addEventListener('media-started-playing', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isPlayingAudio = true;
      updateTabAudioIcon(tabId);
    }
  });

  webview.addEventListener('media-paused', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.isPlayingAudio = false;
      updateTabAudioIcon(tabId);
    }
  });

  webview.addEventListener('dom-ready', () => {
    if (adBlockEnabled) {
      webview.insertCSS(adBlockCSS).catch(() => {});
    }
  });

  webview.addEventListener('did-start-loading', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      if (tab.isNewTab) return;
      if (activeTabId === tabId) {
        setReloadIcon(true);
      }
      updateTabUI(tabId, true);
    }
  });

  webview.addEventListener('did-stop-loading', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      if (tab.isNewTab) return;
      if (activeTabId === tabId) {
        addressBar.value = webview.getURL() || '';
        setReloadIcon(false);
      }
      updateTabUI(tabId, false);
      updateTopSites(webview.getURL(), webview.getTitle());
      addHistoryItem(webview.getURL(), webview.getTitle());
    }
  });

  webview.addEventListener('did-navigate', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      if (activeTabId === tabId && !tab.isNewTab) {
        addressBar.value = e.url;
      }
      updateTabUI(tabId);
      if (!tab.isNewTab) addHistoryItem(e.url, tab.title || e.url);
    }
  });

  webview.addEventListener('page-title-updated', () => {
    updateTabUI(tabId);
  });

  webview.addEventListener('page-favicon-updated', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.favicon = e.favicons[0] || '';
      updateTabUI(tabId);
    }
  });

  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    createTab(e.url, isIncognito);
  });

  webviewContainer.appendChild(webview);

  const tab = {
    id: tabId,
    title: 'Yeni Sekme',
    url: 'about:blank',
    favicon: '',
    webview: webview,
    isIncognito: isIncognito,
    isNewTab: true,
    isPlayingAudio: false
  };
  tabs.push(tab);

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.tabId = tabId;
  tabEl.innerHTML = `<span class="tab-title">Yeni Sekme</span><span class="tab-audio hidden"></span><span class="tab-close">&times;</span>`;
  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close') || e.target.closest('.tab-close')) {
      closeTab(tabId);
    } else if (e.target.classList.contains('tab-audio') || e.target.closest('.tab-audio')) {
      e.stopPropagation();
      toggleTabAudio(tabId);
    } else {
      switchTab(tabId);
    }
  });

  // Tab preview events
  tabEl.addEventListener('mouseenter', () => showTabPreview(tabId, tabEl));
  tabEl.addEventListener('mouseleave', () => hideTabPreview());

  tabsContainer.appendChild(tabEl);

  if (url) {
    switchTab(tabId);
    performSearch(url);
  } else {
    switchTab(tabId);
  }
  return tab;
}

function switchTab(tabId) {
  closeAllPanels();

  // Restore discarded tab if needed
  restoreDiscardedTab(tabId);

  activeTabId = tabId;
  updateTabLastActive(tabId);

  tabs.forEach(t => {
    const el = document.querySelector(`.tab[data-tab-id="${t.id}"]`);
    if (el) el.classList.toggle('active', t.id === tabId);

    if (t.id === tabId) {
      if (t.isNewTab) {
        t.webview.style.display = 'none';
        newtabContainer.classList.remove('hidden');
        renderNewtab();
        addressBar.value = '';
        addressBar.placeholder = 'Dolphin Search ile ara...';
      } else {
        t.webview.style.display = 'flex';
        newtabContainer.classList.add('hidden');
        addressBar.value = t.webview.getURL() || t.url || '';
        addressBar.placeholder = 'Dolphin Search ile ara...';
      }
    } else {
      t.webview.style.display = 'none';
    }
  });
}

function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  const tab = tabs[idx];
  tab.webview.remove();
  const el = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (el) el.remove();
  tabs.splice(idx, 1);

  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newIdx = Math.min(idx, tabs.length - 1);
      switchTab(tabs[newIdx].id);
    } else {
      activeTabId = null;
      createTab();
    }
  }
}

function updateTabUI(tabId, loading = false) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  const el = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (!el) return;

  const title = tab.isNewTab ? 'Yeni Sekme' : (tab.webview.getTitle() || 'Yukleniyor...');
  tab.title = title;
  tab.url = tab.webview.getURL() || tab.url;

  const titleEl = el.querySelector('.tab-title');
  titleEl.textContent = title;

  if (loading) {
    el.classList.add('loading');
  } else {
    el.classList.remove('loading');
  }
}

function updateTabAudioIcon(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  const el = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (!el) return;
  const audioEl = el.querySelector('.tab-audio');
  if (!audioEl) return;

  if (tab.isPlayingAudio) {
    audioEl.classList.remove('hidden');
    audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    audioEl.title = 'Sesi kapat';
  } else {
    audioEl.classList.add('hidden');
    audioEl.innerHTML = '';
  }
}

function toggleTabAudio(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.webview.setAudioMuted(!tab.webview.isAudioMuted());
  const el = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (el) {
    const audioEl = el.querySelector('.tab-audio');
    if (audioEl) {
      if (tab.webview.isAudioMuted()) {
        audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
        audioEl.title = 'Sesi ac';
      } else {
        updateTabAudioIcon(tabId);
      }
    }
  }
}

/* ===================== TAB PREVIEW ===================== */
function showTabPreview(tabId, tabEl) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || tab.isNewTab) return;

  const rect = tabEl.getBoundingClientRect();
  tabPreview.querySelector('.tab-preview-title').textContent = tab.title || 'Yeni Sekme';
  tabPreview.querySelector('.tab-preview-url').textContent = tab.url || '';

  const timeEl = tabPreview.querySelector('.tab-preview-time');
  const history = getHistory();
  const historyItem = history.find(h => h.url === tab.url);
  if (historyItem) {
    const diff = Date.now() - historyItem.timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) timeEl.textContent = 'Az once';
    else if (minutes < 60) timeEl.textContent = `${minutes} dk once`;
    else if (hours < 24) timeEl.textContent = `${hours} saat once`;
    else timeEl.textContent = new Date(historyItem.timestamp).toLocaleDateString('tr-TR');
  } else {
    timeEl.textContent = '';
  }

  tabPreview.style.left = `${rect.left}px`;
  tabPreview.style.top = `${rect.bottom + 4}px`;
  tabPreview.classList.remove('hidden');
}

function hideTabPreview() {
  tabPreview.classList.add('hidden');
}

/* ===================== AD BLOCK ===================== */
const adBlockCSS = `
  [id*="google_ads"], [id*="ads-"], [class*="ad-"], [class*="ads-"],
  iframe[src*="ads"], iframe[src*="ad."], iframe[src*="doubleclick"],
  .advertisement, .ad-banner, .sponsored, [class*="sponsored"],
  [id*="taboola"], [id*="outbrain"], .trc_related_container, .ad_container,
  ins.adsbygoogle, .adsbygoogle, [id*="google-ad"],
  [data-ad-slot], [data-ad-client] { display: none !important; visibility: hidden !important; height: 0 !important; }
`;

/* ===================== NAV BUTTONS ===================== */
addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    closeAllPanels();
    performSearch(addressBar.value);
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    navigateAutocomplete(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (e.key === 'Escape') {
    autocompleteDropdown.classList.add('hidden');
    return;
  }
});

addressBar.addEventListener('input', () => {
  renderAutocomplete(addressBar.value);
});

addressBar.addEventListener('focus', () => {
  renderAutocomplete(addressBar.value);
});

document.addEventListener('click', (e) => {
  if (!addressBar.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
    autocompleteDropdown.classList.add('hidden');
  }
});

/* ===================== AUTOCOMPLETE ===================== */
let selectedAutocompleteIndex = -1;

function renderAutocomplete(query) {
  const q = query.trim().toLowerCase();
  const history = getHistory();
  const topsites = getTopSites();
  const bms = bookmarks;
  const results = [];

  if (!q) {
    autocompleteDropdown.classList.add('hidden');
    return;
  }

  // History matches
  const historyMatches = history
    .filter(h => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
    .slice(0, 4)
    .map(h => ({ ...h, type: 'history' }));

  // Bookmark matches
  const bookmarkMatches = bms
    .filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q))
    .slice(0, 3)
    .map(b => ({ ...b, type: 'bookmark' }));

  // Top site matches
  const topMatches = topsites
    .filter(s => s.title.toLowerCase().includes(q) || s.url.toLowerCase().includes(q))
    .slice(0, 3)
    .map(s => ({ ...s, type: 'top' }));

  // Search suggestion
  const settings = getSettings();
  const searchUrl = getSearchUrl(query, settings.searchEngine);
  results.push({ title: `"${query}" ara`, url: searchUrl, type: 'search' });

  results.push(...historyMatches, ...bookmarkMatches, ...topMatches);

  if (results.length === 0) {
    autocompleteDropdown.classList.add('hidden');
    return;
  }

  autocompleteDropdown.innerHTML = '';
  selectedAutocompleteIndex = -1;

  let lastType = null;
  results.forEach((item, index) => {
    if (item.type !== lastType && item.type !== 'search') {
      const section = document.createElement('div');
      section.className = 'autocomplete-section-title';
      const labels = { history: 'Gecmis', bookmark: 'Yer Imleri', top: 'Sik Kullanilan' };
      section.textContent = labels[item.type] || '';
      autocompleteDropdown.appendChild(section);
      lastType = item.type;
    }

    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.dataset.index = index;

    const icons = {
      search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      history: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      bookmark: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
      top: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
    };

    el.innerHTML = `
      <span class="autocomplete-icon">${icons[item.type] || icons.search}</span>
      <div class="autocomplete-info">
        <div class="autocomplete-title">${escapeHtml(item.title)}</div>
        <div class="autocomplete-url">${escapeHtml(item.url)}</div>
      </div>
      <span class="autocomplete-type">${item.type === 'search' ? 'Arama' : ''}</span>
    `;

    el.addEventListener('click', () => {
      performSearch(item.url);
    });

    autocompleteDropdown.appendChild(el);
  });

  autocompleteDropdown.classList.remove('hidden');
}

function navigateAutocomplete(direction) {
  const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
  if (items.length === 0) return;

  selectedAutocompleteIndex += direction;
  if (selectedAutocompleteIndex < 0) selectedAutocompleteIndex = items.length - 1;
  if (selectedAutocompleteIndex >= items.length) selectedAutocompleteIndex = 0;

  items.forEach((item, idx) => {
    item.classList.toggle('selected', idx === selectedAutocompleteIndex);
  });

  const selected = items[selectedAutocompleteIndex];
  if (selected) {
    const title = selected.querySelector('.autocomplete-title').textContent;
    const url = selected.querySelector('.autocomplete-url').textContent;
    if (title.startsWith('"')) {
      addressBar.value = title.replace(/^"|" ara$/g, '');
    } else {
      addressBar.value = url;
    }
  }
}

/* ===================== KEYBOARD SHORTCUTS ===================== */
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;

  switch (e.key.toLowerCase()) {
    case 't':
      e.preventDefault();
      createTab(null, incognitoMode);
      break;
    case 'w':
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
      break;
    case 'r':
      e.preventDefault();
      document.getElementById('btn-reload').click();
      break;
    case 'l':
      e.preventDefault();
      addressBar.focus();
      addressBar.select();
      break;
    case 'h':
      e.preventDefault();
      renderHistory();
      openPanel('history-panel');
      break;
    case 'd':
      e.preventDefault();
      document.getElementById('btn-bookmark').click();
      break;
    case 'n':
      e.preventDefault();
      if (window.electronAPI && window.electronAPI.newWindow) {
        window.electronAPI.newWindow();
      }
      break;
    case '1': case '2': case '3': case '4': case '5':
    case '6': case '7': case '8': case '9':
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (tabs[idx]) switchTab(tabs[idx].id);
      break;
  }
});

/* ===================== MOUSE GESTURES ===================== */
let gestureActive = false;
let gesturePoints = [];
let gestureCtx = null;

function initGestureCanvas() {
  gestureCtx = gestureOverlay.getContext('2d');
  gestureOverlay.width = window.innerWidth;
  gestureOverlay.height = window.innerHeight;
}

window.addEventListener('resize', () => {
  if (gestureCtx) {
    gestureOverlay.width = window.innerWidth;
    gestureOverlay.height = window.innerHeight;
  }
});

document.addEventListener('mousedown', (e) => {
  const settings = getSettings();
  if (!settings.mouseGestures) return;
  if (e.button !== 2) return; // Right click only
  if (e.target.closest('#top-bar') || e.target.closest('#tab-bar') || e.target.closest('#sidebar')) return;

  gestureActive = true;
  gesturePoints = [{ x: e.clientX, y: e.clientY }];
  gestureOverlay.classList.remove('hidden');
  if (!gestureCtx) initGestureCanvas();

  gestureCtx.clearRect(0, 0, gestureOverlay.width, gestureOverlay.height);
  gestureCtx.beginPath();
  gestureCtx.moveTo(e.clientX, e.clientY);
  gestureCtx.strokeStyle = 'var(--accent)';
  gestureCtx.lineWidth = 3;
  gestureCtx.lineCap = 'round';
  gestureCtx.lineJoin = 'round';
});

document.addEventListener('mousemove', (e) => {
  if (!gestureActive) return;
  gesturePoints.push({ x: e.clientX, y: e.clientY });

  gestureCtx.lineTo(e.clientX, e.clientY);
  gestureCtx.stroke();

  // Show hint based on direction
  const gesture = detectGesture(gesturePoints);
  if (gesture) {
    gestureHint.classList.remove('hidden');
    const labels = { left: 'Geri', right: 'Ileri', down: 'Yenile' };
    gestureHint.textContent = labels[gesture] || '';
  }
});

document.addEventListener('mouseup', (e) => {
  if (!gestureActive) return;
  gestureActive = false;
  gestureOverlay.classList.add('hidden');
  gestureHint.classList.add('hidden');

  const gesture = detectGesture(gesturePoints);
  if (!gesture) return;

  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.isNewTab) return;

  switch (gesture) {
    case 'left':
      if (activeTab.webview.canGoBack()) activeTab.webview.goBack();
      break;
    case 'right':
      if (activeTab.webview.canGoForward()) activeTab.webview.goForward();
      break;
    case 'down':
      activeTab.webview.reload();
      break;
  }
});

// Disable context menu during gestures
document.addEventListener('contextmenu', (e) => {
  const settings = getSettings();
  if (settings.mouseGestures && gesturePoints.length > 3) {
    e.preventDefault();
  }
});

function detectGesture(points) {
  if (points.length < 5) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Minimum distance threshold
  if (absDx < 40 && absDy < 40) return null;

  if (absDx > absDy) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

/* ===================== NAV BUTTONS ===================== */
document.getElementById('btn-back').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webview.canGoBack()) activeTab.webview.goBack();
});

document.getElementById('btn-forward').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webview.canGoForward()) activeTab.webview.goForward();
});

document.getElementById('btn-reload').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.isNewTab) return;
  activeTab.webview.reload();
});

document.getElementById('btn-home').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;
  activeTab.isNewTab = true;
  activeTab.webview.stop();
  activeTab.webview.style.display = 'none';
  newtabContainer.classList.remove('hidden');
  renderNewtab();
  addressBar.value = '';
  addressBar.placeholder = 'Dolphin Search ile ara...';
});

document.getElementById('btn-new-tab').addEventListener('click', () => {
  createTab(null, incognitoMode);
});

/* ===================== SIDEBAR ===================== */
document.getElementById('sb-home').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;
  activeTab.isNewTab = true;
  activeTab.webview.stop();
  activeTab.webview.style.display = 'none';
  newtabContainer.classList.remove('hidden');
  renderNewtab();
  addressBar.value = '';
  addressBar.placeholder = 'Dolphin Search ile ara...';
});

document.getElementById('sb-bookmarks').addEventListener('click', () => {
  const isVisible = bookmarksBar.style.display !== 'none' && bookmarksBar.style.display !== '';
  bookmarksBar.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) renderBookmarks();
});

document.getElementById('sb-downloads').addEventListener('click', () => {
  openPanel('download-panel');
});

document.getElementById('sb-history').addEventListener('click', () => {
  renderHistory();
  openPanel('history-panel');
});

document.getElementById('sb-settings').addEventListener('click', () => {
  openPanel('settings-panel');
});

/* ===================== BOOKMARKS ===================== */
function renderBookmarks() {
  bookmarksBar.innerHTML = '';
  if (bookmarks.length === 0) {
    bookmarksBar.style.display = 'none';
    return;
  }
  bookmarksBar.style.display = 'flex';
  bookmarks.forEach((bm, index) => {
    const el = document.createElement('div');
    el.className = 'bookmark-item';
    el.textContent = bm.title;
    el.title = bm.url;
    el.addEventListener('click', () => {
      closeAllPanels();
      performSearch(bm.url);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`"${bm.title}" yer imini silmek istiyor musunuz?`)) {
        bookmarks.splice(index, 1);
        localStorage.setItem('dolphin_bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
      }
    });
    bookmarksBar.appendChild(el);
  });
}

document.getElementById('btn-bookmark').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.isNewTab) return;
  const url = activeTab.webview.getURL();
  const title = activeTab.webview.getTitle() || 'Basliksiz';
  if (!url || url === 'about:blank') return;
  if (!bookmarks.find(b => b.url === url)) {
    bookmarks.push({ title, url });
    localStorage.setItem('dolphin_bookmarks', JSON.stringify(bookmarks));
    renderBookmarks();
    bookmarksBar.style.display = 'flex';
    alert('Yer imi eklendi!');
  } else {
    alert('Bu sayfa zaten yer imlerinde.');
  }
});

/* ===================== INCOGNITO & AD BLOCK ===================== */
document.getElementById('btn-incognito').addEventListener('click', () => {
  incognitoMode = !incognitoMode;
  const btn = document.getElementById('btn-incognito');
  btn.classList.toggle('active', incognitoMode);
  btn.style.color = incognitoMode ? '#cba6f7' : '';
});

document.getElementById('btn-adblock').addEventListener('click', () => {
  adBlockEnabled = !adBlockEnabled;
  const btn = document.getElementById('btn-adblock');
  btn.classList.toggle('active', adBlockEnabled);
  const settings = getSettings();
  settings.adBlock = adBlockEnabled;
  saveSettings(settings);

  tabs.forEach(tab => {
    if (adBlockEnabled) {
      tab.webview.insertCSS(adBlockCSS).catch(() => {});
    } else {
      tab.webview.executeJavaScript(`
        document.querySelectorAll('style').forEach(s => {
          if(s.textContent.includes('dolphin-adblock') || s.textContent.includes('google_ads')) s.remove();
        });
      `).catch(() => {});
    }
  });
});

/* ===================== DOWNLOADS ===================== */
document.getElementById('btn-close-downloads').addEventListener('click', () => {
  downloadPanel.classList.add('hidden');
});

if (window.electronAPI) {
  window.electronAPI.onDownloadStarted((download) => {
    downloadPanel.classList.remove('hidden');
    const li = document.createElement('li');
    li.id = `dl-${download.id}`;
    li.innerHTML = `
      <span class="dl-name">${escapeHtml(download.filename)}</span>
      <span class="dl-progress">Basladi...</span>
    `;
    downloadList.appendChild(li);
  });

  window.electronAPI.onDownloadUpdated((download) => {
    const li = document.getElementById(`dl-${download.id}`);
    if (!li) return;
    const progress = li.querySelector('.dl-progress');
    if (download.state === 'progressing') {
      const percent = download.totalBytes > 0
        ? Math.round((download.receivedBytes / download.totalBytes) * 100)
        : 0;
      progress.textContent = `%${percent}`;
    } else if (download.state === 'completed') {
      progress.textContent = 'Tamamlandi';
      progress.classList.add('completed');
    } else if (download.state === 'cancelled') {
      progress.textContent = 'Iptal edildi';
    } else if (download.state === 'interrupted') {
      progress.textContent = 'Hata';
    }
  });
}

/* ===================== MENU DROPDOWN ===================== */
document.getElementById('btn-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!menuDropdown.contains(e.target) && e.target.id !== 'btn-menu') {
    menuDropdown.classList.add('hidden');
  }
});

document.getElementById('menu-new-tab').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  createTab(null, incognitoMode);
});

document.getElementById('menu-new-window').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  if (window.electronAPI && window.electronAPI.newWindow) {
    window.electronAPI.newWindow();
  } else {
    alert('Yeni pencere ozelligi gelistirme asamasinda.');
  }
});

document.getElementById('menu-bookmarks').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  const isVisible = bookmarksBar.style.display !== 'none' && bookmarksBar.style.display !== '';
  bookmarksBar.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) renderBookmarks();
});

document.getElementById('menu-history').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  renderHistory();
  openPanel('history-panel');
});

document.getElementById('menu-downloads').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  openPanel('download-panel');
});

document.getElementById('menu-settings').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  openPanel('settings-panel');
});

document.getElementById('menu-about').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  alert('Dolphin Browser v2.0.0\nChromium tabanli modern web tarayicisi.\n\nYeni ozellikler:\n- Klavye kisayollari\n- Fare hareketleri\n- Sekme onizleme\n- Gelistirilmis adres cubugu\n- Sekme ses kontrolu');
});

document.getElementById('menu-exit').addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
  if (window.electronAPI) window.electronAPI.closeWindow();
});

/* ===================== WINDOW CONTROLS ===================== */
function updateMaximizeIcon(isMaximized) {
  const btn = document.getElementById('btn-maximize');
  if (!btn) return;
  if (isMaximized) {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;
    btn.title = 'Kucult';
  } else {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
    btn.title = 'Tam Ekran';
  }
}

document.getElementById('btn-minimize').addEventListener('click', () => {
  if (window.electronAPI) window.electronAPI.minimizeWindow();
});

document.getElementById('btn-maximize').addEventListener('click', () => {
  if (window.electronAPI) window.electronAPI.maximizeWindow();
});

document.getElementById('btn-close').addEventListener('click', () => {
  if (window.electronAPI) window.electronAPI.closeWindow();
});

if (window.electronAPI) {
  window.electronAPI.isMaximized().then(updateMaximizeIcon);
  window.electronAPI.onMaximizedChange((isMaximized) => {
    updateMaximizeIcon(isMaximized);
  });
}

/* ===================== HISTORY PANEL ===================== */
document.getElementById('btn-close-history').addEventListener('click', () => {
  document.getElementById('history-panel').classList.add('hidden');
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
  if (confirm('Tum gezinti gecmisi silinecek. Emin misiniz?')) {
    clearHistory();
  }
});

/* ===================== SETTINGS PANEL ===================== */
document.getElementById('btn-close-settings').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.add('hidden');
});

document.getElementById('setting-theme').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.theme = e.target.value;
  saveSettings(settings);
});

document.getElementById('setting-search-engine').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.searchEngine = e.target.value;
  saveSettings(settings);
});

document.getElementById('setting-startup').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.startup = e.target.value;
  saveSettings(settings);
});

document.getElementById('setting-adblock').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.adBlock = e.target.checked;
  adBlockEnabled = e.target.checked;
  saveSettings(settings);
  document.getElementById('btn-adblock').classList.toggle('active', adBlockEnabled);
  tabs.forEach(tab => {
    if (adBlockEnabled) {
      tab.webview.insertCSS(adBlockCSS).catch(() => {});
    } else {
      tab.webview.executeJavaScript(`
        document.querySelectorAll('style').forEach(s => {
          if(s.textContent.includes('google_ads') || s.textContent.includes('adsbygoogle')) s.remove();
        });
      `).catch(() => {});
    }
  });
});

document.getElementById('setting-save-history').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.saveHistory = e.target.checked;
  saveSettings(settings);
});

document.getElementById('setting-mouse-gestures').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.mouseGestures = e.target.checked;
  saveSettings(settings);
});

document.getElementById('setting-tab-discard').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.tabDiscard = e.target.checked;
  saveSettings(settings);
});

document.getElementById('setting-background-throttle').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.backgroundThrottle = e.target.checked;
  saveSettings(settings);
  tabs.forEach(tab => {
    if (!tab.isNewTab) {
      tab.webview.setBackgroundThrottling(e.target.checked);
    }
  });
});

document.getElementById('setting-auto-cleanup').addEventListener('change', (e) => {
  const settings = getSettings();
  settings.autoCleanup = e.target.checked;
  saveSettings(settings);
});

document.getElementById('btn-clear-data').addEventListener('click', () => {
  if (confirm('Tum veriler (yer imleri, gecmis, ayarlar, sik kullanilanlar) silinecek. Emin misiniz?')) {
    localStorage.clear();
    alert('Tum veriler silindi. Uygulama yeniden baslatilacak.');
    location.reload();
  }
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
  if (window.electronAPI) {
    await window.electronAPI.clearAllCache();
    alert('Onbellek temizlendi!');
  }
});

document.getElementById('btn-optimize-memory').addEventListener('click', () => {
  optimizeMemory();
});

/* ===================== PERFORMANCE: TAB DISCARD ===================== */
const TAB_DISCARD_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const tabLastActive = new Map();

function updateTabLastActive(tabId) {
  tabLastActive.set(tabId, Date.now());
}

function discardInactiveTabs() {
  const settings = getSettings();
  if (!settings.tabDiscard) return;

  const now = Date.now();
  tabs.forEach(tab => {
    if (tab.id === activeTabId || tab.isNewTab || tab.isPlayingAudio) return;
    const lastActive = tabLastActive.get(tab.id) || now;
    if (now - lastActive > TAB_DISCARD_TIMEOUT) {
      // Suspend the webview by replacing with about:blank to free memory
      // but keep tab metadata so we can restore on click
      if (!tab.isDiscarded) {
        tab.suspendedUrl = tab.webview.getURL();
        tab.suspendedTitle = tab.webview.getTitle();
        tab.webview.loadURL('about:blank');
        tab.isDiscarded = true;
        updateTabUI(tab.id);
        console.log(`[Performance] Tab ${tab.id} discarded to save memory`);
      }
    }
  });
}

function restoreDiscardedTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || !tab.isDiscarded) return;
  tab.webview.loadURL(tab.suspendedUrl || 'https://www.google.com');
  tab.isDiscarded = false;
  delete tab.suspendedUrl;
  delete tab.suspendedTitle;
}

// Run discard check every minute
setInterval(discardInactiveTabs, 60 * 1000);

/* ===================== PERFORMANCE: MEMORY CLEANUP ===================== */
function optimizeMemory() {
  // Trigger JS garbage collection hint
  if (window.gc) window.gc();

  // Clear unused images and styles from invisible webviews
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && !tab.isNewTab && !tab.isDiscarded) {
      tab.webview.executeJavaScript(`
        // Clear image caches
        if (window.performance && window.performance.memory) {
          document.querySelectorAll('img').forEach(img => {
            if (!img.isIntersecting) { img.src = ''; }
          });
        }
      `).catch(() => {});
    }
  });

  alert('Bellek optimize edildi!');
}

async function updateMemoryUsage() {
  const text = document.getElementById('memory-usage-text');
  if (!text || !window.electronAPI) return;

  try {
    const sys = await window.electronAPI.getSystemMemory();
    const proc = await window.electronAPI.getProcessMemory();
    const usedMB = Math.round(sys.used / 1024 / 1024);
    const totalMB = Math.round(sys.total / 1024 / 1024);
    const appMB = Math.round(proc.rss / 1024 / 1024);
    text.textContent = `Sistem: ${usedMB} MB / ${totalMB} MB | Uygulama: ${appMB} MB`;
  } catch (e) {
    text.textContent = 'Hesaplanamadi';
  }
}

// Update memory display every 10 seconds
setInterval(updateMemoryUsage, 10000);

/* ===================== PERFORMANCE: AUTO CLEANUP ===================== */
function autoCleanup() {
  const settings = getSettings();
  if (!settings.autoCleanup) return;

  // Clear session cache periodically
  if (window.electronAPI) {
    window.electronAPI.clearAllCache().catch(() => {});
  }

  // Trim old history
  let history = getHistory();
  if (history.length > 500) {
    history = history.slice(0, 500);
    localStorage.setItem('dolphin_history', JSON.stringify(history));
  }

  // Trim old top sites
  let topsites = JSON.parse(localStorage.getItem('dolphin_topsites') || '[]');
  if (topsites.length > 50) {
    topsites = topsites.slice(0, 50);
    localStorage.setItem('dolphin_topsites', JSON.stringify(topsites));
  }
}

// Run auto cleanup every 30 minutes
setInterval(autoCleanup, 30 * 60 * 1000);

/* ===================== RELOAD ICON ===================== */
function setReloadIcon(loading) {
  const btn = document.getElementById('btn-reload');
  if (!btn) return;
  if (loading) {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    btn.title = 'Durdur';
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
    btn.title = 'Yenile';
  }
}

/* ===================== AUTO UPDATE ===================== */
const updateNotification = document.getElementById('update-notification');
const updateMessage = document.getElementById('update-message');
const btnInstallUpdate = document.getElementById('btn-install-update');
const btnDismissUpdate = document.getElementById('btn-dismiss-update');

if (window.electronAPI) {
  window.electronAPI.onUpdateStatus((data) => {
    switch (data.status) {
      case 'available':
        updateNotification.classList.remove('hidden');
        updateMessage.textContent = `v${data.version} indiriliyor...`;
        btnInstallUpdate.classList.add('hidden');
        break;
      case 'downloading':
        updateNotification.classList.remove('hidden');
        updateMessage.textContent = `v${data.version} indiriliyor... %${data.percent || 0}`;
        btnInstallUpdate.classList.add('hidden');
        break;
      case 'downloaded':
        updateNotification.classList.remove('hidden');
        updateMessage.textContent = `v${data.version} hazir!`;
        btnInstallUpdate.classList.remove('hidden');
        break;
      case 'not-available':
      case 'error':
        // silently ignore
        break;
    }
  });
}

btnInstallUpdate.addEventListener('click', () => {
  if (window.electronAPI) window.electronAPI.installUpdate();
});

btnDismissUpdate.addEventListener('click', () => {
  updateNotification.classList.add('hidden');
});

/* ===================== INIT ===================== */
const initialSettings = getSettings();
applySettings(initialSettings);
renderHistory();
renderBookmarks();
createTab();
