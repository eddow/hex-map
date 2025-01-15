import {
	AmbientLight,
	Clock,
	DirectionalLight,
	Group,
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
} from 'three'
import type { Character } from '~/character'
import type { Land } from './land'

export class Game {
	private _characters = new Set<Character>()
	private charactersGroup = new Group()
	public readonly lights = new Group()
	public readonly scene = new Scene()
	private clock = new Clock(false)
	private _land: Land
	private views = new Set<GameView>()

	constructor(land: Land) {
		this._land = land
		this.scene = new Scene()
		this.scene.add(this.lights, land.group, this.charactersGroup)
		this.lights.add(new AmbientLight(0x404040))
		const light = new DirectionalLight(0xffffff, 1)
		light.position.set(10, 10, 10)
		this.lights.add(light)
	}
	characters() {
		return this._characters.values()
	}
	addCharacter(character: Character) {
		this._characters.add(character)
		this.charactersGroup.add(character.mesh)
	}
	get land() {
		return this._land
	}
	set land(value) {
		this.scene.remove(this._land.group)
		this.scene.add(value.group)
		this._land = value
	}
	progress(dt: number) {
		for (const character of this._characters) character.progress(dt)
		this.land.progress(dt)
	}
	stop() {
		this.clock.stop()
	}
	start(cb?: (dt: number) => void) {
		this.clock.start()
		const animate = () => {
			if (!this.clock.running) return
			const dt = this.clock.getDelta()
			requestAnimationFrame(animate)
			//hoveredSpecs.interaction?.animate?.(dt)
			this.progress(dt)
			cb?.(dt)
			for (const view of this.views) view.render()
		}

		requestAnimationFrame(animate)
	}
	createView({ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 1000 }) {
		const view = new GameView(this, { near, far })
		this.views.add(view)
		return view
	}
	removeView(view: GameView) {
		this.views.delete(view)
	}
}

export class GameView {
	public readonly camera
	private readonly renderer
	constructor(
		public readonly game: Game,
		{ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 1000 }
	) {
		this.camera = new PerspectiveCamera(75, 1, near, far)
		this.renderer = new WebGLRenderer({ antialias: true })
	}
	get domElement() {
		return this.renderer.domElement
	}
	resize(width: number, height: number) {
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(width, height)
	}
	render() {
		// Don't rely on the `dispose` mechanism to stop rendering on a canvas when they are removed
		const canvas = this.renderer.domElement
		if (!document.body.contains(canvas) || canvas.offsetWidth === 0 || canvas.offsetHeight === 0)
			return
		const style = window.getComputedStyle(canvas)
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return
		this.renderer.render(this.game.scene, this.camera)
	}
}
