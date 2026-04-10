/* Score Trainer — Core
 *
 * Tile model, notation parser/serializer, bank system, situation model,
 * validation, and shared utilities used by all other st-*.js files.
 *
 * Notation: digits + suit letter, e.g. "123s456p455556m11z".
 *   m = man (characters), p = pin (dots), s = sou (bamboo), z = honors
 *   honors: 1=East 2=South 3=West 4=North 5=White 6=Green 7=Red
 *   0 in m/p/s = red five (akadora)
 *
 * Generator pieces (across st-*.js files):
 *   1.  Wait shape catalog + selector       (st-waits.js)
 *   2a. Plain concealed riichi hands         (st-generator.js)
 *   2b. Open hands, kans, archetype biases   (st-generator.js)
 *   3.  Yaku checker & scoring               (st-scoring.js)
 *   4.  Calibration loop                    (st-generator.js)
 */
(function (ST) {
  'use strict';

  // ----- Tile model --------------------------------------------------------
  // Tile = { suit: 'm'|'p'|'s'|'z', value: 1-9 (1-7 for z), red: bool }

  var SUIT_ORDER = ['m', 'p', 's', 'z'];
  var SUITS_NUMBERED = ['m', 'p', 's'];

  function tile(suit, value, red) {
    return { suit: suit, value: value, red: !!red };
  }

  function tileChar(t) { return t.red ? '0' : String(t.value); }

  function compareTiles(a, b) {
    var sa = SUIT_ORDER.indexOf(a.suit);
    var sb = SUIT_ORDER.indexOf(b.suit);
    if (sa !== sb) return sa - sb;
    if (a.value !== b.value) return a.value - b.value;
    if (a.red !== b.red) return a.red ? -1 : 1;
    return 0;
  }

  // ----- Notation parser ---------------------------------------------------
  function parseNotation(text) {
    var tiles = [];
    var pending = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch >= '0' && ch <= '9') { pending.push(ch); continue; }
      if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
        if (!pending.length) throw new Error('Suit letter "' + ch + '" with no preceding digits');
        for (var j = 0; j < pending.length; j++) {
          var d = pending[j];
          var red = false, v;
          if (d === '0') {
            if (ch === 'z') throw new Error('0 (red five) is not valid in honors');
            red = true; v = 5;
          } else {
            v = d.charCodeAt(0) - 48;
            if (ch === 'z' && (v < 1 || v > 7)) throw new Error('Honors must be 1-7');
          }
          tiles.push(tile(ch, v, red));
        }
        pending = [];
        continue;
      }
      if (/\s/.test(ch)) continue;
      throw new Error('Unexpected character in notation: "' + ch + '"');
    }
    if (pending.length) throw new Error('Notation ended with digits but no suit letter');
    return tiles;
  }

  // ----- Notation serializer -----------------------------------------------
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

  // ----- Wind / honors helpers ---------------------------------------------
  var WIND_NAMES = { E: 'East', S: 'South', W: 'West', N: 'North' };
  var WIND_TO_Z = { E: 1, S: 2, W: 3, N: 4 };
  function windName(letter) { return WIND_NAMES[letter] || letter; }

  // ----- Shared utilities --------------------------------------------------

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

  // ----- BankError (recoverable) -------------------------------------------

  function BankError(msg) { this.message = msg; this.name = 'BankError'; }
  BankError.prototype = Object.create(Error.prototype);
  BankError.prototype.constructor = BankError;

  // ----- Tile bank ---------------------------------------------------------

  function makeTileBank() {
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

  // ----- Fill remaining sets -----------------------------------------------

  function fillRemainingSets(bank, setsRemaining, needsPair) {
    var tiles = [];
    for (var s = 0; s < setsRemaining; s++) {
      var slotOk = false;
      for (var att = 0; att < 60; att++) {
        if (Math.random() < 0.6) {
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

  // ----- Akadora marking ---------------------------------------------------

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

  // ----- Indicator drawing -------------------------------------------------

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

  // ----- Situation picks ---------------------------------------------------

  function pickHonba() {
    var roll = Math.random();
    if (roll < 0.50) return 0;
    if (roll < 0.70) return 1;
    if (roll < 0.82) return 2;
    if (roll < 0.90) return 3;
    if (roll < 0.95) return 4;
    return 5 + Math.floor(Math.random() * 5);
  }

  function pickRoundWind() {
    return Math.random() < 0.5 ? 'E' : 'S';
  }

  function pickSeatWind() {
    var winds = ['E', 'S', 'W', 'N'];
    return winds[Math.floor(Math.random() * 4)];
  }

  // ----- Situation model ---------------------------------------------------

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

  // ----- Validation --------------------------------------------------------

  function validateSituation(s) {
    if (s.handShape === 'chiitoitsu' || s.handShape === 'kokushi') {
      if (s.calls.length !== 0) {
        throw new Error(s.handShape + ' cannot have any calls (must be concealed)');
      }
      var totalCK = s.closedTiles.length + 1;
      if (totalCK !== 14) {
        throw new Error(s.handShape + ' hand has ' + totalCK + ' tiles, expected 14');
      }
    } else {
      var calledTiles = 0, kansStd = 0;
      for (var i = 0; i < s.calls.length; i++) {
        calledTiles += s.calls[i].tiles.length;
        if (s.calls[i].type === 'daiminkan' || s.calls[i].type === 'shouminkan' || s.calls[i].type === 'ankan') kansStd++;
      }
      var standardTotal = s.closedTiles.length + calledTiles + 1;
      var expectedStd = 14 + kansStd;
      if (standardTotal !== expectedStd) {
        throw new Error('Hand has ' + standardTotal + ' tiles, expected ' + expectedStd);
      }
    }

    var totalKans = 0;
    for (var c = 0; c < s.calls.length; c++) {
      if (s.calls[c].type === 'daiminkan' || s.calls[c].type === 'shouminkan' || s.calls[c].type === 'ankan') totalKans++;
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

    var counts = {}, redCounts = {};
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
        if (redCounts[t.suit] > 1) throw new Error('More than 1 red 5 in suit ' + t.suit);
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

  // ----- Placeholder hand --------------------------------------------------

  var PLACEHOLDER_HANDS = [
    {
      roundWind: 'E', seatWind: 'E', honba: 0,
      closedNotation: '34m456m789m123p55p', calls: [],
      winningTile: { suit: 'm', value: 2, red: false },
      winType: 'tsumo', riichi: true,
      doraIndicators: [{ suit: 'p', value: 9, red: false }],
      uraIndicators:  [{ suit: 's', value: 3, red: false }],
    },
  ];

  function generatePlaceholderHand() {
    var src = PLACEHOLDER_HANDS[Math.floor(Math.random() * PLACEHOLDER_HANDS.length)];
    var s = makeSituation({
      roundWind: src.roundWind, seatWind: src.seatWind, honba: src.honba,
      handShape: src.handShape || 'standard',
      closedTiles: parseNotation(src.closedNotation),
      calls: src.calls.map(function (c) {
        return { type: c.type, tiles: parseNotation(c.notation) };
      }),
      winningTile: tile(src.winningTile.suit, src.winningTile.value, src.winningTile.red),
      winType: src.winType, riichi: src.riichi,
      doraIndicators: src.doraIndicators.map(function (t) { return tile(t.suit, t.value, t.red); }),
      uraIndicators: src.uraIndicators.map(function (t) { return tile(t.suit, t.value, t.red); }),
      waitShape: ST.pickWaitShape ? ST.pickWaitShape() : null,
    });
    validateSituation(s);
    return s;
  }

  // ----- Exports -----------------------------------------------------------

  ST.SUIT_ORDER = SUIT_ORDER;
  ST.SUITS_NUMBERED = SUITS_NUMBERED;
  ST.tile = tile;
  ST.tileChar = tileChar;
  ST.compareTiles = compareTiles;
  ST.parseNotation = parseNotation;
  ST.tilesToNotation = tilesToNotation;
  ST.WIND_NAMES = WIND_NAMES;
  ST.WIND_TO_Z = WIND_TO_Z;
  ST.windName = windName;
  ST.shuffleInPlace = shuffleInPlace;
  ST.pickOne = pickOne;
  ST.pickWeighted = pickWeighted;
  ST.BankError = BankError;
  ST.makeTileBank = makeTileBank;
  ST.bankCount = bankCount;
  ST.bankTake = bankTake;
  ST.bankReturn = bankReturn;
  ST.fillRemainingSets = fillRemainingSets;
  ST.markAkadora = markAkadora;
  ST.drawIndicators = drawIndicators;
  ST.pickHonba = pickHonba;
  ST.pickRoundWind = pickRoundWind;
  ST.pickSeatWind = pickSeatWind;
  ST.makeSituation = makeSituation;
  ST.validateSituation = validateSituation;
  ST.generatePlaceholderHand = generatePlaceholderHand;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));
