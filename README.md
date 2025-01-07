# PokerNowUI-
PokerNow UI developed for software engineering project.


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
