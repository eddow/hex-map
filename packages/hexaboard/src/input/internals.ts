import type { IVector2Like } from '@babylonjs/core'
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
import type { ModKeyCombination, MouseButton, MouseButtons } from './d2buffer'

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
	deltaMouse?: IVector2Like
	deltaWheel?: IVector2Like
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
		// `true` when no event is risen but conditions are (ex: delta-mouse when delta=0 : for locking)
	) => D3InputEvent | undefined | true
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
		) => D3InputEvent | undefined | true
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
): D3InputEvent | undefined | true {
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
