/****************************************************
 * 1) Inject the floating widget for displaying odds
 ****************************************************/
injectOddsWidget();

/****************************************************
 * 2) Set Up MutationObserver to Detect Cards
 ****************************************************/
function watchForSecondCard() {
  const targetNode = document.querySelector('.card-container.card-p2');
  if (!targetNode) return;

  const config = { childList: true, subtree: true };
  const callback = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const valueElement = targetNode.querySelector('.value');
        const suitElement = targetNode.querySelector('.suit');
        if (valueElement && suitElement) {
          getPlayerCards();
          observer.disconnect();
          return;
        }
      }
    }
  };
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}
watchForSecondCard();

/****************************************************
 * 3) Periodically Read the DOM and Fetch Odds
 ****************************************************/
const REFRESH_INTERVAL_MS = 3000;
let lastCommunityCardCount = 0;

// Initialize blinds
let currentSmallBlind = null;
let currentBigBlind = null;

// Function to update blinds
function updateBlinds() {
  const blinds = getBlinds();
  if (blinds.bigBlind && blinds.littleBlind) {
    currentBigBlind = blinds.bigBlind;
    currentSmallBlind = blinds.littleBlind;
    console.log(`[PokerNow Extension] Updated blinds: Small Blind = ${currentSmallBlind}, Big Blind = ${currentBigBlind}`);
  } else {
    console.warn('[PokerNow Extension] Could not determine blinds.');
  }
}

// Initial blinds setup
updateBlinds();

setInterval(() => {
  try {
    checkForNewHand();

    const playerCards = getPlayerCards();
    const communityCards = getCommunityCards();
    updateWidgetCards(playerCards, communityCards);

    // A) Overall "winProbability"
    if (playerCards.length === 2) {
      fetchOdds(playerCards, communityCards, 1)
        .then((winProb) => updateOddsDisplay(winProb))
        .catch(() => updateOddsDisplay(-1));
    }

    // B) Probability of hitting one pair, two pair, etc.
    if (playerCards.length === 2) {
      fetchHandOdds(playerCards, communityCards, 1000)
        .then((handOdds) => updateHandOddsDisplay(handOdds))
        .catch((err) => {
          console.error('[PokerNow Extension] Error fetching hand odds:', err);
        });
    }

    // C) Bet tracking, cleanup seats, update UI
    trackBettingActions();
    cleanupMissingPlayers();
    updateStatsDisplay();
    sendPlayerStatsToServer();

    lastCommunityCardCount = communityCards.length;

    // Optionally, update blinds periodically or when a new hand is detected
    // This can be placed inside checkForNewHand() if blinds change only per hand
  } catch (error) {
    console.error('[PokerNow Extension] Unexpected error:', error);
  }
}, REFRESH_INTERVAL_MS);

/************************************************
 * 4) Widget Injection & UI Update Functions
 ************************************************/
function injectOddsWidget() {
  const widget = document.createElement('div');
  widget.id = 'poker-odds-widget';
  widget.style.position = 'fixed';
  widget.style.top = '100px';
  widget.style.right = '20px';
  widget.style.zIndex = '9999';
  widget.style.backgroundColor = 'white';
  widget.style.border = '1px solid #ccc';
  widget.style.padding = '10px';
  widget.style.fontFamily = 'Arial, sans-serif';
  widget.style.width = '270px';
  widget.style.fontSize = '14px';

  widget.innerHTML = `
    <h4 style="margin:0 0 10px;">Poker Stats</h4>
    <div id="hand-odds-display" style="margin-bottom: 10px;">
      <h5 style="margin:0 0 5px;">Hand Odds</h5>
      <div id="hand-odds-list">
        <div>One Pair: --</div>
        <div>Two Pair: --</div>
        <div>Three of a Kind: --</div>
        <div>Straight: --</div>
        <div>Flush: --</div>
        <div>Full House: --</div>
      </div>
    </div>
    <div id="cards-info" style="margin-bottom: 10px;">
      <strong>Hole Cards:</strong> <span id="hole-cards">None</span><br>
      <strong>Community Cards:</strong> <span id="community-cards">None</span><br>
      <strong id="odds-value">Win Probability: Loading...</strong>
    </div>
    <hr>
    <div id="stats-display">
      <h5 style="margin:0 0 5px;">Player Stats</h5>
      <div id="player-stats-list"></div>
    </div>
  `;
  document.body.appendChild(widget);
}

function updateWidgetCards(playerCards, communityCards) {
  const holeCardsElement = document.getElementById('hole-cards');
  const communityCardsElement = document.getElementById('community-cards');

  if (holeCardsElement) {
    holeCardsElement.textContent = playerCards.length ? playerCards.join(', ') : 'None';
  }
  if (communityCardsElement) {
    communityCardsElement.textContent = communityCards.length ? communityCards.join(', ') : 'None';
  }
}

function updateOddsDisplay(probability) {
  const oddsElement = document.getElementById('odds-value');
  if (!oddsElement) return;
  if (probability < 0) {
    oddsElement.textContent = 'Win Probability: Error fetching odds.';
  } else {
    oddsElement.textContent = `Win Probability: ${probability.toFixed(1)}%`;
  }
}

