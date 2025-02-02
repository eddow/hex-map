# Ways to manage the mouse

There are two ways to manage the mouse, they can even be combined

## Mouse events

```ts
type HandledMouseEvents<Handle extends MouseHandle | undefined = MouseHandle> = {
	'mouse:move': (evolution: MouseMoveEvolution<Handle>) => void
	'mouse:click': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:up': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:down': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:startDrag': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragCancel': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragOver': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragDrop': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:enter': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:hover': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:leave': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:wheel': (evolution: MouseWheelEvolution<Handle>) => void
}

type MouseEvents = HandledMouseEvents<MouseHandle | undefined> & {
	'mouse:lock': (evolution: MouseLockingEvolution) => void
	'mouse:unlock': (evolution: MouseLockingEvolution) => void
}
```

### Handles

The `MouseHandle` is the object that is being hovered or clicked. It is created at the beginning of the mouse events and destroyed at the end of them.

- `TileHandle` Specify a tile of the game
- `RoadHandle` Specify a road between two adjacent tiles

## Access: Game

The `Game` object is event-ful for mouse and receive even the un-handled (locking) mouse events

## Access: `LandPart` and `Landscape`

These emit the mouse events with the mouse handles they generate

```ts
const grid = new ColorRoadGrid(land, roadTypes)
...
grid.on('mouse:hover', (ev: MouseHoverEvolution<RoadHandle>)=> {...})
grid.on('mouse:click', (ev: MouseButtonEvolution<RoadHandle>)=> {...})
```

