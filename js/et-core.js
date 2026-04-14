/* Efficiency Trainer — Core Logic
 *
 * Hand generation (random 14-tile draw from a full deck), ukeire
 * calculation, discard evaluation, and game-state management.
 *
 * Depends on: st-core.js, et-shanten.js
 */
(function (ET) {
  'use strict';

  var ST = window.ScoreTrainer;

  // ---- Deck builder -------------------------------------------------------

  /** Build a shuffled 136-tile deck of tile objects (no red fives). */
  function buildShuffledDeck() {
    var deck = [];
    var suits = ['m', 'p', 's'];
    for (var si = 0; si < suits.length; si++) {
      for (var v = 1; v <= 9; v++) {
        for (var c = 0; c < 4; c++) deck.push(ST.tile(suits[si], v, false));
      }
    }
    for (var h = 1; h <= 7; h++) {
      for (var c2 = 0; c2 < 4; c2++) deck.push(ST.tile('z', h, false));
    }
    ST.shuffleInPlace(deck);
    return deck;
  }

  // ---- Hand generation ----------------------------------------------------

  /**
   * generateHand()
   * Returns { hand: tile[13], drawnTile: tile, bank: {}, remainingDeck: tile[] }
   * Guarantees the 14-tile hand is NOT complete (shanten != -1).
   *
   * Simulates a realistic 4-player game (user is always dealer/East):
   *   136 tiles → 14 to dealer (user), 13 each to 3 opponents, 14 to dead wall.
   *   The live wall (~69 tiles) is what remains for drawing.
   *   Bank (for ukeire) includes ALL 122 non-user tiles, since the player
   *   cannot see opponents' hands or the dead wall.
   */
  function generateHand() {
    for (var attempt = 0; attempt < 200; attempt++) {
      var deck = buildShuffledDeck();
      var hand14 = deck.slice(0, 14);
      var allRemaining = deck.slice(14);

      // Check not a complete hand
      if (ET.calculateShanten(hand14) <= -1) continue;

      // Bank counts ALL non-user tiles (opponents + dead wall + live wall)
      // because the player can't see any of them
      var bank = {};
      for (var i = 0; i < allRemaining.length; i++) {
        var k = allRemaining[i].suit + allRemaining[i].value;
        bank[k] = (bank[k] || 0) + 1;
      }

      // Deal 13 tiles each to 3 opponents, then 14 for dead wall
      var opponentHands = [
        allRemaining.slice(0, 13),
        allRemaining.slice(13, 26),
        allRemaining.slice(26, 39)
      ];
      var liveWall = allRemaining.slice(39 + 14);

      // Split into sorted 13-tile hand + drawn tile
      var sorted = hand14.slice(0, 13).sort(ST.compareTiles);
      var drawn = hand14[13];

      return {
        hand: sorted,
        drawnTile: drawn,
        bank: bank,
        remainingDeck: liveWall,
        opponentHands: opponentHands
      };
    }
    throw new Error('generateHand: could not produce a non-complete hand after 200 attempts');
  }

  // ---- Ukeire calculation -------------------------------------------------

  /**
   * calculateUkeire(hand13, bank)
   *   hand13: array of 13 tile objects (after a hypothetical discard)
   *   bank: tile count object (tiles remaining in wall, NOT in hand)
   *   returns: { ukeire: number, shanten: number }
   */
  function calculateUkeire(hand13, bank) {
    // Build counts for the 13-tile hand
    var handCounts = ET.tilesToCounts(hand13);
    var currentShanten = ET.calculateShantenFromCounts(handCounts);

    var ukeire = 0;

    for (var ki = 0; ki < ET.KEYS.length; ki++) {
      var key = ET.KEYS[ki];
      var bankN = bank[key] || 0;
      if (bankN === 0) continue;

      // Temporarily add one of this tile to hand
      handCounts[key] = (handCounts[key] || 0) + 1;
      var newShanten = ET.calculateShantenFromCounts(handCounts);
      handCounts[key]--;
      if (handCounts[key] === 0) delete handCounts[key];

      if (newShanten < currentShanten) {
        ukeire += bankN;
      }
    }

    return { ukeire: ukeire, shanten: currentShanten };
  }

  // ---- Discard evaluation -------------------------------------------------

  /**
   * evaluateDiscards(hand13, drawnTile, bank)
   *   Computes ukeire for every unique discard among the 14 tiles.
   *   Returns array of { key, tile, ukeire, shanten } sorted by ukeire descending.
   *   Also returns a lookup map keyed by tile key for fast access.
   */
  function evaluateDiscards(hand13, drawnTile, bank) {
    var all14 = hand13.concat([drawnTile]);
    var results = [];
    var seen = {};

    for (var i = 0; i < all14.length; i++) {
      var t = all14[i];
      var key = t.suit + t.value;
      if (seen[key]) continue;
      seen[key] = true;

      // Build the 13-tile hand without this tile
      var remaining13 = [];
      var removed = false;
      for (var j = 0; j < all14.length; j++) {
        if (!removed && all14[j].suit === t.suit && all14[j].value === t.value) {
          removed = true;
          continue;
        }
        remaining13.push(all14[j]);
      }

      var result = calculateUkeire(remaining13, bank);
      results.push({
        key: key,
        tile: t,
        ukeire: result.ukeire,
        shanten: result.shanten
      });
    }

    // Sort: lowest shanten first, then highest ukeire among ties.
    // A discard that keeps shanten low is always better than one that raises it,
    // regardless of ukeire (ukeire only compares within the same shanten level).
    results.sort(function (a, b) {
      if (a.shanten !== b.shanten) return a.shanten - b.shanten;
      return b.ukeire - a.ukeire;
    });

    // Build lookup map
    var lookup = {};
    for (var r = 0; r < results.length; r++) {
      lookup[results[r].key] = results[r];
    }

    return { ranked: results, lookup: lookup };
  }

  /**
   * classifyDiscard(chosenKey, evaluation)
   *   Given the user's chosen discard key and the evaluation results,
   *   returns { color: 'green'|'yellow'|'red', rank: number,
   *             bestTile, bestUkeire, chosenUkeire }
   */
  function classifyDiscard(chosenKey, evaluation) {
    var ranked = evaluation.ranked;
    var chosen = evaluation.lookup[chosenKey];
    var bestShanten = ranked[0].shanten;
    var bestUkeire = ranked[0].ukeire;
    var chosenShanten = chosen.shanten;
    var chosenUkeire = chosen.ukeire;

    // Two discards are equivalent if they give the same shanten AND same ukeire.
    // A discard is strictly better if it gives lower shanten, or same shanten
    // with higher ukeire.
    function isSame(a, b) {
      return a.shanten === b.shanten && a.ukeire === b.ukeire;
    }
    // Find rank (1-based): count how many distinct (shanten, ukeire) tiers
    // are strictly better than the chosen discard
    var rank = 1;
    var prev = null;
    for (var j = 0; j < ranked.length; j++) {
      if (isSame(ranked[j], chosen)) break;
      if (!prev || !isSame(ranked[j], prev)) {
        rank++;
        prev = ranked[j];
      }
    }

    var color;
    if (rank === 1) {
      color = 'green';
    } else if (rank <= 3) {
      color = 'yellow';
    } else {
      color = 'red';
    }

    // Collect other tiles tied at best (same shanten + same ukeire, excluding chosen)
    var tiedTiles = [];
    if (rank === 1) {
      for (var t = 0; t < ranked.length; t++) {
        if (!isSame(ranked[t], chosen)) break;
        if (ranked[t].key !== chosenKey) tiedTiles.push(ranked[t].tile);
      }
    }

    // Ukeire loss: only meaningful when shanten is the same as best;
    // if chosen raises shanten, report the best ukeire at best shanten as the gap
    var ukeireLoss = (chosenShanten === bestShanten)
      ? bestUkeire - chosenUkeire
      : bestUkeire;

    return {
      color: color,
      rank: rank,
      bestTile: ranked[0].tile,
      bestUkeire: bestUkeire,
      chosenUkeire: chosenUkeire,
      ukeireLoss: ukeireLoss,
      tiedTiles: tiedTiles
    };
  }

  // ---- Exports ------------------------------------------------------------

  ET.generateHand = generateHand;
  ET.calculateUkeire = calculateUkeire;
  ET.evaluateDiscards = evaluateDiscards;
  ET.classifyDiscard = classifyDiscard;

})(window.EfficiencyTrainer || (window.EfficiencyTrainer = {}));
