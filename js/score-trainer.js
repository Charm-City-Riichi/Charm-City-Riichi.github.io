/* Score Trainer
 *
 * Framework for a riichi mahjong scoring practice page. Procedurally
 * generates a winning hand situation and renders it for the user to score
 * by hand.
 *
 * Notation: digits + suit letter, e.g. "123s456p455556m11z".
 *   m = man (characters), p = pin (dots), s = sou (bamboo), z = honors
 *   honors: 1=East 2=South 3=West 4=North 5=White 6=Green 7=Red
 *   0 in m/p/s = red five (akadora)
 *
 * Generator pieces:
 *   1.  Wait shape catalog + selector (done)
 *   2a. Plain concealed riichi hands (done — current generator)
 *   2b. Open hands, kans, archetype biases (TODO)
 *   3.  Yaku checker (TODO)
 *   4.  Calibration loop against yaku frequency targets (TODO)
 */
(function () {
  'use strict';

  // ----- Tile model -----------------------------------------------------
  // Tile = { suit: 'm'|'p'|'s'|'z', value: 1-9 (1-7 for z), red: bool }

  var SUIT_ORDER = ['m', 'p', 's', 'z'];

  function tile(suit, value, red) {
    return { suit: suit, value: value, red: !!red };
  }

  function tileChar(t) { return t.red ? '0' : String(t.value); }

  function compareTiles(a, b) {
    var sa = SUIT_ORDER.indexOf(a.suit);
    var sb = SUIT_ORDER.indexOf(b.suit);
    if (sa !== sb) return sa - sb;
    if (a.value !== b.value) return a.value - b.value;
    // Red 5 sorts before normal 5 so the akadora is visually distinct.
    if (a.red !== b.red) return a.red ? -1 : 1;
    return 0;
  }

  // ----- Notation parser ------------------------------------------------
  // "123s456p455556m11z" -> [tile, tile, ...]
  function parseNotation(text) {
    var tiles = [];
    var pending = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch >= '0' && ch <= '9') {
        pending.push(ch);
        continue;
      }
      if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
        if (!pending.length) {
          throw new Error('Suit letter "' + ch + '" with no preceding digits');
        }
        for (var j = 0; j < pending.length; j++) {
          var d = pending[j];
          var red = false;
          var v;
          if (d === '0') {
            if (ch === 'z') throw new Error('0 (red five) is not valid in honors');
            red = true;
            v = 5;
          } else {
            v = d.charCodeAt(0) - 48;
            if (ch === 'z' && (v < 1 || v > 7)) {
              throw new Error('Honors must be 1-7');
            }
          }
          tiles.push(tile(ch, v, red));
        }
        pending = [];
        continue;
      }
      if (/\s/.test(ch)) continue;
      throw new Error('Unexpected character in notation: "' + ch + '"');
    }
    if (pending.length) {
      throw new Error('Notation ended with digits but no suit letter');
    }
    return tiles;
  }

  // ----- Notation serializer --------------------------------------------
  function tilesToNotation(tiles) {
    if (!tiles.length) return '';
    var sorted = tiles.slice().sort(compareTiles);
    var out = '';
    var bufSuit = sorted[0].suit;
    var buf = '';
    for (var i = 0; i < sorted.length; i++) {
      var t = sorted[i];
      if (t.suit !== bufSuit) {
        out += buf + bufSuit;
        buf = '';
        bufSuit = t.suit;
      }
      buf += tileChar(t);
    }
    out += buf + bufSuit;
    return out;
  }

  // ----- Wind / honors helpers ------------------------------------------
  var WIND_NAMES = { E: 'East', S: 'South', W: 'West', N: 'North' };
  function windName(letter) { return WIND_NAMES[letter] || letter; }

  // ----- Wait shape catalog ---------------------------------------------
  //
  // Each row is a single wait pattern with a weight derived from the Path
  // of Houou wait-winrate dataset (sample size × win rate, giving the
  // natural count of *winning hands* with that shape — see
  // https://pathofhouou.blogspot.com/search/label/Houou%20Replay%20Analysis ).
  //
  // Categories not in the PDF (plain kanchan, penchan, non-honor shanpon,
  // nobetan) use interpolated weights based on rough proportions of all
  // winning hands: kanchan ~10%, penchan ~2.4%, non-honor shanpon ~4.9%,
  // nobetan ~1.6%. These can be tuned later.
  //
  // Each row describes only the *wait portion* of a hand (the partial set
  // that completes on the winning tile, plus any pair seed it implies).
  // Filling in the remaining sets, choice of suit, and any honor tiles is
  // done by the archetype builder in piece 2.
  //
  // Field summary:
  //   category   - display category name
  //   label      - position label as it appears in the dataset
  //   weight     - relative selection weight
  //   suitKind   - 'numbered' (m/p/s) | 'honor' (z) | 'mixed' (numbered + honor)
  //   held       - tile values held by the player for this shape (numbered)
  //   waits      - tile values that complete the wait (numbered)
  //   pairValue  - for honor-shanpon: the numbered pair value (or null)
  //
  // Plain shanpon is left fully abstract — the instantiator picks both pairs.
  var WAIT_SHAPES = [
    // Ryanmen ----------------------------------------------------------------
    { category: 'ryanmen', label: '14', held: [2,3], waits: [1,4], suitKind: 'numbered', weight: 379889 },
    { category: 'ryanmen', label: '25', held: [3,4], waits: [2,5], suitKind: 'numbered', weight: 401454 },
    { category: 'ryanmen', label: '36', held: [4,5], waits: [3,6], suitKind: 'numbered', weight: 424295 },
    { category: 'ryanmen', label: '47', held: [5,6], waits: [4,7], suitKind: 'numbered', weight: 422734 },
    { category: 'ryanmen', label: '58', held: [6,7], waits: [5,8], suitKind: 'numbered', weight: 402735 },
    { category: 'ryanmen', label: '69', held: [7,8], waits: [6,9], suitKind: 'numbered', weight: 383238 },

    // Sanmenchan -------------------------------------------------------------
    { category: 'sanmenchan', label: '147', held: [2,3,4,5,6], waits: [1,4,7], suitKind: 'numbered', weight: 99578 },
    { category: 'sanmenchan', label: '258', held: [3,4,5,6,7], waits: [2,5,8], suitKind: 'numbered', weight: 98861 },
    { category: 'sanmenchan', label: '369', held: [4,5,6,7,8], waits: [3,6,9], suitKind: 'numbered', weight: 99764 },

    // Tanki — single-tile wait, becomes the pair when completed --------------
    { category: 'tanki', label: '1', held: [1], waits: [1], suitKind: 'numbered', weight: 20465 },
    { category: 'tanki', label: '2', held: [2], waits: [2], suitKind: 'numbered', weight: 113689 },
    { category: 'tanki', label: '3', held: [3], waits: [3], suitKind: 'numbered', weight: 188283 },
    { category: 'tanki', label: '4', held: [4], waits: [4], suitKind: 'numbered', weight: 70257 },
    { category: 'tanki', label: '5', held: [5], waits: [5], suitKind: 'numbered', weight: 60211 },
    { category: 'tanki', label: '6', held: [6], waits: [6], suitKind: 'numbered', weight: 70136 },
    { category: 'tanki', label: '7', held: [7], waits: [7], suitKind: 'numbered', weight: 189700 },
    { category: 'tanki', label: '8', held: [8], waits: [8], suitKind: 'numbered', weight: 115778 },
    { category: 'tanki', label: '9', held: [9], waits: [9], suitKind: 'numbered', weight: 20457 },
    { category: 'tanki', label: 'Z', held: [],  waits: [],  suitKind: 'honor',    weight: 102922 },

    // Honor shanpon — numbered pair + honor pair, win on either --------------
    { category: 'honor-shanpon', label: '1+Z', pairValue: 1, suitKind: 'mixed', weight: 25337 },
    { category: 'honor-shanpon', label: '2+Z', pairValue: 2, suitKind: 'mixed', weight: 22918 },
    { category: 'honor-shanpon', label: '3+Z', pairValue: 3, suitKind: 'mixed', weight: 18839 },
    { category: 'honor-shanpon', label: '4+Z', pairValue: 4, suitKind: 'mixed', weight: 19060 },
    { category: 'honor-shanpon', label: '5+Z', pairValue: 5, suitKind: 'mixed', weight: 22225 },
    { category: 'honor-shanpon', label: '6+Z', pairValue: 6, suitKind: 'mixed', weight: 19326 },
    { category: 'honor-shanpon', label: '7+Z', pairValue: 7, suitKind: 'mixed', weight: 18845 },
    { category: 'honor-shanpon', label: '8+Z', pairValue: 8, suitKind: 'mixed', weight: 23025 },
    { category: 'honor-shanpon', label: '9+Z', pairValue: 9, suitKind: 'mixed', weight: 25923 },
    { category: 'honor-shanpon', label: 'Z+Z', pairValue: null, suitKind: 'honor', weight: 21701 },

    // Kanchan (interpolated; not a standalone row in the PDF) ----------------
    { category: 'kanchan', label: '13', held: [1,3], waits: [2], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '24', held: [2,4], waits: [3], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '35', held: [3,5], waits: [4], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '46', held: [4,6], waits: [5], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '57', held: [5,7], waits: [6], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '68', held: [6,8], waits: [7], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '79', held: [7,9], waits: [8], suitKind: 'numbered', weight: 67000 },

    // Penchan (interpolated) -------------------------------------------------
    { category: 'penchan', label: '12', held: [1,2], waits: [3], suitKind: 'numbered', weight: 57000 },
    { category: 'penchan', label: '89', held: [8,9], waits: [7], suitKind: 'numbered', weight: 57000 },

    // Shanpon, non-honor (interpolated; both pairs picked at instantiation) --
    { category: 'shanpon', label: 'free', suitKind: 'numbered', weight: 233000 },

    // Nobetan (interpolated) -------------------------------------------------
    { category: 'nobetan', label: '1234', held: [1,2,3,4], waits: [1,4], suitKind: 'numbered', weight: 13000 },
    { category: 'nobetan', label: '2345', held: [2,3,4,5], waits: [2,5], suitKind: 'numbered', weight: 13000 },
    { category: 'nobetan', label: '3456', held: [3,4,5,6], waits: [3,6], suitKind: 'numbered', weight: 13000 },
    { category: 'nobetan', label: '4567', held: [4,5,6,7], waits: [4,7], suitKind: 'numbered', weight: 13000 },
    { category: 'nobetan', label: '5678', held: [5,6,7,8], waits: [5,8], suitKind: 'numbered', weight: 13000 },
    { category: 'nobetan', label: '6789', held: [6,7,8,9], waits: [6,9], suitKind: 'numbered', weight: 13000 },
  ];

  var WAIT_CATEGORY_NAMES = {
    'ryanmen':       'Ryanmen (two-sided)',
    'sanmenchan':    'Sanmenchan (three-sided)',
    'tanki':         'Tanki (single wait)',
    'honor-shanpon': 'Shanpon (number + honor)',
    'kanchan':       'Kanchan (closed)',
    'penchan':       'Penchan (edge)',
    'shanpon':       'Shanpon',
    'nobetan':       'Nobetan',
  };

  function pickWeighted(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].weight;
    var r = Math.random() * total;
    var acc = 0;
    for (var j = 0; j < items.length; j++) {
      acc += items[j].weight;
      if (r < acc) return items[j];
    }
    return items[items.length - 1];
  }

  function pickWaitShape() { return pickWeighted(WAIT_SHAPES); }

  function formatWaitShape(shape) {
    if (!shape) return '';
    var name = WAIT_CATEGORY_NAMES[shape.category] || shape.category;
    return name + ' \u2014 ' + shape.label;
  }

  // Console-only sanity check. Run as ScoreTrainer.testWaitShapeDistribution()
  // to verify the rolled distribution matches the catalog weights.
  function testWaitShapeDistribution(n) {
    n = n || 10000;
    var counts = {};
    for (var i = 0; i < n; i++) {
      var s = pickWaitShape();
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var lines = ['n=' + n];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      lines.push('  ' + key + ': ' + (counts[key] / n * 100).toFixed(1) + '% (' + counts[key] + ')');
    }
    return lines.join('\n');
  }

  // ----- Hand situation model -------------------------------------------
  // {
  //   handShape:  'standard' | 'chiitoitsu' | 'kokushi',
  //   roundWind:  'E'|'S'|'W'|'N',
  //   seatWind:   'E'|'S'|'W'|'N',
  //   honba:      int,
  //   closedTiles:    [tile],   // tiles in hand, NOT including called melds or winning tile
  //   calls:          [Call],   // always empty for chiitoitsu / kokushi
  //   winningTile:    tile,     // the tile that completed the hand
  //   winType:        'tsumo' | 'ron',
  //   riichi:         bool,
  //   doraIndicators: [tile],
  //   uraIndicators:  [tile],   // empty unless riichi was declared
  // }
  //
  // Call = {
  //   type:  'chi' | 'pon' | 'kan' | 'ankan',  // ankan = concealed kan
  //   tiles: [tile],                            // 3 tiles, or 4 for kan/ankan
  // }
  //
  // Notes:
  //  - Open vs closed is fully encoded by `type` (ankan is the only closed call).
  //  - The direction a tile was called from (left/across/right) only affects
  //    visual meld rotation, not fu — so we don't track it.
  //  - For ron wins, the triplet completed by the winning tile is counted as
  //    open (minkou) for fu. That's a win-time derivation from `winningTile`
  //    and the hand shape, not a property of `calls`.

  function makeSituation(opts) {
    return {
      handShape:      opts.handShape || 'standard',
      roundWind:      opts.roundWind,
      seatWind:       opts.seatWind,
      honba:          opts.honba || 0,
      closedTiles:    opts.closedTiles || [],
      calls:          opts.calls || [],
      winningTile:    opts.winningTile,
      winType:        opts.winType,
      riichi:         !!opts.riichi,
      doraIndicators: opts.doraIndicators || [],
      uraIndicators:  opts.riichi ? (opts.uraIndicators || []) : [],
      waitShape:      opts.waitShape || null,
    };
  }

  // ----- Validation -----------------------------------------------------
  // Sanity checks that a generated situation is physically possible:
  //   1. Tile count matches the expected hand shape (incl. kans).
  //   2. Dora/ura indicator counts match the kan count and riichi state.
  //   3. No tile (suit+value) appears more than 4 times across the entire
  //      situation: closed hand + calls + winning tile + dora indicators
  //      + ura indicators. The dora and ura indicators are physical tiles
  //      drawn from the dead wall, so they share the 4-of-each pool.
  //   4. At most one red 5 per numbered suit (standard ruleset).
  function validateSituation(s) {
    // -- Tile-count expectations --
    if (s.handShape === 'chiitoitsu' || s.handShape === 'kokushi') {
      if (s.calls.length !== 0) {
        throw new Error(s.handShape + ' cannot have any calls (must be concealed)');
      }
      var totalCK = s.closedTiles.length + 1; // +1 for winning tile
      if (totalCK !== 14) {
        throw new Error(s.handShape + ' hand has ' + totalCK + ' tiles, expected 14');
      }
    } else {
      var calledTiles = 0;
      var kansStd = 0;
      for (var i = 0; i < s.calls.length; i++) {
        calledTiles += s.calls[i].tiles.length;
        if (s.calls[i].type === 'kan' || s.calls[i].type === 'ankan') kansStd++;
      }
      var standardTotal = s.closedTiles.length + calledTiles + 1; // +1 for winning tile
      var expectedStd = 14 + kansStd;
      if (standardTotal !== expectedStd) {
        throw new Error('Hand has ' + standardTotal + ' tiles, expected ' + expectedStd);
      }
    }

    // -- Dora / ura indicator count vs. kan count --
    var totalKans = 0;
    for (var c = 0; c < s.calls.length; c++) {
      if (s.calls[c].type === 'kan' || s.calls[c].type === 'ankan') totalKans++;
    }
    var expectedIndicators = 1 + totalKans;
    if (s.doraIndicators.length !== expectedIndicators) {
      throw new Error('Expected ' + expectedIndicators + ' dora indicators, got ' + s.doraIndicators.length);
    }
    if (s.riichi) {
      if (s.uraIndicators.length !== expectedIndicators) {
        throw new Error('Expected ' + expectedIndicators + ' ura indicators (riichi), got ' + s.uraIndicators.length);
      }
    } else if (s.uraIndicators.length !== 0) {
      throw new Error('Ura indicators present but riichi not declared');
    }

    // -- Tile multiplicity check (the "no five 5m's" rule) --
    var counts = {};      // key: suit + value
    var redCounts = {};   // key: suit (m/p/s) — at most 1 red 5 per suit
    function bump(t, where) {
      if (!t) throw new Error('Missing tile in ' + where);
      var key = t.suit + t.value;
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] > 4) {
        throw new Error('More than 4 of ' + key + ' across the situation (last seen in ' + where + ')');
      }
      if (t.red) {
        if (t.suit === 'z') throw new Error('Honor tile cannot be red');
        if (t.value !== 5) throw new Error('Only 5s can be red');
        redCounts[t.suit] = (redCounts[t.suit] || 0) + 1;
        if (redCounts[t.suit] > 1) {
          throw new Error('More than 1 red 5 in suit ' + t.suit);
        }
      }
    }
    for (var ci = 0; ci < s.closedTiles.length; ci++) bump(s.closedTiles[ci], 'closed hand');
    for (var mi = 0; mi < s.calls.length; mi++) {
      var meld = s.calls[mi];
      for (var ti = 0; ti < meld.tiles.length; ti++) bump(meld.tiles[ti], 'call');
    }
    bump(s.winningTile, 'winning tile');
    for (var di = 0; di < s.doraIndicators.length; di++) bump(s.doraIndicators[di], 'dora indicators');
    for (var ui = 0; ui < s.uraIndicators.length; ui++) bump(s.uraIndicators[ui], 'ura indicators');

    return true;
  }

  // ----- Placeholder hand source ----------------------------------------
  // Single known-valid hand kept around as a fallback in case the procedural
  // generator throws repeatedly. Should never be reached in normal operation.
  var PLACEHOLDER_HANDS = [
    {
      // Pinfu + riichi + tsumo, dealer, with 1 dora.
      // Closed waiting on 2m/5m (ryanmen). Wins on 2m tsumo.
      roundWind: 'E',
      seatWind:  'E',
      honba: 0,
      closedNotation: '34m456m789m123p55p',
      calls: [],
      winningTile: { suit: 'm', value: 2, red: false },
      winType: 'tsumo',
      riichi: true,
      doraIndicators: [{ suit: 'p', value: 9, red: false }],
      uraIndicators:  [{ suit: 's', value: 3, red: false }],
    },
  ];

  function generatePlaceholderHand() {
    var src = PLACEHOLDER_HANDS[Math.floor(Math.random() * PLACEHOLDER_HANDS.length)];
    var s = makeSituation({
      roundWind: src.roundWind,
      seatWind:  src.seatWind,
      honba:     src.honba,
      handShape:      src.handShape || 'standard',
      closedTiles:    parseNotation(src.closedNotation),
      calls:          src.calls.map(function (c) {
        return { type: c.type, tiles: parseNotation(c.notation) };
      }),
      winningTile:    tile(src.winningTile.suit, src.winningTile.value, src.winningTile.red),
      winType:        src.winType,
      riichi:         src.riichi,
      doraIndicators: src.doraIndicators.map(function (t) { return tile(t.suit, t.value, t.red); }),
      uraIndicators:  src.uraIndicators.map(function (t) { return tile(t.suit, t.value, t.red); }),
      waitShape:      pickWaitShape(),
    });
    validateSituation(s);
    return s;
  }

  // ----- Procedural generator (Piece 2a) --------------------------------
  //
  // 2a builds plain concealed riichi hands. No calls, no kans, no archetype
  // biases. Goal: correctness — every hand respects the 4-of-each-tile rule
  // by construction (we draw from a finite tile bank).
  //
  // Pieces 2b/3/4 will add open hands, kans, archetype biases, a yaku
  // checker, and calibration against yaku frequency targets.

  var SUITS_NUMBERED = ['m', 'p', 's'];

  function BankError(msg) { this.message = msg; this.name = 'BankError'; }
  BankError.prototype = Object.create(Error.prototype);
  BankError.prototype.constructor = BankError;

  function makeTileBank() {
    // counts[suit + value] = number of physical tiles remaining.
    // Numbered: m1..m9, p1..p9, s1..s9 = 4 each. Honors: z1..z7 = 4 each.
    var bank = {};
    for (var si = 0; si < SUITS_NUMBERED.length; si++) {
      for (var v = 1; v <= 9; v++) bank[SUITS_NUMBERED[si] + v] = 4;
    }
    for (var hv = 1; hv <= 7; hv++) bank['z' + hv] = 4;
    return bank;
  }

  function bankCount(bank, suit, value) {
    return bank[suit + value] || 0;
  }

  function bankTake(bank, suit, value, n) {
    var key = suit + value;
    if ((bank[key] || 0) < n) {
      throw new BankError('Not enough ' + key + ' (need ' + n + ', have ' + (bank[key] || 0) + ')');
    }
    bank[key] -= n;
  }

  function bankReturn(bank, suit, value, n) {
    bank[suit + value] = (bank[suit + value] || 0) + n;
  }

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Take a sequence-completing wait shape (ryanmen / sanmenchan / kanchan /
  // penchan) in `suit`. Mutates bank, rolls back on failure.
  function takeSequenceWait(bank, shape, suit) {
    var taken = [];
    try {
      for (var i = 0; i < shape.held.length; i++) {
        bankTake(bank, suit, shape.held[i], 1);
        taken.push(shape.held[i]);
      }
      var winShuffled = shape.waits.slice();
      shuffleInPlace(winShuffled);
      for (var w = 0; w < winShuffled.length; w++) {
        if (bankCount(bank, suit, winShuffled[w]) > 0) {
          bankTake(bank, suit, winShuffled[w], 1);
          var placed = [];
          for (var p = 0; p < shape.held.length; p++) {
            placed.push(tile(suit, shape.held[p], false));
          }
          return { placedTiles: placed, winningTile: tile(suit, winShuffled[w], false) };
        }
      }
      throw new BankError('No winning tile available for ' + shape.label + ' in ' + suit);
    } catch (e) {
      if (e instanceof BankError) {
        for (var rb = 0; rb < taken.length; rb++) {
          bankReturn(bank, suit, taken[rb], 1);
        }
      }
      throw e;
    }
  }

  // Returns { placedTiles, winningTile, setsRemaining, needsPair }.
  // Mutates bank.
  function instantiateWaitShape(shape, bank) {
    var cat = shape.category;

    // Sequence-completing shapes: ryanmen, sanmenchan, kanchan, penchan
    if (cat === 'ryanmen' || cat === 'sanmenchan' || cat === 'kanchan' || cat === 'penchan') {
      var suits = shuffleInPlace(SUITS_NUMBERED.slice());
      var attempt = null;
      for (var s = 0; s < suits.length; s++) {
        try {
          attempt = takeSequenceWait(bank, shape, suits[s]);
          break;
        } catch (e) {
          if (!(e instanceof BankError)) throw e;
        }
      }
      if (!attempt) throw new BankError('No suit could host ' + shape.label);
      return {
        placedTiles: attempt.placedTiles,
        winningTile: attempt.winningTile,
        setsRemaining: cat === 'sanmenchan' ? 2 : 3,
        needsPair: true,
      };
    }

    // Nobetan: 4 consecutive tiles, win on a or d → makes sequence + pair
    if (cat === 'nobetan') {
      var nbSuits = shuffleInPlace(SUITS_NUMBERED.slice());
      for (var ns = 0; ns < nbSuits.length; ns++) {
        var nbSuit = nbSuits[ns];
        var nbTaken = [];
        try {
          for (var hi = 0; hi < shape.held.length; hi++) {
            bankTake(bank, nbSuit, shape.held[hi], 1);
            nbTaken.push(shape.held[hi]);
          }
          var nbWinOpts = shuffleInPlace(shape.waits.slice());
          var nbWinV = null;
          for (var wi = 0; wi < nbWinOpts.length; wi++) {
            if (bankCount(bank, nbSuit, nbWinOpts[wi]) > 0) {
              bankTake(bank, nbSuit, nbWinOpts[wi], 1);
              nbWinV = nbWinOpts[wi];
              break;
            }
          }
          if (nbWinV === null) throw new BankError('No nobetan winning tile in ' + nbSuit);
          var nbPlaced = [];
          for (var pi = 0; pi < shape.held.length; pi++) {
            nbPlaced.push(tile(nbSuit, shape.held[pi], false));
          }
          return {
            placedTiles: nbPlaced,
            winningTile: tile(nbSuit, nbWinV, false),
            setsRemaining: 3,
            needsPair: false,
          };
        } catch (e) {
          if (!(e instanceof BankError)) throw e;
          for (var rb2 = 0; rb2 < nbTaken.length; rb2++) {
            bankReturn(bank, nbSuit, nbTaken[rb2], 1);
          }
        }
      }
      throw new BankError('Could not place nobetan ' + shape.label);
    }

    // Tanki: single-tile wait, becomes the pair when the wait completes
    if (cat === 'tanki') {
      if (shape.suitKind === 'honor') {
        var honors = shuffleInPlace([1, 2, 3, 4, 5, 6, 7]);
        for (var hi2 = 0; hi2 < honors.length; hi2++) {
          if (bankCount(bank, 'z', honors[hi2]) >= 2) {
            bankTake(bank, 'z', honors[hi2], 2);
            return {
              placedTiles: [tile('z', honors[hi2], false)],
              winningTile: tile('z', honors[hi2], false),
              setsRemaining: 4,
              needsPair: false,
            };
          }
        }
        throw new BankError('No honor available for tanki Z');
      }
      var tv = shape.held[0];
      var tSuits = shuffleInPlace(SUITS_NUMBERED.slice());
      for (var ts = 0; ts < tSuits.length; ts++) {
        if (bankCount(bank, tSuits[ts], tv) >= 2) {
          bankTake(bank, tSuits[ts], tv, 2);
          return {
            placedTiles: [tile(tSuits[ts], tv, false)],
            winningTile: tile(tSuits[ts], tv, false),
            setsRemaining: 4,
            needsPair: false,
          };
        }
      }
      throw new BankError('No suit available for tanki ' + tv);
    }

    // Honor-shanpon: numbered pair + honor pair (Z+Z = two honor pairs)
    if (cat === 'honor-shanpon') {
      if (shape.pairValue === null) {
        // Z+Z: pick 2 distinct honors
        for (var zAtt = 0; zAtt < 30; zAtt++) {
          var zAvail = [];
          for (var zv = 1; zv <= 7; zv++) {
            if (bankCount(bank, 'z', zv) >= 2) zAvail.push(zv);
          }
          if (zAvail.length < 2) throw new BankError('Z+Z: fewer than 2 honors with pair count');
          shuffleInPlace(zAvail);
          var zh1 = zAvail[0], zh2 = zAvail[1];
          var zCanH1Win = bankCount(bank, 'z', zh1) >= 3;
          var zCanH2Win = bankCount(bank, 'z', zh2) >= 3;
          if (!zCanH1Win && !zCanH2Win) continue;
          var zWin;
          if (zCanH1Win && zCanH2Win) zWin = Math.random() < 0.5 ? zh1 : zh2;
          else if (zCanH1Win) zWin = zh1;
          else zWin = zh2;
          var zLose = zWin === zh1 ? zh2 : zh1;
          bankTake(bank, 'z', zWin, 3);
          bankTake(bank, 'z', zLose, 2);
          return {
            placedTiles: [
              tile('z', zWin, false), tile('z', zWin, false),
              tile('z', zLose, false), tile('z', zLose, false),
            ],
            winningTile: tile('z', zWin, false),
            setsRemaining: 3,
            needsPair: false,
          };
        }
        throw new BankError('Z+Z: gave up after attempts');
      }
      // Numbered pair (shape.pairValue) + honor pair
      var hsNumSuits = shuffleInPlace(SUITS_NUMBERED.slice());
      var hsNumSuit = null;
      for (var hsNs = 0; hsNs < hsNumSuits.length; hsNs++) {
        if (bankCount(bank, hsNumSuits[hsNs], shape.pairValue) >= 2) {
          hsNumSuit = hsNumSuits[hsNs];
          break;
        }
      }
      if (hsNumSuit === null) {
        throw new BankError('Honor-shanpon: no numbered suit for pair ' + shape.pairValue);
      }
      var hsHonors = shuffleInPlace([1, 2, 3, 4, 5, 6, 7]);
      var hsHonorVal = null;
      for (var hsHi = 0; hsHi < hsHonors.length; hsHi++) {
        if (bankCount(bank, 'z', hsHonors[hsHi]) >= 2) {
          hsHonorVal = hsHonors[hsHi];
          break;
        }
      }
      if (hsHonorVal === null) throw new BankError('Honor-shanpon: no honor pair available');
      var hsCanNumWin = bankCount(bank, hsNumSuit, shape.pairValue) >= 3;
      var hsCanHonWin = bankCount(bank, 'z', hsHonorVal) >= 3;
      var hsNumWins;
      if (hsCanNumWin && hsCanHonWin) hsNumWins = Math.random() < 0.5;
      else if (hsCanNumWin) hsNumWins = true;
      else if (hsCanHonWin) hsNumWins = false;
      else throw new BankError('Honor-shanpon: neither side can complete');
      if (hsNumWins) {
        bankTake(bank, hsNumSuit, shape.pairValue, 3);
        bankTake(bank, 'z', hsHonorVal, 2);
        return {
          placedTiles: [
            tile(hsNumSuit, shape.pairValue, false), tile(hsNumSuit, shape.pairValue, false),
            tile('z', hsHonorVal, false), tile('z', hsHonorVal, false),
          ],
          winningTile: tile(hsNumSuit, shape.pairValue, false),
          setsRemaining: 3,
          needsPair: false,
        };
      }
      bankTake(bank, hsNumSuit, shape.pairValue, 2);
      bankTake(bank, 'z', hsHonorVal, 3);
      return {
        placedTiles: [
          tile(hsNumSuit, shape.pairValue, false), tile(hsNumSuit, shape.pairValue, false),
          tile('z', hsHonorVal, false), tile('z', hsHonorVal, false),
        ],
        winningTile: tile('z', hsHonorVal, false),
        setsRemaining: 3,
        needsPair: false,
      };
    }

    // Free shanpon: pick any two distinct tile types
    if (cat === 'shanpon') {
      for (var spAtt = 0; spAtt < 30; spAtt++) {
        var spKeys = [];
        for (var spK in bank) {
          if (bank[spK] >= 2) spKeys.push(spK);
        }
        if (spKeys.length < 2) throw new BankError('Free shanpon: not enough distinct pair-able tiles');
        shuffleInPlace(spKeys);
        var spK1 = spKeys[0], spK2 = spKeys[1];
        var spCan1 = bank[spK1] >= 3;
        var spCan2 = bank[spK2] >= 3;
        if (!spCan1 && !spCan2) continue;
        var spWinsK1 = spCan1 && (!spCan2 || Math.random() < 0.5);
        var spWinKey = spWinsK1 ? spK1 : spK2;
        var spLoseKey = spWinsK1 ? spK2 : spK1;
        var wSuit = spWinKey[0], wVal = parseInt(spWinKey.substring(1), 10);
        var lSuit = spLoseKey[0], lVal = parseInt(spLoseKey.substring(1), 10);
        bankTake(bank, wSuit, wVal, 3);
        bankTake(bank, lSuit, lVal, 2);
        return {
          placedTiles: [
            tile(wSuit, wVal, false), tile(wSuit, wVal, false),
            tile(lSuit, lVal, false), tile(lSuit, lVal, false),
          ],
          winningTile: tile(wSuit, wVal, false),
          setsRemaining: 3,
          needsPair: false,
        };
      }
      throw new BankError('Free shanpon: gave up after attempts');
    }

    throw new Error('Unknown wait shape category: ' + cat);
  }

  // Fill the remaining set slots and (optionally) the pair from the bank.
  // 60% sequences, 40% triplets per slot. Retries on bank-exhaustion clashes.
  function fillRemainingSets(bank, setsRemaining, needsPair) {
    var tiles = [];
    for (var s = 0; s < setsRemaining; s++) {
      var slotOk = false;
      for (var att = 0; att < 60; att++) {
        if (Math.random() < 0.6) {
          // Sequence: numbered suit, start 1-7
          var seqSuit = pickOne(SUITS_NUMBERED);
          var start = 1 + Math.floor(Math.random() * 7);
          if (bankCount(bank, seqSuit, start) > 0
              && bankCount(bank, seqSuit, start + 1) > 0
              && bankCount(bank, seqSuit, start + 2) > 0) {
            bankTake(bank, seqSuit, start, 1);
            bankTake(bank, seqSuit, start + 1, 1);
            bankTake(bank, seqSuit, start + 2, 1);
            tiles.push(tile(seqSuit, start, false));
            tiles.push(tile(seqSuit, start + 1, false));
            tiles.push(tile(seqSuit, start + 2, false));
            slotOk = true;
            break;
          }
        } else {
          // Triplet: any suit/value with 3+ in bank
          var tripKeys = [];
          for (var tk in bank) {
            if (bank[tk] >= 3) tripKeys.push(tk);
          }
          if (tripKeys.length === 0) continue;
          var tKey = pickOne(tripKeys);
          var tSuit = tKey[0], tVal = parseInt(tKey.substring(1), 10);
          bankTake(bank, tSuit, tVal, 3);
          tiles.push(tile(tSuit, tVal, false));
          tiles.push(tile(tSuit, tVal, false));
          tiles.push(tile(tSuit, tVal, false));
          slotOk = true;
          break;
        }
      }
      if (!slotOk) throw new BankError('Could not fill set slot ' + s);
    }
    if (needsPair) {
      var pairKeys = [];
      for (var pk in bank) {
        if (bank[pk] >= 2) pairKeys.push(pk);
      }
      if (pairKeys.length === 0) throw new BankError('Could not fill pair');
      var pKey = pickOne(pairKeys);
      var pSuit = pKey[0], pVal = parseInt(pKey.substring(1), 10);
      bankTake(bank, pSuit, pVal, 2);
      tiles.push(tile(pSuit, pVal, false));
      tiles.push(tile(pSuit, pVal, false));
    }
    return tiles;
  }

  // For each numbered suit, with probability fives.length/4 mark one of the
  // hand's 5s as red. This matches the real-world distribution: 1 of the 4
  // physical fives in a suit is red, so the chance the player drew it is
  // proportional to how many fives ended up in the hand.
  function markAkadora(closedTiles, winningTile) {
    var all = closedTiles.concat([winningTile]);
    var suits = ['m', 'p', 's'];
    for (var si = 0; si < suits.length; si++) {
      var suit = suits[si];
      var fives = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].suit === suit && all[i].value === 5) fives.push(all[i]);
      }
      if (fives.length === 0) continue;
      if (Math.random() < fives.length / 4) {
        var idx = Math.floor(Math.random() * fives.length);
        fives[idx].red = true;
      }
    }
  }

  // Draw n random tiles from the bank uniformly across remaining tile types.
  // Used for dora/ura indicators after the hand is built.
  function drawIndicators(bank, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var keys = [];
      for (var k in bank) {
        if (bank[k] > 0) keys.push(k);
      }
      if (keys.length === 0) throw new BankError('Bank empty when drawing indicators');
      var key = pickOne(keys);
      var suit = key[0], val = parseInt(key.substring(1), 10);
      bankTake(bank, suit, val, 1);
      out.push(tile(suit, val, false));
    }
    return out;
  }

  function pickHonba() {
    var roll = Math.random();
    if (roll < 0.50) return 0;
    if (roll < 0.70) return 1;
    if (roll < 0.82) return 2;
    if (roll < 0.90) return 3;
    if (roll < 0.95) return 4;
    return 5 + Math.floor(Math.random() * 5); // 5-9
  }

  function pickRoundWind() {
    // Override the dataset's tonpuusen-skewed E/S split with a flat 50/50.
    return Math.random() < 0.5 ? 'E' : 'S';
  }

  function pickSeatWind() {
    var winds = ['E', 'S', 'W', 'N'];
    return winds[Math.floor(Math.random() * 4)];
  }

  function generateHandV2a() {
    var shape = pickWaitShape();
    var bank = makeTileBank();
    var inst = instantiateWaitShape(shape, bank);
    var fill = fillRemainingSets(bank, inst.setsRemaining, inst.needsPair);
    var closed = inst.placedTiles.concat(fill);
    markAkadora(closed, inst.winningTile);
    var dora = drawIndicators(bank, 1);
    var ura  = drawIndicators(bank, 1);
    var winType = Math.random() < 0.5 ? 'tsumo' : 'ron';
    var s = makeSituation({
      handShape: 'standard',
      roundWind: pickRoundWind(),
      seatWind:  pickSeatWind(),
      honba:     pickHonba(),
      closedTiles:    closed,
      calls:          [],
      winningTile:    inst.winningTile,
      winType:        winType,
      riichi:         true,
      doraIndicators: dora,
      uraIndicators:  ura,
      waitShape:      shape,
    });
    validateSituation(s);
    return s;
  }

  function generateHand() {
    // Try the procedural generator a few times. BankErrors are recoverable
    // (just bad random luck during instantiation); anything else is a real
    // bug and should surface immediately.
    var lastErr = null;
    for (var i = 0; i < 5; i++) {
      try {
        return generateHandV2a();
      } catch (e) {
        lastErr = e;
        if (!(e instanceof BankError) && e.name !== 'BankError') throw e;
      }
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('generateHandV2a failed 5x, falling back to placeholder. Last error:', lastErr);
    }
    return generatePlaceholderHand();
  }

  // Console-only sanity check. Run as ScoreTrainer.testGenerator(1000) to
  // verify the procedural generator produces valid hands and to inspect the
  // resulting wait-shape category distribution.
  function testGenerator(n) {
    n = n || 1000;
    var ok = 0, fail = 0;
    var byCat = {};
    var errors = [];
    for (var i = 0; i < n; i++) {
      try {
        var s = generateHandV2a();
        ok++;
        var cat = s.waitShape ? s.waitShape.category : '?';
        byCat[cat] = (byCat[cat] || 0) + 1;
      } catch (e) {
        fail++;
        if (errors.length < 5) errors.push(e.message || String(e));
      }
    }
    var lines = ['n=' + n + ' ok=' + ok + ' fail=' + fail];
    var keys = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    for (var k = 0; k < keys.length; k++) {
      lines.push('  ' + keys[k] + ': ' + (byCat[keys[k]] / n * 100).toFixed(1) + '% (' + byCat[keys[k]] + ')');
    }
    if (errors.length) {
      lines.push('first errors:');
      for (var e = 0; e < errors.length; e++) lines.push('  ' + errors[e]);
    }
    return lines.join('\n');
  }

  // ----- Rendering ------------------------------------------------------
  function fmtCall(call) {
    return '[' + call.type + '] ' + tilesToNotation(call.tiles);
  }

  function $(id) { return document.getElementById(id); }

  function renderHand(s) {
    $('trainer-round').textContent  = windName(s.roundWind);
    $('trainer-seat').textContent   = windName(s.seatWind) + (s.seatWind === 'E' ? ' (dealer)' : '');
    $('trainer-honba').textContent  = String(s.honba);
    $('trainer-wintype').textContent = s.winType === 'tsumo' ? 'Tsumo' : 'Ron';
    $('trainer-riichi').textContent  = s.riichi ? 'Yes' : 'No';

    $('trainer-closed').textContent = tilesToNotation(s.closedTiles);

    var callsRow = $('trainer-calls-row');
    if (s.calls.length === 0) {
      callsRow.classList.add('ccr-hidden');
      $('trainer-calls').textContent = '';
    } else {
      callsRow.classList.remove('ccr-hidden');
      $('trainer-calls').textContent = s.calls.map(fmtCall).join('   ');
    }

    $('trainer-winning-tile').textContent = tilesToNotation([s.winningTile]);

    $('trainer-dora').textContent = s.doraIndicators.map(function (t) {
      return tilesToNotation([t]);
    }).join(' ');

    var uraRow = $('trainer-ura-row');
    if (s.riichi && s.uraIndicators.length) {
      uraRow.classList.remove('ccr-hidden');
      $('trainer-ura').textContent = s.uraIndicators.map(function (t) {
        return tilesToNotation([t]);
      }).join(' ');
    } else {
      uraRow.classList.add('ccr-hidden');
      $('trainer-ura').textContent = '';
    }

    // Debug-only: show the wait shape that was rolled for this hand.
    var shapeRow = $('trainer-shape-row');
    if (shapeRow) {
      if (s.waitShape) {
        shapeRow.classList.remove('ccr-hidden');
        $('trainer-shape').textContent = formatWaitShape(s.waitShape);
      } else {
        shapeRow.classList.add('ccr-hidden');
        $('trainer-shape').textContent = '';
      }
    }
  }

  // ----- Wire up --------------------------------------------------------
  function newHand() {
    var s = generateHand();
    renderHand(s);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('trainer-new-btn');
    if (btn) btn.addEventListener('click', newHand);
    newHand();
  });

  // Expose internals for console exploration / future modules.
  window.ScoreTrainer = {
    tile: tile,
    parseNotation: parseNotation,
    tilesToNotation: tilesToNotation,
    makeSituation: makeSituation,
    validateSituation: validateSituation,
    generateHand: generateHand,
    generatePlaceholderHand: generatePlaceholderHand,
    renderHand: renderHand,
    // Piece 1: wait shape selector
    WAIT_SHAPES: WAIT_SHAPES,
    pickWaitShape: pickWaitShape,
    formatWaitShape: formatWaitShape,
    testWaitShapeDistribution: testWaitShapeDistribution,
    // Piece 2a: procedural concealed-riichi generator
    makeTileBank: makeTileBank,
    instantiateWaitShape: instantiateWaitShape,
    fillRemainingSets: fillRemainingSets,
    generateHandV2a: generateHandV2a,
    testGenerator: testGenerator,
  };
})();