function updateHandOddsDisplay(handOdds) {
  const oddsListDiv = document.getElementById('hand-odds-list');
  if (!oddsListDiv) return;
  oddsListDiv.innerHTML = `
    <div>One Pair: ${handOdds.one_pair.toFixed(1)}%</div>
    <div>Two Pair: ${handOdds.two_pair.toFixed(1)}%</div>
    <div>Three of a Kind: ${handOdds.three_of_a_kind.toFixed(1)}%</div>
    <div>Straight: ${handOdds.straight.toFixed(1)}%</div>
    <div>Flush: ${handOdds.flush.toFixed(1)}%</div>
    <div>Full House: ${handOdds.full_house.toFixed(1)}%</div>
  `;
}

function updateStatsDisplay() {
  const playerStatsList = document.getElementById('player-stats-list');
  if (!playerStatsList) return;
  playerStatsList.innerHTML = '';

  Object.keys(playerStats).forEach((playerName) => {
    const stats = playerStats[playerName];
    const div = document.createElement('div');
    div.style.marginBottom = '4px';
    div.textContent = `${playerName}: RFI=${stats.rfiCount}, 3-bet=${stats.threeBetCount}, limp=${stats.limpCount}`;
    playerStatsList.appendChild(div);
  });
}

/***************************************************
 * 5) Functions for Reading Cards from the DOM
 ***************************************************/
/**
 * We must produce strings like "4dd","7hh","10dd","2ss".
 * rank + (suit letter repeated 2x).
 */
function mapToDoubleSuitFormat(rankStr, suitStr) {
  // Example:
  // rankStr = "4", suitStr = "♦" => "4dd"
  // rankStr = "7", suitStr = "♥" => "7hh"
  // rankStr = "10", suitStr = "♦" => "10dd"

  // We'll define a mapping for suits:
  const suitMap = {
    '♠': 'ss','s': 'ss','spade': 'ss','spades': 'ss',
    '♣': 'cc','c': 'cc','club': 'cc','clubs': 'cc',
    '♦': 'dd','d': 'dd','diamond': 'dd','diamonds': 'dd',
    '♥': 'hh','h': 'hh','heart': 'hh','hearts': 'hh'
  };

  // We'll keep the rank as is (or uppercase). '10' => '10', 'A' => 'A'.
  // Then we do rank + suitMap(suitStr).
  const rank = rankStr.toUpperCase(); 
  const s = suitMap[suitStr.toLowerCase()] || suitStr; // fallback

  // final => e.g. "4dd", "7hh", "10dd"
  return `${rank}${s || ''}`;
}

/**
 * Reads hole cards from DOM, produce "4dd","10dd","7hh" etc.
 */
function getPlayerCards() {
  const player1Cards = Array.from(document.querySelectorAll('.card-container.card-p1, .card-container.card-p2'));
  return player1Cards.map((card) => {
    const rank = card.querySelector('.value')?.textContent?.trim() || '';
    // suits can appear as multiple spans, we join them:
    const suit = Array.from(card.querySelectorAll('.suit')).map(s => s.textContent.trim()).join('').toLowerCase();
    if (!rank || !suit) return null;
    return mapToDoubleSuitFormat(rank, suit);
  }).filter(Boolean);
}

/**
 * Reads community cards from DOM, produce "4dd","10dd","7hh" etc.
 */
function getCommunityCards() {
  const communityCards = Array.from(document.querySelectorAll('.card-container:not(.card-p1):not(.card-p2)'));
  return communityCards.map((card) => {
    const rank = card.querySelector('.value')?.textContent?.trim() || '';
    const suit = Array.from(card.querySelectorAll('.suit')).map(s => s.textContent.trim()).join('').toLowerCase();
    if (!rank || !suit) return null;
    return mapToDoubleSuitFormat(rank, suit);
  }).filter(Boolean);
}

/************************************************
 * 6) Fetching Odds from Your Python Server
 ************************************************/
async function fetchOdds(playerCards, communityCards, numOpponents) {
  const url = 'http://127.0.0.1:5000/calculate_odds';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCards, communityCards, numOpponents }),
    });
    if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
    const data = await resp.json();
    return data.winProbability;
  } catch (err) {
    console.error('[PokerNow Extension] Error fetching odds:', err);
    throw err;
  }
}

async function fetchHandOdds(playerCards, communityCards, numSimulations = 1000) {
  const url = 'http://127.0.0.1:5000/calculate_hand_odds';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCards, communityCards, numSimulations }),
    });
    if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
    const data = await resp.json();
    return data;  // { one_pair: XX, two_pair: YY, ...}
  } catch (err) {
    console.error('[PokerNow Extension] Error fetching hand odds:', err);
    throw err;
  }
}

/************************************************
 * 7) Tracking & Aggregating Betting Stats
 ************************************************/
let playerStats = {};
let lastBetAmounts = {};
let rfiPlayer = null;
let rfiBet = 0;
let forcedBlindsPlayers = [];

