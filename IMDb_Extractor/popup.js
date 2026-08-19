document.addEventListener('DOMContentLoaded', async () => {
  const exportFormat = document.getElementById('exportFormat');
  const chkUrl = document.getElementById('chkUrl');
  const chkRating = document.getElementById('chkRating');
  const chkRuntime = document.getElementById('chkRuntime');
  const chkAge = document.getElementById('chkAge');
  const chkCast = document.getElementById('chkCast');
  const chkPlot = document.getElementById('chkPlot');
  const metaCheckboxes = document.querySelectorAll('.meta-check');

  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnClearAll = document.getElementById('btnClearAll');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const btnIcon = document.getElementById('btnIcon');
  const btnText = document.getElementById('btnText');

  const pageStatus = document.getElementById('pageStatus');
  const pageStatusText = document.getElementById('pageStatusText');

  const statusContainer = document.getElementById('statusContainer');
  const progressBox = document.getElementById('progressBox');
  const statusMessage = document.getElementById('statusMessage');
  const statusCount = document.getElementById('statusCount');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');
  const successBox = document.getElementById('successBox');
  const successMessage = document.getElementById('successMessage');

  // Check active tab on popup open
  let activeTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0] || null;

    if (activeTab && activeTab.url && activeTab.url.includes('imdb.com')) {
      pageStatus.className = 'page-status ready';
      pageStatusText.innerText = 'Connected to IMDb page';
    } else {
      pageStatus.className = 'page-status warning';
      pageStatusText.innerText = 'Not on IMDb — Open a list or watch history first';
    }
  } catch (err) {
    pageStatus.className = 'page-status warning';
    pageStatusText.innerText = 'Unable to detect active tab';
  }

  // Restore saved preferences
  try {
    const savedFormat = localStorage.getItem('imdb_scraper_format');
    if (savedFormat) exportFormat.value = savedFormat;

    const savedOptions = JSON.parse(localStorage.getItem('imdb_scraper_options') || '{}');
    if (savedOptions.url !== undefined) chkUrl.checked = savedOptions.url;
    if (savedOptions.rating !== undefined) chkRating.checked = savedOptions.rating;
    if (savedOptions.runtime !== undefined) chkRuntime.checked = savedOptions.runtime;
    if (savedOptions.age !== undefined) chkAge.checked = savedOptions.age;
    if (savedOptions.cast !== undefined) chkCast.checked = savedOptions.cast;
    if (savedOptions.plot !== undefined) chkPlot.checked = savedOptions.plot;
  } catch (e) {
    console.error('Error loading settings', e);
  }

  // Quick Action Buttons
  btnSelectAll.addEventListener('click', () => {
    metaCheckboxes.forEach(cb => cb.checked = true);
    savePreferences();
  });

  btnClearAll.addEventListener('click', () => {
    metaCheckboxes.forEach(cb => cb.checked = false);
    savePreferences();
  });

  metaCheckboxes.forEach(cb => cb.addEventListener('change', savePreferences));
  exportFormat.addEventListener('change', savePreferences);

  function savePreferences() {
    try {
      localStorage.setItem('imdb_scraper_format', exportFormat.value);
      const opts = {
        url: chkUrl.checked,
        rating: chkRating.checked,
        runtime: chkRuntime.checked,
        age: chkAge.checked,
        cast: chkCast.checked,
        plot: chkPlot.checked
      };
      localStorage.setItem('imdb_scraper_options', JSON.stringify(opts));
    } catch (e) {}
  }

  function showProgress(msg, count = '') {
    statusContainer.classList.add('visible');
    progressBox.style.display = 'block';
    errorBox.style.display = 'none';
    successBox.style.display = 'none';
    statusMessage.innerText = msg;
    statusCount.innerText = count ? `${count} items` : '';
  }

  function showError(msg) {
    statusContainer.classList.add('visible');
    progressBox.style.display = 'none';
    errorBox.style.display = 'flex';
    successBox.style.display = 'none';
    errorMessage.innerText = msg;
  }

  function showSuccess(msg) {
    statusContainer.classList.add('visible');
    progressBox.style.display = 'none';
    errorBox.style.display = 'none';
    successBox.style.display = 'flex';
    successMessage.innerText = msg;
  }

  scrapeBtn.addEventListener('click', async () => {
    const format = exportFormat.value;
    const options = {
      url: chkUrl.checked,
      rating: chkRating.checked,
      runtime: chkRuntime.checked,
      age: chkAge.checked,
      cast: chkCast.checked,
      plot: chkPlot.checked
    };

    // Re-verify tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0] || null;

    if (!tab || !tab.url || !tab.url.includes('imdb.com')) {
      showError('Please open an IMDb list or watch history page first.');
      return;
    }

    // Set UI to loading state
    scrapeBtn.disabled = true;
    btnIcon.replaceChildren();
    const spinner = document.createElement('span');
    spinner.className = 'spinner-icon';
    btnIcon.appendChild(spinner);
    btnText.innerText = 'Scraping...';
    showProgress('Initializing scraper...', '0');

    // Listen for progress messages from content script
    const messageListener = (msg) => {
      if (msg && msg.type === 'progress') {
        showProgress(msg.text, msg.count !== null ? msg.count : '');
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    const resetBtnState = () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      scrapeBtn.disabled = false;
      btnIcon.replaceChildren();
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "17");
      svg.setAttribute("height", "17");
      svg.setAttribute("fill", "currentColor");
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z");
      svg.appendChild(path);
      btnIcon.appendChild(svg);
      btnText.innerText = 'Scrape & Export';
    };

    try {
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send command to content script
      chrome.tabs.sendMessage(tab.id, { action: 'scrape', format, options }, (response) => {
        resetBtnState();

        if (chrome.runtime.lastError) {
          showError('Please reload your IMDb page and try clicking again.');
        } else if (response && response.status === 'success') {
          showSuccess(`Export complete! Saved ${response.total} items to file.`);
        } else if (response && response.status === 'error') {
          showError(`Scraper error: ${response.message}`);
        } else {
          showSuccess('Export complete! File downloaded.');
        }
      });
    } catch (err) {
      resetBtnState();
      showError('Failed to start scraper. Please refresh the IMDb tab.');
    }
  });
});
