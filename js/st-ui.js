/* Score Trainer — UI
 *
 * Rendering and DOM wiring. Depends on all other st-*.js files.
 */
(function (ST) {
  'use strict';

  var windName = ST.windName;
  var tilesToNotation = ST.tilesToNotation;

  function fmtCall(call) {
    return '[' + call.type + '] ' + tilesToNotation(call.tiles);
  }

  function $(id) { return document.getElementById(id); }

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
