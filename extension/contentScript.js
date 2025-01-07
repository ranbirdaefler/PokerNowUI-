/****************************************************
 * 1) Inject the floating widgets for displaying odds and game state values
 ****************************************************/
injectOddsWidget();
injectGameStateWidget();

/****************************************************
 * 2) Set Up MutationObserver to Detect Cards and Changes in DOM
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

const REFRESH_INTERVAL_MS = 3000;
let lastCommunityCardCount = 0;
let currentSmallBlind = null;
let currentBigBlind = null;
let isLLMCalled = false; // Global flag to track if LLM has been called

setInterval(() => {
  try {

    const playerCards = getPlayerCards();
    const communityCards = getCommunityCards();
    updateWidgetCards(playerCards, communityCards);

    const gameState = getGameState();
  
    checkYourTurn(gameState); // Check if it's your turn to act

    if (playerCards.length === 2) {
      fetchOdds(playerCards, communityCards, getNumOpponents())
        .then((winProb) => updateOddsDisplay(winProb))
        .catch(() => updateOddsDisplay(-1));

      fetchHandOdds(playerCards, communityCards, 1000)
        .then((handOdds) => updateHandOddsDisplay(handOdds))
        .catch((err) => {
          console.error('[PokerNow Extension] Error fetching hand odds:', err);
        });
    }

    lastCommunityCardCount = communityCards.length;
  } catch (error) {
    console.error('[PokerNow Extension] Unexpected error:', error);
  }
}, REFRESH_INTERVAL_MS);

/************************************************
 * 3) Widget Injection & UI Update Functions
 ************************************************/
