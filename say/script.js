// script.js
// This is the code for my typing practice game.

(function () {

  // ======================================================
  // SENTENCES
  // These are the sentences the game cycles through, one after
  // because the user typing them doesn't need to worry about those.
  // ======================================================
  var SENTENCES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "The five boxing wizards jump quickly while a lazy fox watches from the shade of an old oak tree",
    "Bright vixens jump; dozy fowl quack when the cold wind blows across the quiet valley at dawn",
    "Sphinx of black quartz judge my vow: the swift brown fox never gives up without a fight",
    "In the heart of the ancient forest where sunlight rarely touched the mossy ground a curious fox wandered quietly past twisted roots and fallen logs searching for a place to rest before the coming storm swept through the valley below",
    "Quick decisions rarely came easily to her yet on that particular morning with the fog rolling low across the meadow and the birds falling silent she knew exactly which path to take and why it mattered most"
  ];

  // ======================================================
  // ACHIEVEMENTS
  // Each one has an id (so we remember it's unlocked), a label to
  // show the user, and a "check" function that returns true when
  // the player has earned it.
  // ======================================================
  var ACHIEVEMENTS = [
    {
      id: 'first_run',
      label: 'Getting Started',
      check: function (run, dailyStreak, history) {
        return history.length === 1;
      }
    },
    {
      id: 'clean_sweep',
      label: 'Clean Sweep — 100% accuracy',
      check: function (run) {
        return run.accuracy === 100;
      }
    },
    {
      id: 'speed_demon',
      label: 'Speed Demon — 70+ WPM',
      check: function (run) {
        return run.wpm >= 70;
      }
    },
    {
      id: 'consistent',
      label: 'Consistent — 7 day streak',
      check: function (run, dailyStreak) {
        return dailyStreak >= 7;
      }
    }
  ];

  // These are just the names (keys) I use to save stuff in
  // localStorage. Keeping them as variables so I don't typo the
  // string somewhere and break the save/load.
  var STORE_KEY = 'sayitright_history_v1';
  var SENTENCE_IDX_KEY = 'sayitright_sentence_idx';
  var WEAK_KEY = 'sayitright_weakkeys';
  var ACH_KEY = 'sayitright_achievements';
  var STREAK_KEY = 'sayitright_streak';

  // ======================================================
  // GRABBING ALL THE HTML ELEMENTS I NEED
  // I do this once at the top so I don't have to keep calling
  // document.getElementById everywhere.
  // ======================================================
  var typeLine = document.getElementById('type-line');
  var hiddenInput = document.getElementById('hidden-input');
  var stage = document.getElementById('stage');
  var statTime = document.getElementById('stat-time');
  var statWpm = document.getElementById('stat-wpm');
  var statAcc = document.getElementById('stat-acc');
  var statMistakes = document.getElementById('stat-mistakes');
  var streakCount = document.getElementById('streak-count');
  var dailyStreakCount = document.getElementById('daily-streak-count');
  var resultCard = document.getElementById('result-card');
  var resultTitle = document.getElementById('result-title');
  var resultSub = document.getElementById('result-sub');
  var compareBanner = document.getElementById('compare-banner');
  var achievementToast = document.getElementById('achievement-toast');
  var resultStars = document.getElementById('result-stars');
  var rWpm = document.getElementById('r-wpm');
  var rAcc = document.getElementById('r-acc');
  var rTime = document.getElementById('r-time');
  var rScore = document.getElementById('r-score');
  var retryBtn = document.getElementById('retry-btn');
  var soundToggle = document.getElementById('sound-toggle');
  var testSoundBtn = document.getElementById('test-sound-btn');
  var pauseBtn = document.getElementById('pause-btn');
  var hintText = document.getElementById('hint-text');
  var startOverlay = document.getElementById('start-overlay');

  var tabPractice = document.getElementById('tab-practice');
  var tabProgress = document.getElementById('tab-progress');
  var viewPractice = document.getElementById('view-practice');
  var viewProgress = document.getElementById('view-progress');

  // If the user stops typing for this many milliseconds, we
  // automatically pause the run for them (so they don't come back
  // to a timer that kept running while they were away).
  var IDLE_LIMIT_MS = 8000;
  var DEFAULT_HINT = 'Wrong key? Listen for the letter that comes next.';

  // ======================================================
  // GAME STATE
  // These variables change while the game is being played.
  // I reset most of them every time a new run starts.
  // ======================================================
  var TEXT = '';              // the sentence being typed right now
  var sentenceIdx = 0;        // which sentence we're on
  var pos = 0;                // how many characters typed correctly so far
  var mistakesTotal = 0;      // how many wrong keys this run
  var runStartTime = null;    // Date.now() value for when typing started
  var pausedAccumMs = 0;      // total ms elapsed before the current pause
  var started = false;        // has the user typed anything yet this run
  var isPaused = false;
  var finished = false;
  var timerHandle = null;     // setInterval id for the live stat updates
  var idleHandle = null;      // setTimeout id for the auto-pause
  var charSpans = [];         // array of <span> elements, one per letter

  // ------------------------------------------------------
  // SAVING AND LOADING FROM localStorage
  // I wrap everything in try/catch because some browsers block
  // localStorage (private/incognito mode) and I don't want the
  // whole app to crash if that happens - it should just not save.
  // ------------------------------------------------------
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (e) {
      // if this fails, we just don't save - not a big deal
    }
  }

  function loadWeakKeys() {
    try {
      var raw = localStorage.getItem(WEAK_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveWeakKeys(obj) {
    try {
      localStorage.setItem(WEAK_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  // Every time the user misses a key, we add 1 to that letter's
  // count so the progress page can show which letters trip them
  // up the most.
  function bumpWeakKey(ch) {
    var key = ch === ' ' ? '\u2423' : ch.toLowerCase();
    var wk = loadWeakKeys();
    if (wk[key]) {
      wk[key] = wk[key] + 1;
    } else {
      wk[key] = 1;
    }
    saveWeakKeys(wk);
  }

  function loadAchievements() {
    try {
      var raw = localStorage.getItem(ACH_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAchievements(list) {
    try {
      localStorage.setItem(ACH_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // ======================================================
  // TEXT TO SPEECH (for when the user types the wrong letter)
  // ======================================================

  // NOTE: I found out that in some browsers, if you call
  // speechSynthesis.cancel() and then speak() right away in the
  // same line, the new speech can get silently dropped. So I only
  // call cancel() when something is ALREADY talking, and I wait a
  // tiny bit (30ms) before speaking the new thing. If nothing is
  // talking, I just speak immediately.
  function speakLabel(label) {
    if (!('speechSynthesis' in window)) {
      return; // this browser doesn't support text to speech at all
    }
    var synth = window.speechSynthesis;
    try {
      var utter = new SpeechSynthesisUtterance(label);
      utter.rate = 0.9;
      utter.pitch = 1;
      utter.volume = 1;
      if (synth.speaking || synth.pending) {
        synth.cancel();
        setTimeout(function () {
          try {
            synth.speak(utter);
          } catch (e) {}
        }, 30);
      } else {
        synth.speak(utter);
      }
    } catch (e) {}
  }

  // Turns a character into something that actually sounds right
  // when spoken out loud. A raw space or period doesn't say
  // anything useful on its own.
  function labelFor(ch) {
    if (ch === ' ') return 'space';
    if (ch === '.') return 'period';
    if (ch === ',') return 'comma';
    if (ch === ';') return 'semicolon';
    if (ch === ':') return 'colon';
    if (ch === '!') return 'exclamation mark';
    return ch;
  }

  function speakChar(ch) {
    if (!soundToggle.checked) return; // user turned the sound off
    speakLabel(labelFor(ch));
  }

  // Little button so the user can check their speakers/voices are
  // working without having to make a mistake on purpose.
  testSoundBtn.addEventListener('click', function () {
    speakLabel('t, as in test');
  });

  // ======================================================
  // PICKING THE NEXT SENTENCE
  // Sentences just go in order, looping back to the start once we
  // reach the end of the list. I save the index in localStorage so
  // it keeps going from where it left off even after a refresh.
  // ======================================================
  function nextSentence() {
    TEXT = SENTENCES[sentenceIdx % SENTENCES.length];
    sentenceIdx = sentenceIdx + 1;
    try {
      localStorage.setItem(SENTENCE_IDX_KEY, String(sentenceIdx));
    } catch (e) {}
  }

  // Builds the row of letters on screen. Each letter gets wrapped
  // in its own <span> so I can color it individually as the user
  // types (untyped / correct / wrong / current).
  function buildLine() {
    typeLine.innerHTML = '';
    charSpans = [];
    for (var i = 0; i < TEXT.length; i++) {
      var ch = TEXT[i];
      var span = document.createElement('span');
      span.className = 'ch';
      // a plain space character can collapse visually, so use a
      // non-breaking space instead
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      typeLine.appendChild(span);
      charSpans.push(span);
    }
    if (charSpans.length > 0) {
      charSpans[0].classList.add('current');
    }
  }

  // ======================================================
  // START BUTTON + COUNTDOWN
  // Before every run, the input box is disabled and we show a
  // "Start" button. Clicking it runs a 3-2-1-Go countdown, then
  // the input is enabled and focused so the user can start typing.
  // ======================================================
  function showStartOverlay() {
    startOverlay.classList.remove('hidden');
    startOverlay.innerHTML =
      '<div class="overlay-inner">' +
      '<div class="overlay-title">Ready when you are</div>' +
      '<button class="btn btn-primary" id="start-btn">Start</button>' +
      '</div>';
    document.getElementById('start-btn').addEventListener('click', beginCountdown);
    hiddenInput.disabled = true;
  }

  function beginCountdown() {
    var inner = startOverlay.querySelector('.overlay-inner');
    var n = 3;
    inner.innerHTML = '<div class="overlay-count">' + n + '</div>';

    var iv = setInterval(function () {
      n = n - 1;
      if (n > 0) {
        inner.innerHTML = '<div class="overlay-count">' + n + '</div>';
      } else if (n === 0) {
        inner.innerHTML = '<div class="overlay-count">Go!</div>';
      } else {
        // countdown is done, let the user actually type now
        clearInterval(iv);
        startOverlay.classList.add('hidden');
        hiddenInput.disabled = false;
        hiddenInput.focus();
      }
    }, 550);
  }

  // ======================================================
  // STARTING / RESETTING A RUN
  // Called at the very beginning and every time the user clicks
  // "Try again". Resets all the game state back to zero and picks
  // the next sentence.
  // ======================================================
  function resetRun() {
    nextSentence();

    pos = 0;
    mistakesTotal = 0;
    runStartTime = null;
    pausedAccumMs = 0;
    started = false;
    isPaused = false;
    finished = false;

    hiddenInput.value = '';
    clearInterval(timerHandle);
    clearTimeout(idleHandle);

    stage.classList.remove('paused');
    pauseBtn.textContent = 'Pause';
    hintText.textContent = DEFAULT_HINT;

    statTime.textContent = '0.0s';
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
    statMistakes.textContent = '0';

    resultCard.classList.remove('show');

    buildLine();
    showStartOverlay();
  }

  // ------------------------------------------------------
  // TIME / SPEED / ACCURACY MATH
  // ------------------------------------------------------

  // How many seconds have actually elapsed while typing (not
  // counting time spent paused).
  function elapsedSeconds() {
    if (!started) return 0;
    var activeMs = isPaused ? 0 : (Date.now() - runStartTime);
    return (pausedAccumMs + activeMs) / 1000;
  }

  // Standard typing test formula: 5 characters counts as one
  // "word", divided by minutes elapsed.
  function currentWpm() {
    var secs = elapsedSeconds();
    if (secs <= 0) return 0;
    var words = pos / 5;
    return Math.round((words / secs) * 60);
  }

  function currentAccuracy() {
    var attempts = pos + mistakesTotal;
    if (attempts <= 0) return 100;
    return Math.max(0, Math.round((pos / attempts) * 100));
  }

  // Runs every 100ms while the timer is going, just refreshing
  // the numbers on screen.
  function tickTimer() {
    statTime.textContent = elapsedSeconds().toFixed(1) + 's';
    statWpm.textContent = String(currentWpm());
    statAcc.textContent = currentAccuracy() + '%';
  }

  // Restarts the "have they gone quiet" timer. Called every time
  // the user types something. If it ever actually fires, that
  // means they stopped typing for too long, so we auto-pause.
  function resetIdleTimer() {
    clearTimeout(idleHandle);
    if (!started || finished || isPaused) return;
    idleHandle = setTimeout(function () {
      pauseRun(true);
    }, IDLE_LIMIT_MS);
  }

  // ------------------------------------------------------
  // PAUSE / RESUME
  // ------------------------------------------------------
  function pauseRun(dueToIdle) {
    if (!started || finished || isPaused) return;

    // "bank" the time we've used so far so the clock doesn't
    // keep running while paused
    pausedAccumMs = pausedAccumMs + (Date.now() - runStartTime);
    isPaused = true;

    clearInterval(timerHandle);
    clearTimeout(idleHandle);

    hiddenInput.disabled = true;
    hiddenInput.blur();
    stage.classList.add('paused');
    pauseBtn.textContent = 'Resume';

    if (dueToIdle) {
      hintText.textContent = "Paused — you'd stopped typing. Click Resume when you're ready.";
    } else {
      hintText.textContent = 'Paused. Click Resume to keep going.';
    }
  }

  function resumeRun() {
    if (!started || finished || !isPaused) return;
    isPaused = false;
    runStartTime = Date.now(); // start counting fresh from now
    timerHandle = setInterval(tickTimer, 100);
    hiddenInput.disabled = false;
    stage.classList.remove('paused');
    pauseBtn.textContent = 'Pause';
    hintText.textContent = DEFAULT_HINT;
    hiddenInput.focus();
    resetIdleTimer();
  }

  // ------------------------------------------------------
  // STREAKS
  // ------------------------------------------------------

  // Counts how many runs in a row had 95%+ accuracy. Resets to 0
  // the moment a run falls below that.
  function updateAccuracyStreak(accuracy) {
    var streak = 0;
    try {
      streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
    } catch (e) {}

    if (accuracy >= 95) {
      streak = streak + 1;
    } else {
      streak = 0;
    }

    try {
      localStorage.setItem(STREAK_KEY, String(streak));
    } catch (e) {}

    streakCount.textContent = String(streak);
  }

  // Counts how many days in a row (including today, or yesterday
  // if today has no runs yet) the user has practiced at least once.
  function computeDailyStreak(history) {
    if (!history.length) return 0;

    var days = new Set();
    for (var i = 0; i < history.length; i++) {
      days.add(new Date(history[i].when).toDateString());
    }

    var streak = 0;
    var cursor = new Date();
    if (!days.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(cursor.toDateString())) {
      streak = streak + 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ------------------------------------------------------
  // SCORING
  // ------------------------------------------------------

  // Made-up formula: faster + more accurate = higher score, plus
  // a small bonus for finishing quickly.
  function scoreFor(wpm, accuracy, seconds) {
    var base = wpm * (accuracy / 100) * 10;
    var speedBonus = Math.max(0, 20 - seconds) * 5;
    return Math.round(base + speedBonus);
  }

  // How many stars (1-3) to show based on how the run went.
  function starsFor(wpm, accuracy) {
    var n = 1;
    if (wpm >= 30 && accuracy >= 90) n = 2;
    if (wpm >= 50 && accuracy >= 96) n = 3;
    return n;
  }

  // Compares this run to the previous one and writes a little
  // "vs last run" message.
  function renderCompareBanner(run, history) {
    var previous = history.length ? history[history.length - 1] : null;
    if (!previous) {
      compareBanner.textContent = 'First run logged — next time you\u2019ll see how you compare.';
      compareBanner.classList.add('neutral');
      return;
    }
    compareBanner.classList.remove('neutral');
    var dW = run.wpm - previous.wpm;
    var dA = run.accuracy - previous.accuracy;
    compareBanner.textContent =
      'vs last run: ' + (dW >= 0 ? '+' : '') + dW + ' WPM, ' +
      (dA >= 0 ? '+' : '') + dA + '% accuracy';
  }

  // Checks every achievement to see if the user just unlocked any
  // new ones, and shows them in the results card if so.
  function renderAchievements(run, dailyStreak, history) {
    var unlocked = loadAchievements();
    var newly = [];

    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      var alreadyHave = unlocked.indexOf(a.id) !== -1;
      if (!alreadyHave && a.check(run, dailyStreak, history)) {
        unlocked.push(a.id);
        newly.push(a);
      }
    }

    saveAchievements(unlocked);

    if (newly.length > 0) {
      var html = '';
      for (var j = 0; j < newly.length; j++) {
        html += '<div class="achievement-pill">\u{1F3C6} Achievement unlocked: ' + newly[j].label + '</div>';
      }
      achievementToast.innerHTML = html;
      achievementToast.classList.add('show');
    } else {
      achievementToast.classList.remove('show');
      achievementToast.innerHTML = '';
    }
  }

  // ======================================================
  // FINISHING A RUN
  // Called once the user has correctly typed the whole sentence.
  // ======================================================
  function finishRun() {
    finished = true;
    clearInterval(timerHandle);
    clearTimeout(idleHandle);

    var seconds = elapsedSeconds();
    var wpm = currentWpm();
    var accuracy = currentAccuracy();
    var score = scoreFor(wpm, accuracy, seconds);
    var stars = starsFor(wpm, accuracy);

    // update the live stat bar one last time with the final numbers
    statTime.textContent = seconds.toFixed(1) + 's';
    statWpm.textContent = String(wpm);
    statAcc.textContent = accuracy + '%';

    // fill in the results card
    rWpm.textContent = String(wpm);
    rAcc.textContent = accuracy + '%';
    rTime.textContent = seconds.toFixed(1) + 's';
    rScore.textContent = String(score);

    var starsHtml = '';
    for (var s = 0; s < 3; s++) {
      starsHtml += '<span class="' + (s < stars ? 'star-on' : 'star-off') + '">★</span>';
    }
    resultStars.innerHTML = starsHtml;

    if (stars === 3) {
      resultTitle.textContent = 'Flawless run!';
    } else if (stars === 2) {
      resultTitle.textContent = 'Solid run.';
    } else {
      resultTitle.textContent = 'Line complete.';
    }

    if (mistakesTotal === 0) {
      resultSub.textContent = 'Zero mistakes — clean sheet.';
    } else {
      resultSub.textContent = mistakesTotal + ' mistake' + (mistakesTotal === 1 ? '' : 's') + ' along the way.';
    }

    resultCard.classList.add('show');

    updateAccuracyStreak(accuracy);

    // save this run into the history list
    var history = loadHistory();
    var run = {
      when: Date.now(),
      wpm: wpm,
      accuracy: accuracy,
      seconds: Math.round(seconds * 10) / 10,
      score: score
    };
    renderCompareBanner(run, history); // compare BEFORE adding the new run
    history.push(run);
    saveHistory(history);

    var dailyStreak = computeDailyStreak(history);
    dailyStreakCount.textContent = String(dailyStreak);
    renderAchievements(run, dailyStreak, history);
  }

  // ======================================================
  // HANDLING KEYSTROKES
  // This runs every time the hidden text input changes. It's the
  // heart of the whole game.
  // ======================================================
  function handleTyping(inputVal) {
    if (finished || isPaused) return;

    // start the clock the moment the user types their first letter
    if (!started && inputVal.length > 0) {
      started = true;
      runStartTime = Date.now();
      timerHandle = setInterval(tickTimer, 100);
    }
    resetIdleTimer();

    if (inputVal.length > pos) {
      // user typed a new character - check if it's the right one
      var typedChar = inputVal[inputVal.length - 1];
      var expectedChar = TEXT[pos];

      // toLowerCase on both sides means Shift/Caps Lock doesn't matter
      if (typedChar.toLowerCase() === expectedChar.toLowerCase()) {
        charSpans[pos].classList.remove('current', 'wrong');
        charSpans[pos].classList.add('correct');
        pos = pos + 1;
        if (pos < charSpans.length) {
          charSpans[pos].classList.add('current');
        }
        if (pos >= TEXT.length) {
          finishRun();
          return;
        }
      } else {
        // wrong key - flash red, say the correct letter out loud,
        // and don't let the wrong character actually get typed
        mistakesTotal = mistakesTotal + 1;
        statMistakes.textContent = String(mistakesTotal);
        bumpWeakKey(expectedChar);

        charSpans[pos].classList.add('wrong-flash');
        setTimeout(function () {
          if (charSpans[pos]) {
            charSpans[pos].classList.remove('wrong-flash');
          }
        }, 150);

        speakChar(expectedChar);

        // reset the input box back to just what they've gotten right
        hiddenInput.value = TEXT.slice(0, pos);
        statAcc.textContent = currentAccuracy() + '%';
        return;
      }
    } else if (inputVal.length < pos) {
      // shouldn't really happen since typing is locked to one
      // character at a time, but just in case, resync it
      hiddenInput.value = TEXT.slice(0, pos);
    }
  }

  hiddenInput.addEventListener('input', function (e) {
    handleTyping(e.target.value);
  });

  stage.addEventListener('click', function () {
    if (!isPaused && !hiddenInput.disabled) {
      hiddenInput.focus();
    }
  });

  retryBtn.addEventListener('click', function () {
    resetRun();
  });

  pauseBtn.addEventListener('click', function () {
    if (!started || finished) return;
    if (isPaused) {
      resumeRun();
    } else {
      pauseRun(false);
    }
  });

  // ======================================================
  // TABS (Practice vs Progress)
  // ======================================================
  function showTab(name) {
    var isPractice = name === 'practice';
    tabPractice.classList.toggle('active', isPractice);
    tabProgress.classList.toggle('active', !isPractice);
    viewPractice.classList.toggle('active', isPractice);
    viewProgress.classList.toggle('active', !isPractice);
    if (!isPractice) {
      renderProgress(); // refresh the numbers every time they open this tab
    }
  }

  tabPractice.addEventListener('click', function () {
    showTab('practice');
  });
  tabProgress.addEventListener('click', function () {
    showTab('progress');
  });

  // ======================================================
  // PROGRESS PAGE
  // ======================================================

  // Turns a timestamp into something readable like "Sep 23, 4:05 PM"
  function fmtWhen(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  // Draws a simple line chart as raw SVG. I didn't want to bring in
  // a whole charting library just for two small graphs, so I built
  // the lines/dots/gridlines by hand with basic math.
  function drawLineChart(svg, values, maxOverride, color) {
    var W = 680, H = 180, padL = 34, padR = 10, padT = 14, padB = 24;
    var n = values.length;

    var biggest = Math.max.apply(null, values);
    var maxV = maxOverride || Math.max(10, Math.ceil((biggest + 5) / 10) * 10);

    var stepX = n > 1 ? (W - padL - padR) / (n - 1) : 0;

    function xFor(i) {
      return padL + stepX * i;
    }
    function yFor(v) {
      return padT + (H - padT - padB) * (1 - v / maxV);
    }

    var parts = [];

    // draw 5 horizontal gridlines with numbers on the left
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (H - padT - padB) * (g / 4);
      var val = Math.round(maxV * (1 - g / 4));
      parts.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#2A3040" stroke-width="1"/>');
      parts.push('<text x="4" y="' + (gy + 4) + '" font-size="10" fill="#8B92A5" font-family="JetBrains Mono, monospace">' + val + '</text>');
    }

    // draw the connecting line, point by point
    var pathD = '';
    for (var i = 0; i < values.length; i++) {
      var x = xFor(i);
      var y = yFor(values[i]);
      pathD += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    parts.push('<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');

    // draw a small circle on top of each data point
    for (var i2 = 0; i2 < values.length; i2++) {
      var x2 = xFor(i2);
      var y2 = yFor(values[i2]);
      parts.push('<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3.5" fill="#161A22" stroke="' + color + '" stroke-width="2"/>');
    }

    svg.innerHTML = parts.join('');
  }

  // Shows the letters the user misses most often, worst first.
  function renderWeakKeys() {
    var wk = loadWeakKeys();

    // turn the {letter: count} object into a sortable array
    var entries = [];
    for (var key in wk) {
      if (wk[key] > 0) {
        entries.push([key, wk[key]]);
      }
    }
    entries.sort(function (a, b) {
      return b[1] - a[1]; // highest miss-count first
    });
    entries = entries.slice(0, 6); // just show the top 6

    var row = document.getElementById('weak-keys-row');
    if (entries.length === 0) {
      row.innerHTML = '<span class="weak-keys-empty">No missed keys yet — keep going!</span>';
      return;
    }

    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var letter = entries[i][0];
      var count = entries[i][1];
      var displayLetter = letter === ' ' ? 'space' : letter;
      html += '<span class="weak-chip">' + displayLetter + ' <b>\u00D7' + count + '</b></span>';
    }
    row.innerHTML = html;
  }

  // Fills in the whole progress tab: the summary numbers, the two
  // charts, the weak-keys list, and the history table.
  function renderProgress() {
    var history = loadHistory();
    var emptyMsg = document.getElementById('progress-empty');
    var content = document.getElementById('progress-content');

    if (history.length === 0) {
      emptyMsg.style.display = 'block';
      content.style.display = 'none';
      return;
    }
    emptyMsg.style.display = 'none';
    content.style.display = 'block';

    var wpms = [];
    var accs = [];
    for (var i = 0; i < history.length; i++) {
      wpms.push(history[i].wpm);
      accs.push(history[i].accuracy);
    }

    var bestWpm = Math.max.apply(null, wpms);
    var sumWpm = 0;
    for (var j = 0; j < wpms.length; j++) {
      sumWpm += wpms[j];
    }
    var avgWpm = Math.round(sumWpm / wpms.length);
    var bestAcc = Math.max.apply(null, accs);

    document.getElementById('p-best-wpm').textContent = String(bestWpm);
    document.getElementById('p-avg-wpm').textContent = String(avgWpm);
    document.getElementById('p-best-acc').textContent = bestAcc + '%';
    document.getElementById('p-attempts').textContent = String(history.length);

    drawLineChart(document.getElementById('chart-svg-wpm'), wpms, null, '#E3A23C');
    drawLineChart(document.getElementById('chart-svg-acc'), accs, 100, '#7FAE8C');
    renderWeakKeys();

    // build the history table, newest attempt at the top
    var reversed = history.slice().reverse();
    var rowsHtml = '';
    for (var k = 0; k < reversed.length; k++) {
      var h = reversed[k];
      var attemptNumber = history.length - k;
      rowsHtml += '<tr><td>' + attemptNumber + '</td><td>' + fmtWhen(h.when) + '</td><td>' +
        h.wpm + '</td><td>' + h.accuracy + '%</td><td>' + h.seconds + 's</td><td>' + h.score + '</td></tr>';
    }
    document.getElementById('history-body').innerHTML = rowsHtml;
  }

  document.getElementById('clear-history').addEventListener('click', function () {
    saveHistory([]);
    saveWeakKeys({});
    try {
      localStorage.removeItem(STREAK_KEY);
    } catch (e) {}
    streakCount.textContent = '0';
    dailyStreakCount.textContent = '0';
    renderProgress();
  });

  // ======================================================
  // EXPORTING HISTORY AS A CSV FILE
  // "downloads" is a special capability given to this page by the
  // Claude artifact environment - it's how we save an actual file
  // to the user's computer from inside the sandboxed page.
  // ======================================================
  async function getDownloads() {
    if (!window.claude || !window.claude.use) return null;
    try {
      return await window.claude.use('downloads');
    } catch (e) {
      return null;
    }
  }

  document.getElementById('export-btn').addEventListener('click', async function () {
    var history = loadHistory();
    if (history.length === 0) return;

    var header = 'Attempt,When,WPM,Accuracy,Seconds,Score';
    var rows = [];
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      rows.push([i + 1, new Date(h.when).toISOString(), h.wpm, h.accuracy, h.seconds, h.score].join(','));
    }
    var csv = [header].concat(rows).join('\n');

    var downloads = await getDownloads();
    if (!downloads) {
      alert('File downloads aren\u2019t available in this view.');
      return;
    }
    try {
      await downloads.save({ filename: 'typing-history.csv', data: csv });
    } catch (e) {
      // user probably cancelled the save - nothing else to do
    }
  });

  // ======================================================
  // PAGE LOAD / FIRST RUN SETUP
  // ======================================================
  (function init() {
    try {
      sentenceIdx = parseInt(localStorage.getItem(SENTENCE_IDX_KEY) || '0', 10) || 0;
    } catch (e) {
      sentenceIdx = 0;
    }

    var streak = 0;
    try {
      streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
    } catch (e) {}
    streakCount.textContent = String(streak);

    dailyStreakCount.textContent = String(computeDailyStreak(loadHistory()));

    resetRun();
  })();

})();
