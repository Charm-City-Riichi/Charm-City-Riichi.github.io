/* Waits Trainer — Hand Generator
 *
 * Generates a closed 13-tile chinitsu (one-suit) tenpai hand and returns
 * the hand along with all winning tile values computed by wt-solver.js.
 *
 * Depends on: st-core.js, st-waits.js, st-builder.js, wt-solver.js
 */
(function (WT) {
  'use strict';

  var ST = window.ScoreTrainer;

  // generateWaitsHand()
  //   Returns { suit, tiles[13], waits[] }
  //     suit:  'm' | 'p' | 's'
  //     tiles: array of 13 tile objects (all same suit, sorted ascending)
  //     waits: sorted array of integer values (1–9) that complete the hand

  function generateWaitsHand() {
    var lastErr = null;
    for (var attempt = 0; attempt < 50; attempt++) {
      try {
        var bank = ST.makeTileBank();
        var ctx = { roundWind: ST.pickRoundWind(), seatWind: ST.pickSeatWind() };

        // buildChinitsu(bank, ctx, closed=true) → finishHand → unwinTile
        // Result: { closedTiles[13], winningTile, riichi, winType, handShape }
        var result = ST.buildChinitsu(bank, ctx, true);
        var tiles = result.closedTiles;

        if (tiles.length !== 13) continue;

        // All tiles should be the same suit (chinitsu guarantee)
        var suit = tiles[0].suit;

        // Extract values and solve for all waits
        var vals = [];
        for (var i = 0; i < tiles.length; i++) vals.push(tiles[i].value);
        var waits = WT.solveWaits(vals);

        if (waits.length === 0) continue; // shouldn't happen, but retry to be safe

        // Phantom waits: mathematically valid but all 4 copies already in the hand
        var handCounts = {};
        for (var ci = 0; ci < vals.length; ci++) {
          handCounts[vals[ci]] = (handCounts[vals[ci]] || 0) + 1;
        }
        var phantomWaits = {};
        for (var wi = 0; wi < waits.length; wi++) {
          if ((handCounts[waits[wi]] || 0) >= 4) phantomWaits[waits[wi]] = true;
        }

        // Sort tiles ascending by value for display
        var sorted = tiles.slice().sort(function (a, b) { return a.value - b.value; });

        return { suit: suit, tiles: sorted, waits: waits, phantomWaits: phantomWaits };
      } catch (e) {
        lastErr = e;
        if (!(e instanceof ST.BankError) && e.name !== 'BankError') throw e;
      }
    }
    throw new Error('generateWaitsHand: gave up after 50 attempts. Last error: ' + (lastErr && lastErr.message));
  }

  // ----- Exports -----------------------------------------------------------

  WT.generateWaitsHand = generateWaitsHand;

})(window.WaitTrainer || (window.WaitTrainer = {}));
