/* Score Trainer — UI
 *
 * Rendering and DOM wiring. Depends on all other st-*.js files.
 */
(function (ST) {
  'use strict';

  var windName = ST.windName;
  var tilesToNotation = ST.tilesToNotation;

  function $(id) { return document.getElementById(id); }

  // ----- Tile image paths ----------------------------------------------------

  var TILE_DIR = 'mahjong images/tiles/';

  // Map tile {suit, value, red} → filename stem (e.g. "Man5-Dora", "Ton")
  var HONOR_NAMES = { 1: 'Ton', 2: 'Nan', 3: 'Shaa', 4: 'Pei', 5: 'Haku', 6: 'Hatsu', 7: 'Chun' };
  var SUIT_NAMES  = { m: 'Man', p: 'Pin', s: 'Sou' };

  function tileStem(t) {
    if (t.suit === 'z') return HONOR_NAMES[t.value];
    var name = SUIT_NAMES[t.suit] + t.value;
    if (t.red) name = SUIT_NAMES[t.suit] + '5-Dora';
    return name;
  }

  // Detect dark mode once and update on change
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var isDark = darkQuery.matches;
  darkQuery.addEventListener('change', function (e) { isDark = e.matches; });

  function tileFolder() { return isDark ? 'Black/' : 'Regular/'; }

  // Create a single tile <span> element with layered background
  function makeTileEl(t, opts) {
    opts = opts || {};
    var span = document.createElement('span');
    span.className = 'tile-img' + (opts.rotated ? ' tile-img--rotated' : '');
    var folder = TILE_DIR + tileFolder();
    var face = folder + tileStem(t) + '.svg';
    var front = folder + 'Front.svg';
    span.style.backgroundImage = 'url("' + face + '"), url("' + front + '")';
    span.setAttribute('aria-label', tilesToNotation([t]));
    span.setAttribute('role', 'img');
    return span;
  }

  // Build a row of tile images from an array of tile objects
  function makeTileRow(tiles) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < tiles.length; i++) {
      frag.appendChild(makeTileEl(tiles[i]));
    }
    return frag;
  }

  // Build a call group: sideways tile for the called tile
  function makeCallGroup(call) {
    var wrap = document.createElement('span');
    wrap.className = 'tile-call-group';

    var tiles = call.tiles;
    var rotIdx = 0; // which tile to show sideways

    if (call.type === 'ankan') {
      // Closed kan: show back-front-front-back
      for (var i = 0; i < tiles.length; i++) {
        if (i === 0 || i === 3) {
          var back = document.createElement('span');
          back.className = 'tile-img tile-img--back';
          var folder = TILE_DIR + tileFolder();
          back.style.backgroundImage = 'url("' + folder + 'Back.svg")';
          back.setAttribute('aria-label', 'face-down');
          back.setAttribute('role', 'img');
          wrap.appendChild(back);
        } else {
          wrap.appendChild(makeTileEl(tiles[i]));
        }
      }
      return wrap;
    }

    // chi: rotated tile first; pon/kan: rotated tile first
    for (var j = 0; j < tiles.length; j++) {
      wrap.appendChild(makeTileEl(tiles[j], { rotated: j === rotIdx }));
    }
    return wrap;
  }

  // ----- Yaku display name map -----------------------------------------------

  var YAKU_DISPLAY = {
    'riichi': 'Riichi', 'ippatsu': 'Ippatsu', 'menzen-tsumo': 'Menzen Tsumo',
    'tanyao': 'Tanyao', 'pinfu': 'Pinfu',
    'iipeikou': 'Iipeikou', 'ryanpeikou': 'Ryanpeikou',
    'haku': 'Haku', 'hatsu': 'Hatsu', 'chun': 'Chun',
    'round-wind': 'Round Wind', 'seat-wind': 'Seat Wind',
    'toitoi': 'Toitoi', 'sanankou': 'Sanankou',
    'sanshoku': 'Sanshoku', 'ittsuu': 'Ittsuu',
    'chanta': 'Chanta', 'junchan': 'Junchan',
    'honroutou': 'Honroutou', 'shousangen': 'Shousangen',
    'honitsu': 'Honitsu', 'chinitsu': 'Chinitsu',
    'chiitoitsu': 'Chiitoitsu',
    'dora': 'Dora', 'ura-dora': 'Ura Dora', 'aka-dora': 'Aka Dora',
    // Yakuman
    'kokushi': 'Kokushi Musou', 'suuankou': 'Suu Ankou',
    'daisangen': 'Daisangen', 'shousuushii': 'Shousuushii',
    'daisuushii': 'Daisuushii', 'tsuuiisou': 'Tsuuiisou',
    'chinroutou': 'Chinroutou', 'ryuuiisou': 'Ryuuiisou',
    'chuuren': 'Chuuren Poutou'
  };

  var LEVEL_DISPLAY = {
    'mangan': 'Mangan', 'haneman': 'Haneman', 'baiman': 'Baiman',
    'sanbaiman': 'Sanbaiman', 'kazoe-yakuman': 'Kazoe Yakuman',
    'yakuman': 'Yakuman'
  };

  // ----- Hand rendering ------------------------------------------------------

  // Helper: clear element and append a fragment/element
  function setTiles(el, content) {
    el.textContent = '';
    el.appendChild(content);
  }

  function renderHand(s) {
    $('trainer-round').textContent  = windName(s.roundWind);
    $('trainer-seat').textContent   = windName(s.seatWind) + (s.seatWind === 'E' ? ' (dealer)' : '');
    $('trainer-honba').textContent  = String(s.honba);
    $('trainer-wintype').textContent = s.winType === 'tsumo' ? 'Tsumo' : 'Ron';
    $('trainer-riichi').textContent  = s.riichi ? 'Yes' : 'No';

    // Closed hand — tile images
    setTiles($('trainer-closed'), makeTileRow(s.closedTiles));

    // Calls — tile images with rotated called tiles
    var callsRow = $('trainer-calls-row');
    var callsEl = $('trainer-calls');
    if (s.calls.length === 0) {
      callsRow.classList.add('ccr-hidden');
      callsEl.textContent = '';
    } else {
      callsRow.classList.remove('ccr-hidden');
      callsEl.textContent = '';
      for (var ci = 0; ci < s.calls.length; ci++) {
        if (ci > 0) {
          var spacer = document.createElement('span');
          spacer.className = 'tile-call-spacer';
          callsEl.appendChild(spacer);
        }
        callsEl.appendChild(makeCallGroup(s.calls[ci]));
      }
    }

    // Winning tile — tile image
    setTiles($('trainer-winning-tile'), makeTileRow([s.winningTile]));

    // Dora indicators — tile images
    setTiles($('trainer-dora'), makeTileRow(s.doraIndicators));

    // Ura indicators — tile images
    var uraRow = $('trainer-ura-row');
    var uraEl = $('trainer-ura');
    if (s.riichi && s.uraIndicators.length) {
      uraRow.classList.remove('ccr-hidden');
      setTiles(uraEl, makeTileRow(s.uraIndicators));
    } else {
      uraRow.classList.add('ccr-hidden');
      uraEl.textContent = '';
    }

    // Hide the answer section and swap buttons
    $('trainer-answer').classList.add('ccr-hidden');
    $('trainer-show-btn').classList.remove('ccr-hidden');
    $('trainer-new-btn').classList.add('ccr-hidden');
  }

  // ----- Answer rendering ----------------------------------------------------

  function renderAnswer(s) {
    var sc = s.scoring;
    var elYaku = $('trainer-yaku');
    var elHanfu = $('trainer-hanfu');
    var elLevel = $('trainer-level');
    var elLevelRow = $('trainer-level-row');
    var elPayment = $('trainer-payment');
    var elAnswer = $('trainer-answer');

    var elWait = $('trainer-wait');

    if (!sc) {
      elYaku.textContent = '(no valid yaku found)';
      elHanfu.textContent = '';
      elLevel.textContent = '';
      elWait.textContent = '';
      elPayment.textContent = '';
      elLevelRow.classList.add('ccr-hidden');
      elAnswer.classList.remove('ccr-hidden');
      return;
    }

    // Yaku list
    var yakuParts = [];
    for (var i = 0; i < sc.yaku.length; i++) {
      var y = sc.yaku[i];
      var name = YAKU_DISPLAY[y.name] || y.name;
      if (y.yakuman) {
        yakuParts.push(name + ' (yakuman)');
      } else {
        yakuParts.push(name + ' (' + y.han + ')');
      }
    }
    elYaku.textContent = yakuParts.join(', ');

    // Han / Fu
    if (sc.yakuman) {
      elHanfu.textContent = 'Yakuman';
    } else {
      elHanfu.textContent = sc.han + ' han / ' + sc.fu + ' fu';
    }

    // Level
    if (sc.level) {
      elLevelRow.classList.remove('ccr-hidden');
      elLevel.textContent = LEVEL_DISPLAY[sc.level] || sc.level;
    } else {
      elLevelRow.classList.add('ccr-hidden');
      elLevel.textContent = '';
    }

    // Wait type
    var WAIT_DISPLAY = {
      'ryanmen': 'Ryanmen (two-sided)',
      'kanchan': 'Kanchan (closed)',
      'penchan': 'Penchan (edge)',
      'shanpon': 'Shanpon (double pair)',
      'tanki': 'Tanki (single)',
      'kokushi': 'Kokushi (thirteen orphans)'
    };
    elWait.textContent = sc.waitType ? (WAIT_DISPLAY[sc.waitType] || sc.waitType) : '\u2014';

    // Payment
    var pay = sc.score;
    var payStr;
    if (s.winType === 'tsumo') {
      if (sc.isDealer) {
        payStr = pay.all + ' all';
      } else {
        payStr = pay.nonDealer + '/' + pay.dealer;
      }
    } else {
      payStr = String(pay.total);
    }
    if (sc.honba > 0) {
      payStr += ' (+' + sc.honbaBonus + ' honba)';
    }
    payStr += ' = ' + sc.totalWithHonba + ' total';
    elPayment.textContent = payStr;

    elAnswer.classList.remove('ccr-hidden');
  }

  // ----- Event wiring --------------------------------------------------------

  var currentSituation = null;

  function newHand() {
    currentSituation = ST.generateHand();
    renderHand(currentSituation);
  }

  function showAnswer() {
    if (!currentSituation) return;
    renderAnswer(currentSituation);
    $('trainer-show-btn').classList.add('ccr-hidden');
    $('trainer-new-btn').classList.remove('ccr-hidden');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var showBtn = $('trainer-show-btn');
    var newBtn = $('trainer-new-btn');
    if (showBtn) showBtn.addEventListener('click', showAnswer);
    if (newBtn) newBtn.addEventListener('click', newHand);
    newHand();
  });

  ST.renderHand = renderHand;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));
