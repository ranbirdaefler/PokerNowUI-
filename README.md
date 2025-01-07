# PokerNowUI-
PokerNow UI developed for software engineering project.


Instructions for usage:

1) Clone the repository on your machine, then cd to the directory with the files in it

2) Set up a virtual environment as follows:
        python3 -m venv venv
        source venv/bin/activate  # On macOS
3) Install dependencies:
       Type into your terminal:
       pip install openai
       pip install Flask
       pip install Flask-CORS
       pip install PyPokerEngine
4) Add the extension to google chrome:
       Open Google Chrome and navigate to chrome://extensions/.
        Enable Developer Mode (toggle switch in the top-right corner).
        Click "Load Unpacked" and select the extension folder then load it
5) Use the extension:
     Type python server.py into your terminal then load any game in pokernow and it should be working!
