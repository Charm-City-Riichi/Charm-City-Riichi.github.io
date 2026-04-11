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

  var _best; // module-level variable updated during scan

  function scan(counts, keyIdx, mentsu, taatsu, jantai) {
    // Upper bound: shanten if we skip all remaining tiles
    var potential = 8 - 2 * mentsu - taatsu - jantai;
    if (potential < _best) _best = potential;

    // Advance past zero-count keys
    while (keyIdx < 34 && !(counts[KEYS[keyIdx]] > 0)) keyIdx++;
    if (keyIdx >= 34) return;

    var key = KEYS[keyIdx];
    var suit = key[0];
    var val = parseInt(key.substring(1), 10);
    var numbered = suit !== 'z';
    var canPartial = mentsu + taatsu < 4;

    // --- Complete groups (mentsu) ---

    // Triplet
    if (counts[key] >= 3) {
      counts[key] -= 3;
      scan(counts, keyIdx, mentsu + 1, taatsu, jantai);
      counts[key] += 3;
    }

    // Sequence (numbered suits only, val <= 7)
    if (numbered && val <= 7) {
      var k2 = suit + (val + 1);
      var k3 = suit + (val + 2);
      if ((counts[k2] || 0) > 0 && (counts[k3] || 0) > 0) {
        counts[key]--;
        counts[k2]--;
        counts[k3]--;
        scan(counts, keyIdx, mentsu + 1, taatsu, jantai);
        counts[key]++;
        counts[k2]++;
        counts[k3]++;
      }
    }

    // --- Partial groups (taatsu) — only if room (mentsu + taatsu < 4) ---

    // Pair as jantai (the one allowed pair, not a taatsu)
    if (!jantai && counts[key] >= 2) {
      counts[key] -= 2;
      scan(counts, keyIdx, mentsu, taatsu, 1);
      counts[key] += 2;
    }

    if (canPartial) {
      // Pair as taatsu (toward a triplet)
      if (counts[key] >= 2) {
        counts[key] -= 2;
        scan(counts, keyIdx, mentsu, taatsu + 1, jantai);
        counts[key] += 2;
      }

      // Adjacent partial sequence (e.g. 45 waiting on 3 or 6)
      if (numbered && val <= 8) {
        var kAdj = suit + (val + 1);
        if ((counts[kAdj] || 0) > 0) {
          counts[key]--;
          counts[kAdj]--;
          scan(counts, keyIdx, mentsu, taatsu + 1, jantai);
          counts[key]++;
          counts[kAdj]++;
        }
      }

      // Skip-one partial sequence / kanchan (e.g. 46 waiting on 5)
      if (numbered && val <= 7) {
        var kSkip = suit + (val + 2);
        if ((counts[kSkip] || 0) > 0) {
          counts[key]--;
          counts[kSkip]--;
          scan(counts, keyIdx, mentsu, taatsu + 1, jantai);
          counts[key]++;
          counts[kSkip]++;
        }
      }
    }

    // --- Skip all copies of this tile (isolated / leftover) ---
    var saved = counts[key];
    counts[key] = 0;
    scan(counts, keyIdx + 1, mentsu, taatsu, jantai);
    counts[key] = saved;
  }

  function shantenStandard(counts) {
    _best = 8;
    scan(counts, 0, 0, 0, 0);
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
