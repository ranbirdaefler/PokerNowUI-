from flask import Flask, request, jsonify
from flask_cors import CORS
import random
from pypokerengine.utils.card_utils import estimate_hole_card_win_rate
from pypokerengine.engine.card import Card

app = Flask(__name__)
CORS(app)

# Normalize the card input for pypokerengine
SUITS = {'h': 'H', 'd': 'D', 'c': 'C', 's': 'S'}
RANKS = {
    '2': '2','3': '3','4': '4','5': '5','6': '6','7': '7',
    '8': '8','9': '9','10': 'T','J': 'J','Q': 'Q','K': 'K','A': 'A'
}

def normalize_card(card):
    """
    Example: '4dd' -> 'D4', '7hh' -> 'H7', '10dd' -> 'DT'
    - rank = card[:-2].upper()  => e.g. '4', '7', '10' 
    - suit = card[-2:].lower()  => e.g. 'dd', 'hh'
    Then we pick the first letter of suit => 'd' => 'D'
    The rank '4' => '4' from RANKS dict => '4', '7' => '7', '10' => 'T'
    Final => 'D4', 'H7', 'DT'
    """
    rank = card[:-2].upper()
    suit = card[-2:].lower()
    # If suit has 2 letters (e.g. 'dd'), just take the 1st
    # e.g. 'hh' => 'h', 'dd' => 'd'
    if len(suit) > 1:
        suit = suit[0]

    normalized_rank = RANKS.get(rank, rank)
    normalized_suit = SUITS.get(suit, suit.upper())
    return f"{normalized_suit}{normalized_rank}"


###################### HAND CLASSIFICATION / SIMULATION ######################
def best_5card_classification(cards_7):
    """
    Simplified classification for:
      one_pair, two_pair, three_of_a_kind, straight, flush, full_house
    Returns the highest category that applies, else 'none'.
    """
    from collections import Counter

    # Convert the 7 "D4"/"H7" strings to Card objects?
    # Actually in the rest of the code, we create Card objects from them.
    # But for classification, let's do a quick rank/suit counting approach.
    # We'll do it directly on the 'D4' etc. Or better, let's build Card objects:

    # Actually, each item is something like "D4" => suit='D', rank='4'.
    # We can parse them if needed, but let's assume we already have Card objects
    # if the rest of the code calls Card(suit, rank). We'll do a simpler approach:
    import re

    # We assume each c is a pypokerengine Card object
    suits_count = {}
    ranks_count = {}
    rank_values = []

    rank_order_map = {
        'A': 14,'K': 13,'Q': 12,'J': 11,'T': 10,
        '9': 9,'8': 8,'7': 7,'6': 6,'5': 5,
        '4': 4,'3': 3,'2': 2
    }

    for c in cards_7:
        # c is a Card object => c.suit, c.rank
        suits_count[c.suit] = suits_count.get(c.suit, 0) + 1
        ranks_count[c.rank] = ranks_count.get(c.rank, 0) + 1
        rank_values.append(c.rank)

    is_flush = any(count >= 5 for count in suits_count.values())

    # Build a sorted set of numeric rank values for straight detection
    numeric_vals = sorted(set(rank_order_map[r] for r in rank_values), reverse=True)

    def has_straight(vals):
        if len(vals) < 5:
            return False
        for i in range(len(vals)-4):
            if vals[i] - vals[i+4] == 4:
                return True
        # Ace-low check
        if 14 in vals and {2,3,4,5} <= set(vals):
            return True
        return False

    is_straight = has_straight(numeric_vals)

    pairs = 0
    trips = 0
    for v in ranks_count.values():
        if v == 2:
            pairs += 1
        elif v == 3:
            trips += 1

    is_full_house = (trips >= 1 and pairs >= 1)

    # Order of priority: full_house > flush > straight > trips > two_pair > one_pair
    if is_full_house:
        return "full_house"
    if is_flush:
        return "flush"
    if is_straight:
        return "straight"
    if trips >= 1:
        return "three_of_a_kind"
    if pairs >= 2:
        return "two_pair"
    if pairs == 1:
        return "one_pair"
    return "none"


