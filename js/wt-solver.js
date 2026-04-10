/* Waits Trainer — Wait Solver
 *
 * Given a 13-tile one-suit hand, determines which tile values (1–9)
 * complete the hand (i.e. make a valid 14-tile winning hand).
 *
 * Checks standard form (4 sets + 1 pair) and chiitoitsu (7 pairs).
 * Input is an array of integer values; all tiles are assumed the same suit.
 */
(function (WT) {
  'use strict';

  // ----- Counts-based backtracking decomposer ------------------------------
  //
  // counts: object { 1: n, 2: n, … } (mutated in-place, restored on backtrack)
  // pairUsed: whether the one allowed pair has already been placed
  // v: smallest value still to consume (avoids re-scanning from 1 each time)
  //
  // Returns true iff the remaining tiles can form complete sets (and the pair
  // has been placed exactly once by the time tiles run out).

  function tryDecompose(counts, pairUsed, v) {
    // Advance past exhausted values
    while (v <= 9 && !(counts[v] > 0)) v++;
    if (v > 9) return pairUsed; // all tiles consumed; valid only if pair was placed

    // Option 1: use v as the pair (only once)
    if (!pairUsed && counts[v] >= 2) {
      counts[v] -= 2;
      if (tryDecompose(counts, true, v)) { counts[v] += 2; return true; }
      counts[v] += 2;
    }

    // Option 2: use v as a triplet
    if (counts[v] >= 3) {
      counts[v] -= 3;
      if (tryDecompose(counts, pairUsed, v)) { counts[v] += 3; return true; }
      counts[v] += 3;
    }

    // Option 3: use v as the start of a sequence v, v+1, v+2
    if (counts[v] >= 1 && (counts[v + 1] || 0) >= 1 && (counts[v + 2] || 0) >= 1) {
      counts[v]--;
      counts[v + 1]--;
      counts[v + 2]--;
      if (tryDecompose(counts, pairUsed, v)) {
        counts[v]++;
        counts[v + 1]++;
        counts[v + 2]++;
        return true;
      }
      counts[v]++;
      counts[v + 1]++;
      counts[v + 2]++;
    }

    // v cannot be consumed → this branch fails
    return false;
  }

  // ----- Chiitoitsu check --------------------------------------------------
  // 7 distinct pairs (standard WRC rule: all 7 pairs must be different tiles)

  function canWinChiitoitsu(counts) {
    var pairs = 0;
    for (var v = 1; v <= 9; v++) {
      if ((counts[v] || 0) >= 2) pairs++;
    }
    return pairs === 7;
  }

  // ----- Public API --------------------------------------------------------

  // solveWaits(tileValues)
  //   tileValues: array of 13 integers (1–9), all same suit
  //   returns: sorted array of integer values (1–9) that complete the hand

  function solveWaits(tileValues) {
    // Build base counts from the 13-tile hand
    var base = {};
    for (var i = 0; i < tileValues.length; i++) {
      var v = tileValues[i];
      base[v] = (base[v] || 0) + 1;
    }

    var results = [];
    for (var candidate = 1; candidate <= 9; candidate++) {
      // Clone counts and add the candidate tile
      var counts = {};
      for (var k = 1; k <= 9; k++) counts[k] = base[k] || 0;
      counts[candidate]++;

      // Check standard form
      if (tryDecompose(counts, false, 1)) {
        results.push(candidate);
        continue;
      }

      // Re-clone for chiitoitsu check (tryDecompose may have left counts dirty
      // if it exited early via the "return true" path, but we need clean counts)
      var counts2 = {};
      for (var k2 = 1; k2 <= 9; k2++) counts2[k2] = base[k2] || 0;
      counts2[candidate]++;
      if (canWinChiitoitsu(counts2)) {
        results.push(candidate);
      }
    }

    return results;
  }

  // ----- Exports -----------------------------------------------------------

  WT.solveWaits = solveWaits;

})(window.WaitTrainer || (window.WaitTrainer = {}));
