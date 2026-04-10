/* Score Trainer — Wait Shapes
 *
 * Wait shape catalog (47 rows across 8 categories) with weighted
 * selection and tile-bank instantiation.
 */
(function (ST) {
  'use strict';

  var tile = ST.tile;
  var BankError = ST.BankError;
  var bankCount = ST.bankCount;
  var bankTake = ST.bankTake;
  var bankReturn = ST.bankReturn;
  var shuffleInPlace = ST.shuffleInPlace;
  var pickWeighted = ST.pickWeighted;
  var SUITS_NUMBERED = ST.SUITS_NUMBERED;

  // ----- Wait shape catalog ------------------------------------------------
  var WAIT_SHAPES = [
    // Ryanmen
    { category: 'ryanmen', label: '14', held: [2,3], waits: [1,4], suitKind: 'numbered', weight: 379889 },
    { category: 'ryanmen', label: '25', held: [3,4], waits: [2,5], suitKind: 'numbered', weight: 401454 },
    { category: 'ryanmen', label: '36', held: [4,5], waits: [3,6], suitKind: 'numbered', weight: 424295 },
    { category: 'ryanmen', label: '47', held: [5,6], waits: [4,7], suitKind: 'numbered', weight: 422734 },
    { category: 'ryanmen', label: '58', held: [6,7], waits: [5,8], suitKind: 'numbered', weight: 402735 },
    { category: 'ryanmen', label: '69', held: [7,8], waits: [6,9], suitKind: 'numbered', weight: 383238 },

    // Sanmenchan
    { category: 'sanmenchan', label: '147', held: [2,3,4,5,6], waits: [1,4,7], suitKind: 'numbered', weight: 99578 },
    { category: 'sanmenchan', label: '258', held: [3,4,5,6,7], waits: [2,5,8], suitKind: 'numbered', weight: 98861 },
    { category: 'sanmenchan', label: '369', held: [4,5,6,7,8], waits: [3,6,9], suitKind: 'numbered', weight: 99764 },

    // Tanki
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

    // Honor shanpon
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

    // Kanchan (interpolated)
    { category: 'kanchan', label: '13', held: [1,3], waits: [2], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '24', held: [2,4], waits: [3], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '35', held: [3,5], waits: [4], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '46', held: [4,6], waits: [5], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '57', held: [5,7], waits: [6], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '68', held: [6,8], waits: [7], suitKind: 'numbered', weight: 67000 },
    { category: 'kanchan', label: '79', held: [7,9], waits: [8], suitKind: 'numbered', weight: 67000 },

    // Penchan (interpolated)
    { category: 'penchan', label: '12', held: [1,2], waits: [3], suitKind: 'numbered', weight: 57000 },
    { category: 'penchan', label: '89', held: [8,9], waits: [7], suitKind: 'numbered', weight: 57000 },

    // Shanpon, non-honor (interpolated)
    { category: 'shanpon', label: 'free', suitKind: 'numbered', weight: 233000 },

    // Nobetan (interpolated)
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

  function pickWaitShape() { return pickWeighted(WAIT_SHAPES); }

  function formatWaitShape(shape) {
    if (!shape) return '';
    var name = WAIT_CATEGORY_NAMES[shape.category] || shape.category;
    return name + ' \u2014 ' + shape.label;
  }

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

  // ----- Wait shape instantiation ------------------------------------------

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
        for (var rb = 0; rb < taken.length; rb++) bankReturn(bank, suit, taken[rb], 1);
      }
      throw e;
    }
  }

  function instantiateWaitShape(shape, bank) {
    var cat = shape.category;

    // Sequence-completing shapes
    if (cat === 'ryanmen' || cat === 'sanmenchan' || cat === 'kanchan' || cat === 'penchan') {
      var suits = shuffleInPlace(SUITS_NUMBERED.slice());
      var attempt = null;
      for (var s = 0; s < suits.length; s++) {
        try { attempt = takeSequenceWait(bank, shape, suits[s]); break; }
        catch (e) { if (!(e instanceof BankError)) throw e; }
      }
      if (!attempt) throw new BankError('No suit could host ' + shape.label);
      return {
        placedTiles: attempt.placedTiles, winningTile: attempt.winningTile,
        setsRemaining: cat === 'sanmenchan' ? 2 : 3, needsPair: true,
      };
    }

    // Nobetan
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
              nbWinV = nbWinOpts[wi]; break;
            }
          }
          if (nbWinV === null) throw new BankError('No nobetan winning tile in ' + nbSuit);
          var nbPlaced = [];
          for (var pi = 0; pi < shape.held.length; pi++) {
            nbPlaced.push(tile(nbSuit, shape.held[pi], false));
          }
          return { placedTiles: nbPlaced, winningTile: tile(nbSuit, nbWinV, false),
                   setsRemaining: 3, needsPair: false };
        } catch (e) {
          if (!(e instanceof BankError)) throw e;
          for (var rb2 = 0; rb2 < nbTaken.length; rb2++) bankReturn(bank, nbSuit, nbTaken[rb2], 1);
        }
      }
      throw new BankError('Could not place nobetan ' + shape.label);
    }

    // Tanki
    if (cat === 'tanki') {
      if (shape.suitKind === 'honor') {
        var honors = shuffleInPlace([1, 2, 3, 4, 5, 6, 7]);
        for (var hi2 = 0; hi2 < honors.length; hi2++) {
          if (bankCount(bank, 'z', honors[hi2]) >= 2) {
            bankTake(bank, 'z', honors[hi2], 2);
            return { placedTiles: [tile('z', honors[hi2], false)],
                     winningTile: tile('z', honors[hi2], false),
                     setsRemaining: 4, needsPair: false };
          }
        }
        throw new BankError('No honor available for tanki Z');
      }
      var tv = shape.held[0];
      var tSuits = shuffleInPlace(SUITS_NUMBERED.slice());
      for (var ts = 0; ts < tSuits.length; ts++) {
        if (bankCount(bank, tSuits[ts], tv) >= 2) {
          bankTake(bank, tSuits[ts], tv, 2);
          return { placedTiles: [tile(tSuits[ts], tv, false)],
                   winningTile: tile(tSuits[ts], tv, false),
                   setsRemaining: 4, needsPair: false };
        }
      }
      throw new BankError('No suit available for tanki ' + tv);
    }

    // Honor-shanpon
    if (cat === 'honor-shanpon') {
      if (shape.pairValue === null) {
        // Z+Z: two distinct honor pairs
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
            placedTiles: [tile('z', zWin, false), tile('z', zWin, false),
                          tile('z', zLose, false), tile('z', zLose, false)],
            winningTile: tile('z', zWin, false), setsRemaining: 3, needsPair: false,
          };
        }
        throw new BankError('Z+Z: gave up after attempts');
      }
      // Numbered pair + honor pair
      var hsNumSuits = shuffleInPlace(SUITS_NUMBERED.slice());
      var hsNumSuit = null;
      for (var hsNs = 0; hsNs < hsNumSuits.length; hsNs++) {
        if (bankCount(bank, hsNumSuits[hsNs], shape.pairValue) >= 2) {
          hsNumSuit = hsNumSuits[hsNs]; break;
        }
      }
      if (hsNumSuit === null) throw new BankError('Honor-shanpon: no numbered suit for pair ' + shape.pairValue);
      var hsHonors = shuffleInPlace([1, 2, 3, 4, 5, 6, 7]);
      var hsHonorVal = null;
      for (var hsHi = 0; hsHi < hsHonors.length; hsHi++) {
        if (bankCount(bank, 'z', hsHonors[hsHi]) >= 2) { hsHonorVal = hsHonors[hsHi]; break; }
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
          placedTiles: [tile(hsNumSuit, shape.pairValue, false), tile(hsNumSuit, shape.pairValue, false),
                        tile('z', hsHonorVal, false), tile('z', hsHonorVal, false)],
          winningTile: tile(hsNumSuit, shape.pairValue, false), setsRemaining: 3, needsPair: false,
        };
      }
      bankTake(bank, hsNumSuit, shape.pairValue, 2);
      bankTake(bank, 'z', hsHonorVal, 3);
      return {
        placedTiles: [tile(hsNumSuit, shape.pairValue, false), tile(hsNumSuit, shape.pairValue, false),
                      tile('z', hsHonorVal, false), tile('z', hsHonorVal, false)],
        winningTile: tile('z', hsHonorVal, false), setsRemaining: 3, needsPair: false,
      };
    }

    // Free shanpon
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
          placedTiles: [tile(wSuit, wVal, false), tile(wSuit, wVal, false),
                        tile(lSuit, lVal, false), tile(lSuit, lVal, false)],
          winningTile: tile(wSuit, wVal, false), setsRemaining: 3, needsPair: false,
        };
      }
      throw new BankError('Free shanpon: gave up after attempts');
    }

    throw new Error('Unknown wait shape category: ' + cat);
  }

  // ----- Exports -----------------------------------------------------------

  ST.WAIT_SHAPES = WAIT_SHAPES;
  ST.WAIT_CATEGORY_NAMES = WAIT_CATEGORY_NAMES;
  ST.pickWaitShape = pickWaitShape;
  ST.formatWaitShape = formatWaitShape;
  ST.testWaitShapeDistribution = testWaitShapeDistribution;
  ST.instantiateWaitShape = instantiateWaitShape;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));
