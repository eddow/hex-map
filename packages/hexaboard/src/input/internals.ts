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
	SwitchableConfiguration,
} from './actions'
import type { ModKeyCombination, MouseButton, MouseButtons } from './types'

export type AnyConfiguration =
	| ActionConfiguration
	| OneButtonConfiguration
	| MouseDeltaConfiguration
	| MouseHoverConfiguration
	| KeyPressConfiguration
	| OneWheelConfiguration
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

export function switchConfiguration<Options, Values extends {}>(
	configured: SwitchableConfiguration<Options, Values>,
	state: Options
): Values | {} | false {
	if (Array.isArray(configured)) {
		const index = configured.findIndex(({ on }) => on === state)
		if (index < 0 || index === undefined) return {}
		return configured[index].use
	}
	return configured === state ? {} : false
}

export function configuration2event(
	config: AnyConfiguration,
	state: InputState,
	eventBase: D3InputEvent,
	dt: number,
	actionState: any
): D3InputEvent | undefined {
	const modConfig = switchConfiguration(config.modifiers, state.modifiers)
	if (modConfig)
		return configurationTransformer[config.type]?.(
			{ ...config, ...modConfig },
			state,
			eventBase,
			dt,
			actionState
		)
}

// #endregion
