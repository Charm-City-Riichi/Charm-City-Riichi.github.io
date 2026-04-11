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
    // Record current state as a valid decomposition (skip everything left)
    var potential = 8 - 2 * mentsu - taatsu - jantai;
    if (potential < _best) _best = potential;
    if (_best === -1) return; // can't do better than complete

    // Lower bound: best case if remaining tiles form perfect groups.
    // Each mentsu uses 3 tiles and contributes 2; each taatsu uses 2 and
    // contributes 1; jantai uses 2 and contributes 1.  Greedy: fill mentsu
    // first (best ratio), then taatsu, then jantai.
    var slotsOpen = 4 - mentsu;
    var addM = slotsOpen < 0 ? 0 : slotsOpen;
    var rm = remaining;
    // Can't form more mentsu than tiles allow
    var tilesForM = addM * 3;
    if (tilesForM > rm) { addM = (rm / 3) | 0; tilesForM = addM * 3; }
    rm -= tilesForM;
    var addT = 4 - mentsu - addM - taatsu;
    if (addT < 0) addT = 0;
    var tilesForT = addT * 2;
    if (tilesForT > rm) { addT = (rm / 2) | 0; tilesForT = addT * 2; }
    rm -= tilesForT;
    var addJ = (!jantai && rm >= 2) ? 1 : 0;
    var lowerBound = 8 - 2 * (mentsu + addM) - (taatsu + addT) - (jantai + addJ);
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

  // ---- Exports ------------------------------------------------------------

  ET.KEYS = KEYS;
  ET.tilesToCounts = tilesToCounts;
  ET.calculateShanten = calculateShanten;
  ET.calculateShantenFromCounts = calculateShantenFromCounts;

})(window.EfficiencyTrainer || (window.EfficiencyTrainer = {}));
