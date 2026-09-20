# Berzerk personalization

cartridge-controls.json declares Coin / Start / 2 Players key mappings.
The controls appear at the top right, away from centered Fire. The movable
circle pad recenters when released. Landscape uses full viewport height.

The adapter imports the repository's TSRun modules and local ROMs, and loads
assets/berzerk.dck. Replace that cartridge to update the game. The adapter
maps TSRun fire bit7 to this cartridge's bit4 and selects the touch joystick
using CURRENT_PLAYER at HOME $7802. Host gamepads retain separate ports.