def simulate_hand_outcomes(hole_cards, community_cards, nb_simulations=1000):
    """
    hole_cards, community_cards are strings like ['4dd','10dd','7hh'] etc.
    We'll parse them into PyPokerEngine Card objects, then do random draws for the rest of the board.
    Then classify final 7-card combos.
    """
    from pypokerengine.engine.card import Card

    # Convert each input string to e.g. 'D4' => Card('D','4')
    hole_py = []
    for hc in hole_cards:
        norm = normalize_card(hc)   # e.g. 'D4'
        # suit='D', rank='4'
        suit_letter = norm[0]
        rank_letter = norm[1]
        hole_py.append(Card(suit_letter, rank_letter))

    comm_py = []
    for cc in community_cards:
        norm = normalize_card(cc)
        suit_letter = norm[0]
        rank_letter = norm[1]
        comm_py.append(Card(suit_letter, rank_letter))

    used = hole_py + comm_py

    # Build deck of 52 minus used
    all_suits = ['C','D','H','S']
    all_ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A']
    full_deck = []
    for s in all_suits:
        for r in all_ranks:
            full_deck.append(Card(s, r))

    deck = [c for c in full_deck if c not in used]
    needed = 5 - len(comm_py)

    outcomes_count = {
        "one_pair":0, "two_pair":0, "three_of_a_kind":0,
        "straight":0,"flush":0,"full_house":0,"none":0
    }

    for _ in range(nb_simulations):
        drawn = random.sample(deck, needed) if needed > 0 else []
        final_community = comm_py + drawn
        all_7 = hole_py + final_community
        cat = best_5card_classification(all_7)
        outcomes_count[cat]+=1

    results = {}
    for k in ["one_pair","two_pair","three_of_a_kind","straight","flush","full_house"]:
        results[k] = outcomes_count[k]/nb_simulations*100.0
    return results


@app.route('/calculate_hand_odds', methods=['POST'])
def calculate_hand_odds():
    """
    JSON:
    {
      "playerCards": ["4dd", "10dd"],   # e.g. rank= '4', suit= 'dd' => => 'D4'
      "communityCards": ["7hh","3ss"],
      "numSimulations": 1000
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error":"No input"}),400

    hole = data.get("playerCards",[])
    comm = data.get("communityCards",[])
    nb_sims = data.get("numSimulations",1000)

    try:
        stats = simulate_hand_outcomes(hole, comm, nb_sims)
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error":str(e)}),500


@app.route('/calculate_odds', methods=['POST'])
def odds_endpoint():
    """
    Example payload:
      {
        "playerCards": ["4dd","10dd"],
        "communityCards": ["7hh","3ss"],
        "numOpponents": 1
      }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input received"}), 400

    player_cards = data.get('playerCards', [])
    community_cards = data.get('communityCards', [])
    num_opponents = data.get('numOpponents', 1)

    try:
        from pypokerengine.utils.card_utils import gen_cards
        # 1) normalize each string => e.g. '4dd' => 'D4'
        # 2) pass to gen_cards
        norm_hole = [normalize_card(c) for c in player_cards]  # e.g. ['D4','DT']
        norm_community = [normalize_card(c) for c in community_cards] if community_cards else []
        hole_py = gen_cards(norm_hole)
        comm_py = gen_cards(norm_community)
        win_rate = estimate_hole_card_win_rate(
            nb_simulation=1000,
            nb_player = num_opponents + 1,
            hole_card=hole_py,
            community_card=comm_py
        )
        return jsonify({'winProbability': win_rate*100})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/update_player_stats', methods=['POST'])
def update_player_stats():
    data = request.get_json()
    app.logger.debug(f"Received player stats: {data}")
    return jsonify({"status":"Player stats received","data":data}),200


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
