(() => {
  // Prevent duplicate listener attachment
  if (window.__imdbScraperInitialized) return;
  window.__imdbScraperInitialized = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape") {
      scrapeIMDB(request.format, request.options)
        .then((result) => {
          sendResponse({ status: "success", total: result.total });
        })
        .catch((err) => {
          console.error("Scraper error:", err);
          sendResponse({ status: "error", message: err.message });
        });
      return true; // Keep channel open for async response
    }
  });

  // Floating in-page notification for user feedback
  function showInPageToast(text, count = null) {
    let toast = document.getElementById("__imdb_scraper_toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "__imdb_scraper_toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #121212;
        color: #fff;
        border: 1px solid #f5c518;
        border-radius: 8px;
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        z-index: 9999999;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    const badge = count !== null && count !== undefined ? `<span style="background:#f5c518;color:#000;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:11px;">${count} items</span>` : '';
    toast.innerHTML = `<span style="color:#f5c518;font-size:16px;">⚡</span> <span>${text}</span> ${badge}`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }

  function hideInPageToast(delay = 3500) {
    setTimeout(() => {
      const toast = document.getElementById("__imdb_scraper_toast");
      if (toast) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 400);
      }
    }, delay);
  }

  function sendProgress(text, count = null) {
    chrome.runtime.sendMessage({ type: "progress", text, count }).catch(() => {});
    showInPageToast(text, count);
  }

  function triggerDownload(content, mimeType, filename) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 8000);
    } catch (err) {
      console.warn("Blob download failed, falling back to data URI:", err);
      const a = document.createElement("a");
      a.href = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  async function scrapeIMDB(format, options) {
    sendProgress("Starting extractor...", 0);

    // 1. Auto-scroll and load all paginated / lazy-loaded items
    await new Promise((resolve) => {
      let lastItemCount = 0;
      let lastScrollY = -1;
      let unchangedTicks = 0;
      let totalTicks = 0;
      const MAX_TICKS = 120; // 30 seconds max safety timeout

      const finishScrolling = () => {
        clearInterval(scrollInterval);
        resolve();
      };

      const scrollInterval = setInterval(() => {
        totalTicks++;

        // Auto-click "See more" or "Load more" button if present
        const loadMoreBtn = document.querySelector(
          "button.ipc-see-more__button, [data-testid='load-more-button'], .ipc-btn--core-base[aria-label*='more'], .ipc-see-more button"
        );
        if (loadMoreBtn && typeof loadMoreBtn.click === "function") {
          loadMoreBtn.click();
        }

        // Scroll down
        window.scrollBy({ top: 1000, behavior: 'instant' });

        const currentItems = document.querySelectorAll(".ipc-metadata-list-summary-item").length;
        sendProgress("Scrolling list...", currentItems);

        const currentScrollY = window.scrollY;
        const reachedBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 120);

        if (currentItems === lastItemCount && (reachedBottom || currentScrollY === lastScrollY)) {
          unchangedTicks++;
          // If no new items loaded for 6 ticks (~1.5s) while at or near bottom
          if (unchangedTicks >= 6) {
            finishScrolling();
            return;
          }
        } else {
          unchangedTicks = 0;
          lastItemCount = currentItems;
          lastScrollY = currentScrollY;
        }

        // Hard safety timeout
        if (totalTicks >= MAX_TICKS) {
          console.warn("IMDb Extractor: Reached scroll safety limit, proceeding to parse.");
          finishScrolling();
        }
      }, 250);
    });

    sendProgress("Parsing movie data...");

    // 2. Query and extract items
    const itemElements = document.querySelectorAll(".ipc-metadata-list-summary-item");
    const data = [];

    // Detect page list title
    const pageTitleEl = document.querySelector("h1, [data-testid='hero-title-block__title']");
    let listTitle = pageTitleEl ? pageTitleEl.innerText.replace(/\n+/g, " ").trim() : "IMDb Watch History";
    if (!listTitle) listTitle = "IMDb Watch History";

    itemElements.forEach((item, index) => {
      // Title
      const titleEl = item.querySelector(".ipc-title__text, h3, h4");
      let title = titleEl ? titleEl.innerText.trim() : "Unknown Title";
      title = title.replace(/^\d+\.\s*/, ""); // Clean numeric prefix

      // URL & IMDb ID
      const linkEl = item.querySelector("a.ipc-title-link-wrapper, a.ipc-lockup-overlay, a[href*='/title/tt']");
      let url = "";
      let imdbId = "";
      if (linkEl && linkEl.getAttribute("href")) {
        const href = linkEl.getAttribute("href");
        const match = href.match(/\/title\/(tt\d+)/);
        if (match) {
          imdbId = match[1];
          url = `https://www.imdb.com/title/${imdbId}/`;
        }
      }

      // Metadata Items (Year, Runtime, Certificate)
      const metaEls = item.querySelectorAll(".dli-title-metadata ul.ipc-inline-list li, .ipc-inline-list__item");
      let year = "";
      let runtime = "";
      let ageRating = "";

      metaEls.forEach((el) => {
        const txt = el.innerText.trim();
        if (!txt) return;

        // Check for Year pattern (e.g. "1994", "1999–2007", "2023–")
        if (/^\d{4}(?:[–-]\d{4}|[–-])?$/.test(txt) && !year) {
          year = txt;
        }
        // Check for Runtime pattern (e.g. "2h 22m", "45m", "1h")
        else if (/^(?:\d+h\s*)?(?:\d+m)$/i.test(txt) && !runtime) {
          runtime = txt;
        }
        // Age certificate or general rating
        else if (/^(PG|PG-13|R|TV-MA|TV-14|TV-PG|TV-G|TV-Y|TV-Y7|NC-17|G|U|A|U\/A|18\+|16\+|13\+|Not Rated|Unrated)$/i.test(txt) && !ageRating) {
          ageRating = txt;
        } else if (!ageRating && txt.length <= 10 && !year && !runtime) {
          ageRating = txt;
        }
      });

      // Rating and Votes
      const ratingEl = item.querySelector(".ipc-rating-star--rating, .ipc-rating-star");
      let imdbRating = "";
      let voteCount = "";
      if (ratingEl) {
        imdbRating = ratingEl.innerText.trim().split("\n")[0].trim();
      }
      const voteEl = item.querySelector(".ipc-rating-star--voteCount");
      if (voteEl) {
        voteCount = voteEl.innerText.replace(/[()&;]/g, "").trim();
      }

      // Plot
      const plotEl = item.querySelector(".title-description-plot-container .ipc-html-content-inner-div, .ipc-html-content-inner-div");
      let plot = plotEl ? plotEl.innerText.trim().replace(/\s+/g, " ") : "";

      // Cast & Credits
      const credits = [];
      const creditSpans = item.querySelectorAll(".title-description-credit a, .sc-35f5f4fb-2 a");
      creditSpans.forEach((c) => {
        const name = c.innerText.trim();
        if (name && !credits.includes(name)) credits.push(name);
      });
      const castText = credits.join(", ");

      const entry = {
        number: index + 1,
        title,
        year,
        imdbId,
        url: options.url ? url : "",
        runtime: options.runtime ? runtime : "",
        ageRating: options.age ? ageRating : "",
        imdbRating: options.rating ? (voteCount ? `${imdbRating} (${voteCount})` : imdbRating) : "",
        cast: options.cast ? castText : "",
        plot: options.plot ? plot : ""
      };

      data.push(entry);
    });

    // 3. Format Output
    let content = "";
    let mimeType = "text/plain";
    let ext = format;

    if (format === "md") {
      mimeType = "text/markdown";
      content = `# ${listTitle}\n\n`;
      data.forEach((d) => {
        const hasExtra = options.url || options.runtime || options.age || options.rating || options.cast || options.plot;
        if (hasExtra) {
          content += `## ${d.number}. ${d.title} (${d.year || "N/A"})\n`;
          if (options.url && d.url) content += `- **URL:** ${d.url}\n`;
          if (options.rating && d.imdbRating) content += `- **IMDb Rating:** ⭐ ${d.imdbRating}\n`;
          if (options.runtime && d.runtime) content += `- **Runtime:** ${d.runtime}\n`;
          if (options.age && d.ageRating) content += `- **Age Rating:** ${d.ageRating}\n`;
          if (options.cast && d.cast) content += `- **Cast/Director:** ${d.cast}\n`;
          if (options.plot && d.plot) content += `- **Plot:** ${d.plot}\n`;
          content += "\n";
        } else {
          content += `${d.number}. ${d.title} (${d.year || "N/A"})\n`;
        }
      });
    } else if (format === "csv") {
      mimeType = "text/csv;charset=utf-8;";
      const headers = ["Number", "Title", "Year"];
      if (options.url) headers.push("URL");
      if (options.rating) headers.push("IMDb Rating");
      if (options.runtime) headers.push("Runtime");
      if (options.age) headers.push("Age Rating");
      if (options.cast) headers.push("Cast/Director");
      if (options.plot) headers.push("Plot");

      content += headers.join(",") + "\n";

      const escapeCSV = (str) => `"${(str || "").toString().replace(/"/g, '""')}"`;
      data.forEach((d) => {
        const row = [d.number, escapeCSV(d.title), escapeCSV(d.year)];
        if (options.url) row.push(escapeCSV(d.url));
        if (options.rating) row.push(escapeCSV(d.imdbRating));
        if (options.runtime) row.push(escapeCSV(d.runtime));
        if (options.age) row.push(escapeCSV(d.ageRating));
        if (options.cast) row.push(escapeCSV(d.cast));
        if (options.plot) row.push(escapeCSV(d.plot));
        content += row.join(",") + "\n";
      });
    } else if (format === "json") {
      mimeType = "application/json";
      const cleanData = data.map((d) => {
        const obj = { number: d.number, title: d.title, year: d.year };
        if (options.url) obj.url = d.url;
        if (options.rating) obj.rating = d.imdbRating;
        if (options.runtime) obj.runtime = d.runtime;
        if (options.age) obj.ageRating = d.ageRating;
        if (options.cast) obj.cast = d.cast;
        if (options.plot) obj.plot = d.plot;
        return obj;
      });
      content = JSON.stringify({ title: listTitle, totalItems: cleanData.length, items: cleanData }, null, 2);
    } else if (format === "txt") {
      mimeType = "text/plain";
      content = `${listTitle.toUpperCase()}\n${"=".repeat(listTitle.length)}\n\n`;
      data.forEach((d) => {
        content += `${d.number}. ${d.title} (${d.year || "N/A"})\n`;
        if (options.url && d.url) content += `   URL: ${d.url}\n`;
        if (options.rating && d.imdbRating) content += `   Rating: ${d.imdbRating}\n`;
        if (options.runtime && d.runtime) content += `   Runtime: ${d.runtime}\n`;
        if (options.age && d.ageRating) content += `   Certificate: ${d.ageRating}\n`;
        if (options.cast && d.cast) content += `   Cast: ${d.cast}\n`;
        if (options.plot && d.plot) content += `   Plot: ${d.plot}\n`;
        if (options.url || options.rating || options.runtime || options.plot) content += "\n";
      });
    } else if (format === "html") {
      mimeType = "text/html";
      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${listTitle}</title>
  <style>
    :root { --bg: #121212; --card: #1f1f1f; --text: #eee; --gold: #f5c518; --border: #333; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 30px; margin: 0; }
    h1 { color: var(--gold); border-bottom: 2px solid var(--border); padding-bottom: 12px; margin-top: 0; }
    .badge { background: var(--gold); color: #000; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: var(--card); border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
    th { background: #252525; color: var(--gold); font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    tr:hover { background: rgba(245, 197, 24, 0.05); }
    a { color: #5799ef; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .rating-badge { color: var(--gold); font-weight: bold; }
  </style>
</head>
<body>
  <h1>${listTitle} <span class="badge">${data.length} Titles</span></h1>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Title</th>
        <th>Year</th>
        ${options.rating ? "<th>Rating</th>" : ""}
        ${options.runtime ? "<th>Runtime</th>" : ""}
        ${options.age ? "<th>Certificate</th>" : ""}
        ${options.url ? "<th>IMDb Link</th>" : ""}
        ${options.cast ? "<th>Cast / Director</th>" : ""}
        ${options.plot ? "<th>Plot</th>" : ""}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (d) => `<tr>
        <td>${d.number}</td>
        <td><strong>${d.title}</strong></td>
        <td>${d.year || "-"}</td>
        ${options.rating ? `<td class="rating-badge">${d.imdbRating ? "⭐ " + d.imdbRating : "-"}</td>` : ""}
        ${options.runtime ? `<td>${d.runtime || "-"}</td>` : ""}
        ${options.age ? `<td>${d.ageRating || "-"}</td>` : ""}
        ${options.url ? `<td>${d.url ? `<a href="${d.url}" target="_blank">View on IMDb</a>` : "-"}</td>` : ""}
        ${options.cast ? `<td>${d.cast || "-"}</td>` : ""}
        ${options.plot ? `<td>${d.plot || "-"}</td>` : ""}
      </tr>`
        )
        .join("\n      ")}
    </tbody>
  </table>
</body>
</html>`;
    }

    // 4. Trigger Download
    const dateStr = new Date().toISOString().split("T")[0];
    const safeTitle = listTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "imdb_list";
    const filename = `${safeTitle}_${dateStr}.${ext}`;

    triggerDownload(content, mimeType, filename);

    sendProgress(`Export complete! Saved ${data.length} items.`, data.length);
    hideInPageToast(4000);

    return { total: data.length };
  }
})();
