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

let bookmarks = JSON.parse(localStorage.getItem('dolphin_bookmarks') || '[]');

/* ===================== SETTINGS ===================== */
const DEFAULT_SETTINGS = {
  theme: 'dark',
  searchEngine: 'google',
  startup: 'newtab',
  adBlock: true,
  saveHistory: true
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
  // Tema
  if (settings.theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  // Reklam engelleyici
  adBlockEnabled = settings.adBlock;
  const adBtn = document.getElementById('btn-adblock');
  if (adBtn) adBtn.classList.toggle('active', adBlockEnabled);

  // UI'da guncelle
  const themeSel = document.getElementById('setting-theme');
  const engineSel = document.getElementById('setting-search-engine');
  const startupSel = document.getElementById('setting-startup');
  const adCheck = document.getElementById('setting-adblock');
  const histCheck = document.getElementById('setting-save-history');

  if (themeSel) themeSel.value = settings.theme;
  if (engineSel) engineSel.value = settings.searchEngine;
  if (startupSel) startupSel.value = settings.startup;
  if (adCheck) adCheck.checked = settings.adBlock;
  if (histCheck) histCheck.checked = settings.saveHistory;
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
    isNewTab: true
  };
  tabs.push(tab);

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.tabId = tabId;
  tabEl.innerHTML = `<span class="tab-title">Yeni Sekme</span><span class="tab-close">&times;</span>`;
  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close')) {
      closeTab(tabId);
    } else {
      switchTab(tabId);
    }
  });
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
  activeTabId = tabId;
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
  }
});

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
  alert('Dolphin Browser v1.0.0\nChromium tabanli modern web tarayicisi.');
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

document.getElementById('btn-clear-data').addEventListener('click', () => {
  if (confirm('Tum veriler (yer imleri, gecmis, ayarlar, sik kullanilanlar) silinecek. Emin misiniz?')) {
    localStorage.clear();
    alert('Tum veriler silindi. Uygulama yeniden baslatilacak.');
    location.reload();
  }
});

/* ===================== INIT ===================== */
const initialSettings = getSettings();
applySettings(initialSettings);
renderHistory();
renderBookmarks();
createTab();
