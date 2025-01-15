import type {
	CreateComponentOptions,
	GroupPanelPartInitParameters,
	IContentRenderer,
	PanelUpdateEvent,
	Parameters,
} from 'dockview-core'
import { type Component, type Snippet, mount } from 'svelte'

export const dvContext: unique symbol = Symbol('Dockview dvContext')
export interface IDockviewContext {
	registerComponent(name: string, snippet: Snippet<[Record<string, any>]>): Component
}
abstract class AbstractRenderer implements IContentRenderer {
	readonly element: HTMLElement
	constructor(public readonly id: string) {
		this.element = document.createElement('div')
		this.element.className = 'dv-svelte-part'
		this.element.style.height = '100%'
		this.element.style.width = '100%'
	}
	abstract init(parameters: GroupPanelPartInitParameters): void
}
export class ContentRenderer<Parameters extends Record<string, any>> extends AbstractRenderer {
	constructor(
		id: string,
		public readonly renderer: Component<Parameters>,
		private readonly props: Partial<Parameters> = {}
	) {
		super(id)
	}
	init(parameters: GroupPanelPartInitParameters): void {
		mount(this.renderer, {
			target: this.element,
			props: { ...this.props, ...parameters.params } as Parameters,
		})
	} /*
	layout?(width: number, height: number): void {
		//throw new Error('Method not implemented.')
	}
	update?(event: PanelUpdateEvent<Parameters>): void {
		//throw new Error('Method not implemented.')
	}
	toJSON?(): object {
		//throw new Error('Method not implemented.')
	}
	focus?(): void {
		//throw new Error('Method not implemented.')
	}
	dispose?(): void {
		//throw new Error('Method not implemented.')
	}*/
}