function injectOddsWidget() {
  function makeWidgetDraggable(widget) {
    widget.style.position = 'absolute';
    widget.style.cursor = 'move';
  
    let offsetX = 0;
    let offsetY = 0;
  
    widget.addEventListener('mousedown', (e) => {
      offsetX = e.clientX - widget.getBoundingClientRect().left;
      offsetY = e.clientY - widget.getBoundingClientRect().top;
      document.addEventListener('mousemove', moveWidget);
      document.addEventListener('mouseup', stopMovingWidget);
    });
  
    function moveWidget(e) {
      widget.style.left = `${e.clientX - offsetX}px`;
      widget.style.top = `${e.clientY - offsetY}px`;
    }
  
    function stopMovingWidget() {
      document.removeEventListener('mousemove', moveWidget);
      document.removeEventListener('mouseup', stopMovingWidget);
    }
  }
  const widget = document.createElement('div');
  widget.id = 'poker-odds-widget';
  widget.style.position = 'fixed';
  widget.style.top = '250px';
  widget.style.right = '20px';
  widget.style.zIndex = '9999';
  widget.style.backgroundColor = 'white';
  widget.style.border = '1px solid #ccc';
  widget.style.padding = '5px';
  widget.style.fontFamily = 'Arial, sans-serif';
  widget.style.width = '200px';
  widget.style.fontSize = '12px';
  widget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  widget.style.borderRadius = '8px';

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
  `;
  makeWidgetDraggable(widget);
  document.body.appendChild(widget);
}

function injectGameStateWidget() {
  function makeWidgetDraggable(widget) {
    widget.style.position = 'absolute';
    widget.style.cursor = 'move';
  
    let offsetX = 0;
    let offsetY = 0;
  
    widget.addEventListener('mousedown', (e) => {
      offsetX = e.clientX - widget.getBoundingClientRect().left;
      offsetY = e.clientY - widget.getBoundingClientRect().top;
      document.addEventListener('mousemove', moveWidget);
      document.addEventListener('mouseup', stopMovingWidget);
    });
  
    function moveWidget(e) {
      widget.style.left = `${e.clientX - offsetX}px`;
      widget.style.top = `${e.clientY - offsetY}px`;
    }
  
    function stopMovingWidget() {
      document.removeEventListener('mousemove', moveWidget);
      document.removeEventListener('mouseup', stopMovingWidget);
    }
  }
  const widget = document.createElement('div');
  widget.id = 'poker-game-state-widget';
  widget.style.position = 'fixed';
  widget.style.top = '250px';
  widget.style.left = '20px';
  widget.style.zIndex = '9999';
  widget.style.backgroundColor = 'white';
  widget.style.border = '1px solid #ccc';
  widget.style.padding = '5px';
  widget.style.fontFamily = 'Arial, sans-serif';
  widget.style.width = '200px';
  widget.style.fontSize = '12px';
  widget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  widget.style.borderRadius = '8px';

  widget.innerHTML = `
    <h4 style="margin:0 0 10px;">Poker Game State</h4>
    <div id="llm-suggestion" style="margin-top: 10px; color: blue;"><strong>LLM Suggestion:</strong> Waiting...</div>
  `;
  makeWidgetDraggable(widget)
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


/************************************************
 * 4) Parsing Game State from the DOM
 ************************************************/
function getGameState() {
  const blinds = getBlinds(); // Parse blinds
  const gameState = {
    playerCards: getPlayerCards(), // Retrieve player hole cards
    communityCards: getCommunityCards(), // Retrieve community cards
    playerPositions: getPlayerPositions(),
    playerBets: getPlayerBets(),
    playerStacks: getPlayerStacks(),
    potSize: getPotSize(),
    smallBlind: blinds.smallBlind,
    bigBlind: blinds.bigBlind,
  };
  return gameState;
}


function getPlayerPositions() {
  const seatsContainer = document.querySelector('.seats');
  if (!seatsContainer) {
    console.warn('[PokerNow Extension] Seats container not found.');
    return {};
  }

  const dealerButtonElement = seatsContainer.querySelector('.dealer-button-ctn');
  if (!dealerButtonElement) {
    console.warn('[PokerNow Extension] Dealer button not found.');
    return {};
  }

  const dealerClasses = Array.from(dealerButtonElement.classList);
  const dealerPositionClass = dealerClasses.find(cls => cls.startsWith('dealer-position-'));
  if (!dealerPositionClass) {
    console.warn('[PokerNow Extension] Dealer position class not found.');
    return {};
  }

  const dealerSeatNumber = parseInt(dealerPositionClass.split('-').pop(), 10);
  if (isNaN(dealerSeatNumber)) {
    console.warn('[PokerNow Extension] Dealer seat number could not be parsed.');
    return {};
  }

  const youElement = document.querySelector('.table-player.you-player .table-player-name a');
  const yourName = youElement ? youElement.textContent.trim() : 'Hero';

  const playerPositions = {};
  let currentSeat = dealerSeatNumber; // Start at dealer's seat
  const seatOrder = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'CO'];
  let positionIndex = 0;

  do {
    const playerEl = document.querySelector(`.table-player.table-player-${currentSeat}`);
    if (playerEl) {
      const nameEl = playerEl.querySelector('.table-player-name a');
      if (nameEl) {
        const playerName = nameEl.textContent.trim();
        const position = seatOrder[positionIndex % seatOrder.length] || 'Unknown';

        if (playerName === yourName) {
          playerPositions[`${playerName} (hero)`] = position;
        } else {
          playerPositions[`${playerName} (villain)`] = position;
        }

        positionIndex++;
      }
    }
    currentSeat = currentSeat === 10 ? 1 : currentSeat + 1; // Increment seat, loop back after seat 10
  } while (currentSeat !== dealerSeatNumber);

  return playerPositions;
}


function getPlayerBets() {
  const playerBets = {};
  document.querySelectorAll('.table-player').forEach(playerEl => {
    const nameEl = playerEl.querySelector('.table-player-name a');
    const betValueElement = playerEl.querySelector('.table-player-bet-value .chips-value .normal-value');
    const checkElement = playerEl.querySelector('.table-player-bet-value.check');

    if (nameEl) {
      const playerName = nameEl.textContent.trim();
      let betValue;

      if (checkElement) {
        betValue = 'Check';
      } else if (betValueElement) {
        betValue = parseInt(betValueElement.textContent.trim(), 10) || 0;
      }

      if (betValue !== undefined) {
        playerBets[playerName] = betValue;
      }
    }
  });
  return playerBets;
}

function getPlayerStacks() {
  const playerStacks = {};
  document.querySelectorAll('.table-player').forEach(playerEl => {
    const nameEl = playerEl.querySelector('.table-player-name a');
    const stackValueElement = playerEl.querySelector('.table-player-stack .chips-value .normal-value');
    if (nameEl && stackValueElement) {
      const playerName = nameEl.textContent.trim();
      const stackValue = parseInt(stackValueElement.textContent.trim(), 10) || 0;
      playerStacks[playerName] = stackValue;
    }
  });
  return playerStacks;
}

function getPotSize() {
  const potSizeElement = document.querySelector('.table-pot-size .main-value .normal-value');
  return potSizeElement ? parseInt(potSizeElement.textContent.trim(), 10) || 0 : 0;
}

function getPlayerCards() {
  const player1Cards = Array.from(document.querySelectorAll('.card-container.card-p1, .card-container.card-p2'));
  return player1Cards.map((card) => {
    const rank = card.querySelector('.value')?.textContent?.trim() || '';
    const suit = Array.from(card.querySelectorAll('.suit')).map(s => s.textContent.trim()).join('').toLowerCase();
    if (!rank || !suit) return null;
    return mapToDoubleSuitFormat(rank, suit);
  }).filter(Boolean);
}

function getCommunityCards() {
  const communityCards = Array.from(document.querySelectorAll('.card-container:not(.card-p1):not(.card-p2)'));
  return communityCards.map((card) => {
    const rank = card.querySelector('.value')?.textContent?.trim() || '';
    const suit = Array.from(card.querySelectorAll('.suit')).map(s => s.textContent.trim()).join('').toLowerCase();
    if (!rank || !suit) return null;
    return mapToDoubleSuitFormat(rank, suit);
  }).filter(Boolean);
}
function getNumOpponents(){
  const playerElements = document.querySelectorAll('.table-player'); // Select all players
  const youElement = document.querySelector('.table-player.you-player'); // Identify yourself

  if (!playerElements || playerElements.length === 0 || !youElement) {
    console.warn('[PokerNow Extension] Could not determine the number of players.');
    return 0;
  }

  // Filter players who haven't folded
  const activePlayers = Array.from(playerElements).filter(playerEl => {
    const isFolded = playerEl.classList.contains('fold'); // Check if the player has the `fold` class
    const statusIcon = playerEl.querySelector('.table-player-status-icon'); // Look for the status icon
    const hasFoldedStatus = statusIcon && statusIcon.textContent.trim().toLowerCase() === 'fold';

    return !isFolded && !hasFoldedStatus; // Exclude folded players
  });

  // Exclude yourself from the active players
  const numActiveOpponents = activePlayers.filter(playerEl => !playerEl.classList.contains('you-player')).length;
  console.log(`[PokerNow Extension] Number of active opponents: ${numActiveOpponents}`);
  return numActiveOpponents;
}

/************************************************
 * 5) Detect if it's Your Turn to Act
 ************************************************/

async function checkYourTurn(gameState) {
  const yourTurnElement = document.querySelector('.table-player.you-player.decision-current');
  const llmSuggestionWidget = document.getElementById('llm-suggestion');

  if (yourTurnElement) {


    // Call the LLM only if it hasn't been called yet
    if (!isLLMCalled) {
      isLLMCalled = true; // Set the flag to prevent further calls
      try {
        const suggestion = await queryLLM(gameState);
        llmSuggestionWidget.textContent = `LLM Suggestion: ${suggestion}`;
      } catch (error) {
        llmSuggestionWidget.textContent = 'LLM Suggestion: Error fetching suggestion';
        console.error('[PokerNow Extension] Error querying LLM:', error);
      }
    }
  } else {

    // Reset the flag when it's no longer your turn
    isLLMCalled = false;
  }
}
function getBlinds() {
  const blindContainer = document.querySelector('.blind-value-ctn'); // Find the container with blind values
  if (!blindContainer) {
    console.warn('[PokerNow Extension] Blind container not found.');
    return { smallBlind: null, bigBlind: null };
  }

  const blindValues = blindContainer.querySelectorAll('.chips-value .normal-value');
  if (!blindValues || blindValues.length < 2) {
    console.warn('[PokerNow Extension] Could not parse blind values.');
    return { smallBlind: null, bigBlind: null };
  }

  const smallBlind = parseInt(blindValues[0].textContent.trim(), 10) || null;
  const bigBlind = parseInt(blindValues[1].textContent.trim(), 10) || null;
  console.log(`[PokerNow Extension] Small Blind: ${smallBlind}, Big Blind: ${bigBlind}`);
  return { smallBlind, bigBlind };
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
 * 6) Query LLM for Suggestions
 ************************************************/
async function queryLLM(gameState) {
  const url = 'http://127.0.0.1:5000/query_llm';
  const playerCards = gameState.playerCards || [];
  const communityCards = gameState.communityCards || [];

  const message = `
  You are playing Texas Hold'em poker. Here is the current game state:
  - Small Blind: ${gameState.smallBlind || 'Unknown'} chips.
  - Big Blind: ${gameState.bigBlind || 'Unknown'} chips.
  - Pot size: ${gameState.potSize} chips.
  - Your hand: ${playerCards.length ? playerCards.join(', ') : 'None'}.
  - Community cards: ${communityCards.length ? communityCards.join(', ') : 'None'}.
  - Players at the table and their positions:
  ${Object.entries(gameState.playerPositions)
    .map(([player, position]) => `${player} is ${position} with a stack of ${gameState.playerStacks[player.split(' ')[0]]} chips and bet ${gameState.playerBets[player.split(' ')[0]] || 'No action yet'}`)
    .join('\n')}.

  Based on this information, provide the optimal action for me to take. Return only the following:
  1. Probabilities for folding, calling, and raising (in percentages).
  2. A brief explanation (maximum two sentences) for why this is the best course of action.

  Example output:
  Fold: 30%, Call: 40%, Raise: 30%
  Explanation: Based on your hand and pot odds, calling is recommended due to the high chance of improving on the flop.
`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
    const data = await resp.json();
    return data.response;
  } catch (err) {
    console.error('[PokerNow Extension] Error querying LLM:', err);
    throw err;
  }
}


/************************************************
 * 7) Helper Function to Format Cards
 ************************************************/
function mapToDoubleSuitFormat(rankStr, suitStr) {
  const suitMap = {
    '♠': 'ss','s': 'ss','spade': 'ss','spades': 'ss',
    '♣': 'cc','c': 'cc','club': 'cc','clubs': 'cc',
    '♦': 'dd','d': 'dd','diamond': 'dd','diamonds': 'dd',
    '♥': 'hh','h': 'hh','heart': 'hh','hearts': 'hh'
  };

  const rank = rankStr.toUpperCase(); 
  const s = suitMap[suitStr.toLowerCase()] || suitStr; // fallback

  return `${rank}${s || ''}`;
}