function checkForNewHand() {
  const communityCards = getCommunityCards();
  if (communityCards.length === 0 && lastCommunityCardCount > 0) {
    console.log('[PokerNow Extension] Detected a new hand. Resetting preflop logic.');
    lastBetAmounts = {};
    rfiPlayer = null;
    rfiBet = 0;
    forcedBlindsPlayers = [];

    // Update blinds for the new hand
    updateBlinds();
  }
}

function trackBettingActions() {
  const playerElements = document.querySelectorAll('.table-player');
  const community = getCommunityCards();
  const isPreflop = (community.length === 0);

  playerElements.forEach((playerEl) => {
    const nameEl = playerEl.querySelector('.table-player-name a');
    if (!nameEl) return;
    const playerName = nameEl.textContent.trim();

    if (!playerStats[playerName]) {
      playerStats[playerName] = { rfiCount: 0, threeBetCount: 0, limpCount: 0 };
    }

    const betValueElement = playerEl.querySelector('.table-player-bet-value .normal-value');
    let currentBet = betValueElement ? parseInt(betValueElement.textContent.replace(/\D/g, ''), 10) : 0;
    if (isNaN(currentBet)) currentBet = 0;

    const lastBet = lastBetAmounts[playerName] || 0;
    if (currentBet === lastBet) return;

    lastBetAmounts[playerName] = currentBet;

    if (isPreflop) {
      // Skip forced blinds
      if (
        rfiPlayer === null &&
        forcedBlindsPlayers.length < 2 &&
        lastBet === 0 &&
        currentBet > 0 &&
        !forcedBlindsPlayers.includes(playerName)
      ) {
        forcedBlindsPlayers.push(playerName);
        lastBetAmounts[playerName] = currentBet;
        console.log(`[PokerNow Extension] Skipping forced blind for ${playerName} (bet ${currentBet}).`);
        return;
      }

      if (rfiPlayer === null && currentBet === currentBigBlind) {
        playerStats[playerName].limpCount += 1;
        console.log(`[PokerNow Extension] ${playerName} -> Limp (bet ${currentBet})`);
      }
      else if (rfiPlayer === null && currentBet >= currentBigBlind) {
        rfiPlayer = playerName;
        rfiBet = currentBet;
        playerStats[playerName].rfiCount += 1;
        console.log(`[PokerNow Extension] ${playerName} -> RFI (bet ${currentBet})`);
      }
      else if (rfiPlayer && currentBet > rfiBet) {
        playerStats[playerName].threeBetCount += 1;
        console.log(`[PokerNow Extension] ${playerName} -> 3-bet (bet ${currentBet})`);
      }
    }
  });
}

function cleanupMissingPlayers() {
  const seatedNames = [];
  document.querySelectorAll('.table-player').forEach((el) => {
    const nameA = el.querySelector('.table-player-name a');
    if (nameA) {
      seatedNames.push(nameA.textContent.trim());
    }
  });

  Object.keys(playerStats).forEach((storedName) => {
    if (!seatedNames.includes(storedName)) {
      console.log(`[PokerNow Extension] Removing stats for ${storedName} (left seat).`);
      delete playerStats[storedName];
      delete lastBetAmounts[storedName];
      forcedBlindsPlayers = forcedBlindsPlayers.filter((n) => n !== storedName);
      if (rfiPlayer === storedName) {
        rfiPlayer = null;
        rfiBet = 0;
      }
    }
  });
}

/************************************************
 * 8) Send Stats to the Server
 ************************************************/
let lastSentStats = JSON.stringify({});

async function sendPlayerStatsToServer() {
  const url = 'http://127.0.0.1:5000/update_player_stats';
  const payload = { playerStats };
  const payloadJson = JSON.stringify(payload);

  if (payloadJson === lastSentStats) return;
  lastSentStats = payloadJson;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadJson,
    });
    if (!resp.ok) {
      throw new Error(`Server error (update_player_stats): ${resp.status}`);
    }
    const data = await resp.json();
    console.log('[PokerNow Extension] /update_player_stats response:', data);
  } catch (err) {
    console.error('[PokerNow Extension] Error sending player stats:', err);
  }
}


/****************************************************
 * 9) Function to Dynamically Retrieve Blinds
 ****************************************************/
function getBlinds() {
  try {
    // Adjust the selector based on your actual DOM structure
    const blindElements = document.querySelectorAll('.blind-value .chips-value .normal-value');
    if (blindElements.length < 2) {
      console.warn('[PokerNow Extension] Could not find both blinds.');
      return { bigBlind: null, littleBlind: null };
    }

    const blinds = Array.from(blindElements).map(el => parseInt(el.textContent.trim(), 10)).filter(num => !isNaN(num));
    if (blinds.length < 2) {
      console.warn('[PokerNow Extension] Could not parse both blinds.');
      return { bigBlind: null, littleBlind: null };
    }

    // Determine which is big and which is small
    const sortedBlinds = blinds.sort((a, b) => a - b);
    return {
      littleBlind: sortedBlinds[0],
      bigBlind: sortedBlinds[1]
    };
  } catch (error) {
    console.error('[PokerNow Extension] Error retrieving blinds:', error);
    return { bigBlind: null, littleBlind: null };
  }
}
