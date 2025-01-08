# PokerNowUI-
PokerNow UI developed for software engineering project.

What this UI does:

This UI contains two parts, the first is a simple odds calculation for poker hands. We have that for a certain hand(cards you have) and community hards we calculate the odds you hit a certain poker hand(For example one pair, two pair, straight etc..) and display it. Additionally we do a simple simulation where we take your hand and community cards plus number of opponents then simulate how often you win against them using PyPokerEngines estimate_hole_card_win_rate function. The second part of the UI is using LLM's to give advice on what action to take based on your position, the money in the pot, your hand and community cards, players bets and the value of the big blind and small blind. We query the LLM with this information and ask the LLM to return what they think is the best action(Right now we ask to return frequencies at which you should be making actions, eg: Call 40%, Fold 30%, Raise 20%) based on this information. Note that these recommended actions could be inaccurate depending on the LLM you choose to use(We use GPT-4 in our examples but you can easily change the code to use other LLMs). I believe that where this method will truly shine is if somebody fine-tuned an LLM for poker play then used this fine-tuned LLM in our context. 

Note: If you don't have an OpenAI API key the LLM functionality won't work for you(as written), but the hand odds and win percentage will still work. Alternatively if you have a hugginface API key you can easily replace the code to work with the LLM of your choice on huggingface. Fair warning I tried some LLMs on huggingface and many of them give bad responses in this context


Instructions for usage: <br />

1) Clone the repository on your machine, then cd to the directory with the files in it

2) Set up a virtual environment as follows: <br />
        Type python3 -m venv venv then follow it by typing <br />
        source venv/bin/activate  # On macOS <br />
3) Install dependencies: <br />
       Type into your terminal: <br />
       pip install openai==0.28, <br />
       pip install Flask, <br />
       pip install Flask-CORS, <br />
       pip install PyPokerEngine, <br />
4) Add the extension to google chrome: <br />
       Open Google Chrome and navigate to chrome://extensions/. <br />
        Enable Developer Mode (toggle switch in the top-right corner). <br />
        Click "Load Unpacked" and select the extension folder then load it <br />
5) Use the extension: <br />
     Type python server.py into your terminal then load any game in pokernow and it should be working!

        
