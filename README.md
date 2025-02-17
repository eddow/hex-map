# Hexa-game

Sand-boxing tool for strategical hexagonal board games.

The idea is to have room to write terrain generation (and show it), a 3D environment with mouse events on the 3D entities, an easy way to add an UI (svelte) and ways to sandbox ideas on that topic

[Demo](https://hexboard.netlify.app/)

## Installation

`npm i` blah blah

> Build `packages/hexaboard` *before* trying `apps/hexagame` ! (it has a vite plugin)

### Ubuntu

```bash
# 1. Add Google Repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | \
sudo tee /etc/apt/sources.list.d/google-chrome.list

# 2. Add Google Signing Key
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg

# 3. Update and Install
sudo apt update
sudo apt install google-chrome-stable

google-chrome
```