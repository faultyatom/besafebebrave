/* ==========================================================================
   besafebebrave — shared behaviour for index.html and about.html

   Three small things happen here:
     1. the expanding scenario rows
     2. the video player, which only contacts YouTube after a click
     3. sections fading in as you scroll

   No libraries, nothing loaded from the internet, nothing sent anywhere.
   ========================================================================== */

/* The "js" class that this file depends on is NOT set here. It is set by a
   one-line inline script in the <head> of each page, so that it lands before
   the browser's first paint.

   Why it matters: site.css uses that class to hide sections for the fade-in
   and to collapse the scenario panels. If the class were added down here, at
   the end of the body, a slow connection would paint the whole page open and
   visible and then snap it shut — a visible flash on exactly the first visit
   that matters. And if JavaScript is off or fails, the class is never set,
   so nothing is ever hidden and the page reads normally.

   The line to look for is in index.html and about.html, in <head>. */

document.addEventListener('DOMContentLoaded', function () {

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Each feature is wrapped so that a failure in one cannot take the others
     down with it. The reveal runs first, because a script that dies before
     reaching it would leave the page hidden. */
  function attempt(fn) {
    try { fn(); } catch (e) { /* one broken feature, not a broken page */ }
  }


  /* ------------------------------------------------------------------
     1. Fade sections in on first view

     Runs first on purpose: if a later feature throws, the content is
     already on its way to visible.

     The rule this code follows is that the animation is never allowed to
     cost anyone the content. An earlier version asked "did the observer
     ever run?" and treated that as proof the page was visible. It isn't.
     The specification says observing an element queues a first callback
     straight away whether or not it is on screen, so that question is
     answered "yes" within a frame in every normal browser — including in
     an embedded view that then stops updating forever and leaves every
     section below the fold permanently blank.

     So the fallback asks the question that actually matters: is anything
     still hidden that the visitor can already see? If so, show it. That
     check runs on a timer and again on scroll, and stops once everything
     is out.
     ------------------------------------------------------------------ */

  attempt(function () {
    var revealing = document.querySelectorAll('.reveal');

    function showAll() {
      Array.prototype.forEach.call(revealing, function (el) {
        el.classList.add('in-view');
      });
    }

    function allShown() {
      return !document.querySelector('.reveal:not(.in-view)');
    }

    // Reveal anything hidden that is currently within the viewport.
    function showWhateverIsOnScreen() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      Array.prototype.forEach.call(revealing, function (el) {
        if (el.classList.contains('in-view')) { return; }
        var box = el.getBoundingClientRect();
        if (box.top < vh && box.bottom > 0) { el.classList.add('in-view'); }
      });
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);   // once only
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(revealing, function (el) { observer.observe(el); });

    function backstop() {
      showWhateverIsOnScreen();
      if (allShown()) {
        window.removeEventListener('scroll', backstop);
        window.removeEventListener('resize', backstop);
      }
    }

    window.setTimeout(backstop, 1500);
    window.addEventListener('scroll', backstop, { passive: true });
    window.addEventListener('resize', backstop);
  });


  /* ------------------------------------------------------------------
     2. Scenario rows
     Opening one closes any other. Clicking an open row closes it.

     aria-expanded is set here rather than in the HTML. With JavaScript
     off the panels render open, so a hard-coded aria-expanded="false"
     in the markup would be announcing the opposite of what is on screen.
     ------------------------------------------------------------------ */

  attempt(function () {
    var scenarioButtons = document.querySelectorAll('.scenario__btn');

    function closeScenario(button) {
      var panel = document.getElementById(button.getAttribute('aria-controls'));
      button.setAttribute('aria-expanded', 'false');
      if (panel) { panel.setAttribute('data-open', 'false'); }
    }

    Array.prototype.forEach.call(scenarioButtons, function (button) {
      closeScenario(button);   // start closed, and say so

      button.addEventListener('click', function () {
        var panel = document.getElementById(button.getAttribute('aria-controls'));
        if (!panel) { return; }

        var isOpen = button.getAttribute('aria-expanded') === 'true';

        // Close every row first, so only one is ever open.
        Array.prototype.forEach.call(scenarioButtons, closeScenario);

        if (!isOpen) {
          button.setAttribute('aria-expanded', 'true');
          panel.setAttribute('data-open', 'true');
        }
      });
    });
  });


  /* ------------------------------------------------------------------
     3. Video player

     The page promises that nothing reaches YouTube until you press play,
     and that promise has to stay literally true. So there is no iframe
     and no YouTube thumbnail in the HTML — even the preview image would
     be a request to a Google server. The player is built here, on click.

     To change the video: edit VIDEO_ID and PLAYLIST_ID below. Both come
     from the YouTube address of the video you want.
     ------------------------------------------------------------------ */

  var VIDEO_ID = 'DdqinlREPSc';
  var PLAYLIST_ID = 'PLgcwCSsOJippJfMjWK4vMe4v90WbVZqt9';

  attempt(function () {
    var facade = document.getElementById('video-facade');
    if (!facade) { return; }

    facade.addEventListener('click', function () {
      /* The iframe goes inside a focusable wrapper. Replacing the button
         outright would throw a keyboard visitor's place away, and focusing
         the iframe itself is unreliable because its document has not loaded
         at this instant. Focusing the wrapper keeps them where they were. */
      var wrap = document.createElement('div');
      wrap.className = 'video-wrap';
      wrap.setAttribute('tabindex', '-1');

      var frame = document.createElement('iframe');
      frame.className = 'video-frame';
      frame.src = 'https://www.youtube-nocookie.com/embed/' + VIDEO_ID +
                  '?list=' + PLAYLIST_ID + '&autoplay=1';
      frame.title = 'Digital security explainers — Internet Freedom Foundation playlist';

      /* Only what the player actually needs. YouTube's copy-paste embed also
         asks for accelerometer, gyroscope and clipboard-write; handing a
         third party the motion sensors on a site about not handing things
         over would be a poor advertisement. */
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'no-referrer');

      wrap.appendChild(frame);
      facade.replaceWith(wrap);
      wrap.focus();
    });
  });


  /* ------------------------------------------------------------------
     4. Metadata demo — "Your photo is talking about you"

     This only wires events and renders. All the actual byte-parsing lives
     in exif.js on window.BSBB.exif, which has no DOM dependency so the
     test harness can call it directly (testing strategy §3, tier 2).

     Every sentence a visitor reads here already exists in index.html —
     this code only reads values out of what exif.js returns and shows or
     hides the right elements. It never builds a string of its own copy,
     so nothing here needs updating when the wording changes.

     Reads only the first 256KB of the file (stage2 plan §4) — EXIF lives
     near the start of a JPEG, so there's no reason to read a 12MB photo in
     full, and doing so would make the page feel slow on a phone.
     ------------------------------------------------------------------ */

  var METADATA_MAX_BYTES = 64 * 1024 * 1024; // refuse politely before reading, §5.4
  var METADATA_READ_BYTES = 262144; // file.slice(0, 262144) — first 256KB only

  attempt(function () {
    var dropZone = document.getElementById('metadata-drop');
    var fileInput = document.getElementById('metadata-file');
    var resultsRegion = document.getElementById('metadata-results');
    var resultsHeading = document.getElementById('metadata-results-h');
    var resetButton = document.getElementById('metadata-reset');
    var closing = document.getElementById('metadata-closing');
    if (!dropZone || !fileInput || !resultsRegion || !window.BSBB || !window.BSBB.exif) { return; }

    var exif = window.BSBB.exif;

    var messageIds = ['msg-no-exif', 'msg-heic', 'msg-other-format', 'msg-unreadable', 'msg-too-large'];
    var groupIds = ['group-location', 'group-device', 'group-time', 'group-identifying'];
    // Sub-parts of the location group that toggle independently of the
    // group itself, since the group is shown both for a real GPS fix and
    // for the "no location in this file" state (fix pass item 3).
    var locationSubIds = ['row-coords', 'row-gps-extra', 'row-gps-note', 'row-map', 'msg-no-location'];
    // Every field row this section can fill in, each with the pair of
    // (row wrapper id, value element id) it belongs to.
    var locationExtraRows = [
      ['row-altitude', 'out-altitude'], ['row-gpstime', 'out-gpstime']
    ];
    var deviceRows = [
      ['row-make', 'out-make'], ['row-model', 'out-model'], ['row-lens', 'out-lens'],
      ['row-software', 'out-software'], ['row-orientation', 'out-orientation']
    ];
    var timeRows = [
      ['row-taken', 'out-taken'], ['row-saved', 'out-saved'], ['row-offset', 'out-offset']
    ];
    var identifyingRows = [
      ['row-serial', 'out-serial'], ['row-owner', 'out-owner'], ['row-artist', 'out-artist'],
      ['row-copyright', 'out-copyright'], ['row-description', 'out-description'],
      ['row-makernote', 'out-makernote-bytes']
    ];
    // Every value element that ever gets a visitor's own data written into
    // it with textContent, gathered so resetDisplay() can blank them all —
    // hiding a row with the `hidden` attribute takes it out of view and out
    // of the accessibility tree, but leaves its old text sitting in the DOM
    // otherwise (fix pass item 4: "Try another photo" should leave nothing
    // of the previous photo recoverable, not just invisible).
    var outputIds = ['out-lat', 'out-lon'].concat(
      locationExtraRows.concat(deviceRows, timeRows, identifyingRows).map(function (p) { return p[1]; })
    );

    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // "<n>m above/below sea level" — plan §5.3 lists the GPS altitude tags
    // to surface but gives no verbatim copy; wording decided in the fix pass.
    function formatAltitude(gps) {
      if (gps.altitude === undefined || gps.altitude === null || isNaN(gps.altitude)) { return undefined; }
      var metres = Math.round(Math.abs(gps.altitude));
      return metres + 'm ' + (gps.altitude < 0 ? 'below' : 'above') + ' sea level';
    }

    // "HH:MM:SS UTC, D Month YYYY" — the GPS receiver's own UTC clock,
    // distinct from the camera's local DateTimeOriginal (fix pass item 6).
    // exif.js already formats the time part as "HH:MM:SS UTC"; the date
    // part arrives as EXIF's "YYYY:MM:DD".
    function formatGpsClock(gps) {
      if (!gps.timeStamp || !gps.dateStamp) { return undefined; }
      var parts = gps.dateStamp.split(':');
      if (parts.length !== 3) { return gps.timeStamp; }
      var y = parseInt(parts[0], 10), mo = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
      var monthName = MONTH_NAMES[mo - 1];
      if (!monthName || isNaN(d)) { return gps.timeStamp; }
      return gps.timeStamp + ', ' + d + ' ' + monthName + ' ' + y;
    }

    function hideAll(ids) {
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.hidden = true; }
      });
    }

    function setRow(pair, value) {
      var row = document.getElementById(pair[0]);
      var out = document.getElementById(pair[1]);
      if (!row || !out) { return; }
      if (value === undefined || value === null || value === '') {
        row.hidden = true;
      } else {
        out.textContent = value;
        row.hidden = false;
      }
    }

    function resetDisplay() {
      // "Try another photo" must return the page to its genuine at-rest
      // state, so the drop zone reappears here too.
      if (dropZone) { dropZone.hidden = false; }
      hideAll(messageIds);
      hideAll(groupIds);
      hideAll(locationSubIds);
      hideAll(locationExtraRows.concat(deviceRows, timeRows, identifyingRows).map(function (p) { return p[0]; }));
      outputIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.textContent = ''; }
      });
      if (closing) { closing.hidden = true; }
      if (resetButton) { resetButton.hidden = true; }
      if (resultsHeading) { resultsHeading.hidden = true; }
      var marker = document.getElementById('metadata-map-marker');
      if (marker) {
        marker.setAttribute('visibility', 'hidden');
        marker.removeAttribute('transform');
      }
    }

    function showMessage(id) {
      var el = document.getElementById(id);
      if (el) { el.hidden = false; }
    }

    // The results heading and closing line claim "here's what it tells a
    // stranger" / invite the visitor to imagine every photo they've sent —
    // both false when nothing was actually read (a truncated file, a plain
    // text file). Shown only for genuine reads: a GPS fix, EXIF without
    // GPS, no EXIF at all, HEIC detection, or a format that just doesn't
    // carry EXIF (fix pass item 4).
    function setGenuineRead(genuine) {
      if (resultsHeading) { resultsHeading.hidden = !genuine; }
      if (closing) { closing.hidden = !genuine; }
    }

    function renderResult(r) {
      resetDisplay();

      // Hide the at-rest drop zone the moment any result renders — success
      // or failure alike — so the page visibly changes instead of leaving
      // the same box on screen while results quietly appear below it.
      if (dropZone) { dropZone.hidden = true; }

      if (resetButton) { resetButton.hidden = false; }

      if (!r.ok) {
        var genuineFailure = r.reason === 'heic' || r.reason === 'no-exif-format';
        setGenuineRead(genuineFailure);

        if (r.reason === 'heic') { showMessage('msg-heic'); }
        else if (r.reason === 'no-exif-format') { showMessage('msg-other-format'); }
        else if (r.reason === 'too-large') { showMessage('msg-too-large'); }
        else if (r.reason === 'unknown-format') { showMessage('msg-unreadable'); }
        else { showMessage('msg-unreadable'); } // bad-tiff-header, parse-error, truncated
        moveFocusToResults();
        return;
      }

      setGenuineRead(true);

      if (r.noExif) {
        // PNG (and friends) rarely carry EXIF at all, which reads
        // differently to a visitor than "this JPEG has been stripped" —
        // stage2 plan §5.1 / §8.
        if (r.format === 'png') { showMessage('msg-other-format'); }
        else { showMessage('msg-no-exif'); }
        moveFocusToResults();
        return;
      }

      var locationGroup = document.getElementById('group-location');
      if (r.gps) {
        var latEl = document.getElementById('out-lat');
        var lonEl = document.getElementById('out-lon');
        var rowCoords = document.getElementById('row-coords');
        var rowGpsNote = document.getElementById('row-gps-note');
        var rowMap = document.getElementById('row-map');
        var rowGpsExtra = document.getElementById('row-gps-extra');
        if (locationGroup && latEl && lonEl) {
          latEl.textContent = r.gps.latitude.toFixed(5) + '°';
          lonEl.textContent = r.gps.longitude.toFixed(5) + '°';
          if (rowCoords) { rowCoords.hidden = false; }
          if (rowGpsNote) { rowGpsNote.hidden = false; }
          if (rowMap) { rowMap.hidden = false; }

          setRow(['row-altitude', 'out-altitude'], formatAltitude(r.gps));
          setRow(['row-gpstime', 'out-gpstime'], formatGpsClock(r.gps));
          if (rowGpsExtra) {
            var extraHasAny = locationExtraRows.some(function (pair) {
              var row = document.getElementById(pair[0]);
              return row && !row.hidden;
            });
            rowGpsExtra.hidden = !extraHasAny;
          }

          var marker = document.getElementById('metadata-map-marker');
          if (marker) {
            marker.setAttribute('transform', 'translate(' + r.gps.longitude + ' ' + r.gps.latitude + ')');
            marker.setAttribute('visibility', 'visible');
          }
          locationGroup.hidden = false;
        }
      } else if (locationGroup) {
        // EXIF present, GPS IFD absent — say so explicitly rather than
        // silently omitting the group (fix pass item 3 / stage2 plan
        // acceptance criterion #5).
        showMessage('msg-no-location');
        locationGroup.hidden = false;
      }

      if (r.device) {
        setRow(['row-make', 'out-make'], r.device.make);
        setRow(['row-model', 'out-model'], r.device.model);
        setRow(['row-lens', 'out-lens'], r.device.lensModel);
        setRow(['row-software', 'out-software'], r.device.software);
        setRow(['row-orientation', 'out-orientation'], r.device.orientation);
        var deviceHasAny = deviceRows.some(function (pair) {
          var row = document.getElementById(pair[0]);
          return row && !row.hidden;
        });
        var deviceGroup = document.getElementById('group-device');
        if (deviceGroup && deviceHasAny) { deviceGroup.hidden = false; }
      }

      if (r.time) {
        setRow(['row-taken', 'out-taken'], r.time.dateTimeOriginal);
        setRow(['row-saved', 'out-saved'], r.time.dateTime);
        setRow(['row-offset', 'out-offset'], r.time.offsetTimeOriginal);
        var timeHasAny = timeRows.some(function (pair) {
          var row = document.getElementById(pair[0]);
          return row && !row.hidden;
        });
        var timeGroup = document.getElementById('group-time');
        if (timeGroup && timeHasAny) { timeGroup.hidden = false; }
      }

      if (r.identifying) {
        setRow(['row-serial', 'out-serial'], r.identifying.bodySerialNumber);
        setRow(['row-owner', 'out-owner'], r.identifying.cameraOwnerName);
        setRow(['row-artist', 'out-artist'], r.identifying.artist);
        setRow(['row-copyright', 'out-copyright'], r.identifying.copyright);
        setRow(['row-description', 'out-description'], r.identifying.imageDescription);
      }
      if (r.makerNote && r.makerNote.present) {
        // The sentence around this number lives in index.html, not here —
        // see the comment on #row-makernote (fix pass item 11).
        setRow(['row-makernote', 'out-makernote-bytes'], r.makerNote.size);
      }
      var identifyingHasAny = identifyingRows.some(function (pair) {
        var row = document.getElementById(pair[0]);
        return row && !row.hidden;
      });
      var identifyingGroup = document.getElementById('group-identifying');
      if (identifyingGroup && identifyingHasAny) { identifyingGroup.hidden = false; }

      moveFocusToResults();
    }

    function moveFocusToResults() {
      if (resultsHeading) {
        // Make the jump to results an obvious, deliberate scroll, not just
        // a focus change that may barely move the viewport.
        resultsHeading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        resultsHeading.focus();
      }
    }

    function handleFile(file) {
      if (!file) { return; }
      if (file.size > METADATA_MAX_BYTES) {
        // Distinct from the generic "unreadable" message — this file was
        // never read at all, rejected on size alone (fix pass item 10).
        renderResult({ ok: false, reason: 'too-large' });
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        var result;
        try {
          result = exif.parse(reader.result);
        } catch (e) {
          result = { ok: false, reason: 'parse-error' };
        }
        renderResult(result);
        reader = null; // nothing kept in memory once we're done with it
      };
      reader.onerror = function () {
        renderResult({ ok: false, reason: 'parse-error' });
      };
      reader.readAsArrayBuffer(file.slice(0, METADATA_READ_BYTES));
    }

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) { handleFile(fileInput.files[0]); }
    });

    // Drag-and-drop is an enhancement layered on top of the file input,
    // never the only route in — the input above already works by keyboard
    // and with a screen reader on its own (stage2 plan §9).
    ['dragenter', 'dragover'].forEach(function (evt) {
      dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropZone.setAttribute('data-dragover', 'true');
      });
    });
    ['dragleave', 'dragend'].forEach(function (evt) {
      dropZone.addEventListener(evt, function () {
        dropZone.removeAttribute('data-dragover');
      });
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.removeAttribute('data-dragover');
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) { handleFile(dt.files[0]); }
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        fileInput.value = '';
        resetDisplay();
        dropZone.focus();
      });
    }

    resetDisplay();
  });

});
