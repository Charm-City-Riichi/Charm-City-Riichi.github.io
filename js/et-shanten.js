/* Efficiency Trainer — Shanten Calculator
 *
 * General-purpose shanten calculator for riichi mahjong.
 * Supports standard form (4 mentsu + 1 jantai), chiitoitsu (7 pairs),
 * and kokushi musou (thirteen orphans).
 *
 * Input: array of tile objects ({suit, value}) — 13 or 14 tiles.
 * Output: integer shanten number (-1 = complete, 0 = tenpai, 1+ = away).
 *
 * Depends on: st-core.js (for tile key format only)
 */
(function (ET) {
  'use strict';

  // All 34 tile type keys in canonical order (m1–m9, p1–p9, s1–s9, z1–z7)
  var KEYS = [];
  (function () {
    var suits = ['m', 'p', 's'];
    for (var si = 0; si < suits.length; si++) {
      for (var v = 1; v <= 9; v++) KEYS.push(suits[si] + v);
    }
    for (var h = 1; h <= 7; h++) KEYS.push('z' + h);
  })();

  // Terminal / honor keys for kokushi
  var KOKUSHI_KEYS = [
    'm1', 'm9', 'p1', 'p9', 's1', 's9',
    'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'
  ];

  // Convert tile array to counts object { 'm1': n, ... }
  function tilesToCounts(tiles) {
    var c = {};
    for (var i = 0; i < tiles.length; i++) {
      var k = tiles[i].suit + tiles[i].value;
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }

  // ---- Standard shanten (backtracking) ------------------------------------
  //
  // Uses a counts array indexed 0–33 for fast access, with a "remaining
  // tiles" counter for pruning.  Pruning rule: compute a lower bound on
  // the shanten this branch can achieve; if it can't beat _best, prune.

  var _best; // module-level — updated during scan

  // Flat counts array used during scan (avoids per-call allocation)
  var _c = new Array(34);

  function scan(idx, mentsu, taatsu, jantai, remaining) {
    // Cap taatsu: excess partial groups beyond available mentsu slots are useless.
    // This can happen when taatsu are found at earlier indices and mentsu at later
    // indices, pushing mentsu + taatsu above 4.
    var effTaatsu = (mentsu + taatsu > 4) ? 4 - mentsu : taatsu;

    // Record current state as a valid decomposition (skip everything left)
    var potential = 8 - 2 * mentsu - effTaatsu - jantai;
    if (potential < _best) _best = potential;
    if (_best === -1) return; // can't do better than complete

    // Lower bound: best case if remaining tiles form perfect groups.
    // Each mentsu uses 3 tiles and contributes 2; each taatsu uses 2 and
    // contributes 1; jantai uses 2 and contributes 1.  Greedy: fill mentsu
    // first (best ratio), then taatsu, then jantai.
    var slotsOpen = 4 - mentsu - effTaatsu;
    if (slotsOpen < 0) slotsOpen = 0;
    var addM = slotsOpen;
    var rm = remaining;
    // Can't form more mentsu than tiles allow
    var tilesForM = addM * 3;
    if (tilesForM > rm) { addM = (rm / 3) | 0; tilesForM = addM * 3; }
    rm -= tilesForM;
    var addT = slotsOpen - addM;
    var tilesForT = addT * 2;
    if (tilesForT > rm) { addT = (rm / 2) | 0; tilesForT = addT * 2; }
    rm -= tilesForT;
    var addJ = (!jantai && rm >= 2) ? 1 : 0;
    var lowerBound = 8 - 2 * (mentsu + addM) - (effTaatsu + addT) - (jantai + addJ);
    if (lowerBound >= _best) return;

    // Advance past zero-count tiles
    while (idx < 34 && _c[idx] === 0) idx++;
    if (idx >= 34) return;

    var n = _c[idx];
    var suit = KEYS[idx][0];
    var val = parseInt(KEYS[idx].substring(1), 10);
    var numbered = suit !== 'z';

    // --- Complete groups (mentsu) ---

    // Triplet
    if (n >= 3) {
      _c[idx] -= 3;
      scan(idx, mentsu + 1, taatsu, jantai, remaining - 3);
      _c[idx] += 3;
    }

    // Sequence (numbered suits only, val <= 7)
    // Need to check that idx+1 and idx+2 are in the same suit
    if (numbered && val <= 7) {
      var i2 = idx + 1, i3 = idx + 2;
      if (_c[i2] > 0 && _c[i3] > 0) {
        _c[idx]--; _c[i2]--; _c[i3]--;
        scan(idx, mentsu + 1, taatsu, jantai, remaining - 3);
        _c[idx]++; _c[i2]++; _c[i3]++;
      }
    }

    // --- Jantai (the one allowed pair) ---
    if (!jantai && n >= 2) {
      _c[idx] -= 2;
      scan(idx, mentsu, taatsu, 1, remaining - 2);
      _c[idx] += 2;
    }

    // --- Partial groups (taatsu) — only if slots remain ---
    if (mentsu + taatsu < 4) {
      // Pair as taatsu (toward triplet)
      if (n >= 2) {
        _c[idx] -= 2;
        scan(idx, mentsu, taatsu + 1, jantai, remaining - 2);
        _c[idx] += 2;
      }

      // Adjacent partial sequence (e.g. 45)
      if (numbered && val <= 8) {
        var iAdj = idx + 1;
        if (_c[iAdj] > 0) {
          _c[idx]--; _c[iAdj]--;
          scan(idx, mentsu, taatsu + 1, jantai, remaining - 2);
          _c[idx]++; _c[iAdj]++;
        }
      }

      // Skip-one partial sequence / kanchan (e.g. 46)
      if (numbered && val <= 7) {
        var iSkip = idx + 2;
        if (_c[iSkip] > 0) {
          _c[idx]--; _c[iSkip]--;
          scan(idx, mentsu, taatsu + 1, jantai, remaining - 2);
          _c[idx]++; _c[iSkip]++;
        }
      }
    }

    // --- Skip all copies of this tile ---
    _c[idx] = 0;
    scan(idx + 1, mentsu, taatsu, jantai, remaining - n);
    _c[idx] = n;
  }

  function shantenStandard(counts) {
    // Copy into flat array
    var total = 0;
    for (var i = 0; i < 34; i++) {
      _c[i] = counts[KEYS[i]] || 0;
      total += _c[i];
    }
    _best = 8;
    scan(0, 0, 0, 0, total);
    return _best;
  }

  // ---- Chiitoitsu shanten -------------------------------------------------

  function shantenChiitoitsu(counts) {
    var pairs = 0;
    for (var i = 0; i < 34; i++) {
      if ((counts[KEYS[i]] || 0) >= 2) pairs++;
    }
    return 6 - pairs;
  }

  // ---- Kokushi shanten ----------------------------------------------------

  function shantenKokushi(counts) {
    var unique = 0;
    var hasDup = false;
    for (var i = 0; i < KOKUSHI_KEYS.length; i++) {
      var c = counts[KOKUSHI_KEYS[i]] || 0;
      if (c >= 1) unique++;
      if (c >= 2) hasDup = true;
    }
    return 13 - unique - (hasDup ? 1 : 0);
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * calculateShanten(tiles)
   *   tiles: array of 13 or 14 tile objects ({suit, value})
   *   returns: integer shanten (-1 = complete hand)
   */
  function calculateShanten(tiles) {
    var counts = tilesToCounts(tiles);
    var std = shantenStandard(counts);
    var chi = shantenChiitoitsu(counts);
    var kok = shantenKokushi(counts);
    var best = std;
    if (chi < best) best = chi;
    if (kok < best) best = kok;
    return best;
  }

  /**
   * calculateShantenFromCounts(counts)
   *   counts: object { 'm1': n, ... } — tile counts
   *   returns: integer shanten
   *   Faster path when caller already has counts (avoids rebuilding).
   */
  function calculateShantenFromCounts(counts) {
    var std = shantenStandard(counts);
    var chi = shantenChiitoitsu(counts);
    var kok = shantenKokushi(counts);
    var best = std;
    if (chi < best) best = chi;
    if (kok < best) best = kok;
    return best;
  }

  // ---- Self-test (call from browser console) -------------------------------
  //   EfficiencyTrainer.selfTest()

  function selfTest() {
    var ST = window.ScoreTrainer;
    var pass = 0, fail = 0;

    function check(notation, expected, label) {
      var tiles = ST.parseNotation(notation);
      var got = calculateShanten(tiles);
      if (got === expected) {
        pass++;
        console.log('OK   ' + label + ': ' + notation +
          ' (' + tiles.length + ' tiles) = ' + got);
      } else {
        console.error('FAIL ' + label + ': ' + notation +
          ' (' + tiles.length + ' tiles) expected=' + expected + ' got=' + got);
        fail++;
      }
    }

    // ---- Complete hands (14 tiles, shanten = -1) ----
    //   123m=m1m2m3, 456p=p4p5p6, 234789s=s2s3s4s7s8s9, 11z=z1z1 → 3+3+6+2=14
    check('123m456p234789s11z',  -1, 'complete standard (4 mentsu + pair)');
    //   7 distinct honor pairs → 14
    check('11223344556677z',     -1, 'complete chiitoitsu');
    //   13 unique TH + z7 pair → 14
    check('19m19p19s12345677z',  -1, 'complete kokushi');

    // ---- Tenpai (13 tiles, shanten = 0) ----
    //   m123+p456+s789 = 3 mentsu, s23 taatsu, z11 jantai → 3+3+5+2=13
    check('123m456p23789s11z',    0, 'tenpai standard (ryanmen s1/s4)');
    //   6 pairs + z7 single → 13
    check('1122334455667z',       0, 'tenpai chiitoitsu');
    //   13 unique TH, no dup → 13
    check('19m19p19s1234567z',    0, 'tenpai kokushi 13-sided');
    //   m123+m456+m789 = 3 mentsu, p12 taatsu, s55 jantai → 9+2+2=13
    check('123456789m12p55s',     0, 'tenpai penchan');

    // ---- Iishanten (13 tiles, shanten = 1) ----
    //   3 mentsu + z33 jantai + z1,z2 isolated → 3+3+3+4=13
    check('123m456p789s1233z',    1, 'iishanten standard');
    //   m1m9m9 + p1p9 + s1s9 + z1-z5 → 3+2+2+5=12 ... no
    //   m1m1m9m9 + p1p9 + s1s9 + z1-z5 → 4+2+2+5=13, kokushi missing z6,z7
    check('1199m19p19s12345z',    1, 'iishanten kokushi (11 TH + dup)');

    // ---- Shanten = 2 (13 tiles) ----
    //   m123+p456 = 2 mentsu, s34 taatsu, z55 jantai, m7+p1+s9 isolated → 4+4+3+2=13
    check('1237m1456p349s55z',    2, 'shanten 2');

    // ---- 14-tile hands ----
    //   3 mentsu + z22 taatsu + z11 jantai + z3 skipped → 3+3+3+5=14
    check('123m456p789s11223z',   0, '14-tile tenpai');
    //   3 mentsu + z222 mentsu + z11 pair → 3+3+3+5=14
    check('123m456p789s11222z',  -1, '14-tile complete');

    console.log('Shanten self-test: ' + pass + ' passed, ' + fail + ' failed');
    return fail === 0;
  }

  // ---- Exports ------------------------------------------------------------

  ET.KEYS = KEYS;
  ET.tilesToCounts = tilesToCounts;
  ET.calculateShanten = calculateShanten;
  ET.calculateShantenFromCounts = calculateShantenFromCounts;
  ET.selfTest = selfTest;

})(window.EfficiencyTrainer || (window.EfficiencyTrainer = {}));
