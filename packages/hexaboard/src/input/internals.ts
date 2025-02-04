import type { Vector2Like } from 'three'
import type {
	ActionConfiguration,
	D3InputEvent,
	KeyPairPressConfiguration,
	KeyPressConfiguration,
	KeyQuadPressConfiguration,
	MouseDeltaConfiguration,
	MouseHoverConfiguration,
	OneButtonConfiguration,
	OneWheelConfiguration,
	TwoWheelsConfiguration,
} from './actions'
import type { ModKeyCombination, MouseButton, MouseButtons } from './types'

export function sameModifiers(a: ModKeyCombination, b: ModKeyCombination): boolean {
	return a.alt === b.alt && a.ctrl === b.ctrl && a.shift === b.shift
}

export type AnyConfiguration =
	| ActionConfiguration
	| OneButtonConfiguration
	| MouseDeltaConfiguration
	| MouseHoverConfiguration
	| KeyPressConfiguration
	| OneWheelConfiguration
	| TwoWheelsConfiguration
	| KeyPairPressConfiguration
	| KeyQuadPressConfiguration

export interface InputState {
	buttons: MouseButtons
	modifiers: ModKeyCombination
	deltaMouse?: Vector2Like
	deltaWheel?: Vector2Like
	button?: MouseButton
	keyCode?: string
	keysDown: Record<string, boolean>
}

export type ActionState = Record<string, any>

// #region Transformers

const configurationTransformer: Record<
	string,
	(
		config: AnyConfiguration,
		state: InputState,
		eventBase: D3InputEvent,
		dt: number,
		actionState: any
	) => D3InputEvent | undefined
> = {}

export function transformers(
	nt: Record<
		string,
		(
			config: AnyConfiguration,
			state: InputState,
			eventBase: D3InputEvent,
			dt: number,
			actionState: any
		) => D3InputEvent | undefined
	>
) {
	Object.assign(configurationTransformer, nt)
}

export function configuration2event(
	config: AnyConfiguration,
	state: InputState,
	eventBase: D3InputEvent,
	dt: number,
	actionState: any
): D3InputEvent | undefined {
	if (Array.isArray(config.modifiers)) {
		const index = config.modifiers.findIndex(({ on }) => sameModifiers(on, state.modifiers))
		if (index < 0 || index === undefined) return
		config = { ...config, ...config.modifiers[index].use }
	} else if (!sameModifiers(config.modifiers, state.modifiers)) return
	return configurationTransformer[config.type]?.(config, state, eventBase, dt, actionState)
}

// #endregion
