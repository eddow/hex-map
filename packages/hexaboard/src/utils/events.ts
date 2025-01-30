export class Eventful<Events extends Record<string, (...args: any[]) => void>> {
	public readonly events = new Map<
		keyof Events,
		((...args: Parameters<Events[keyof Events]>) => void)[]
	>()
	public on(events: Partial<Events>): void
	public on<EventType extends keyof Events>(event: EventType, cb: Events[EventType]): () => void
	public on<EventType extends keyof Events>(
		eventOrEvents: EventType | Partial<Events>,
		cb?: Events[EventType]
	): () => void {
		if (typeof eventOrEvents === 'object') {
			for (const e of Object.keys(eventOrEvents) as (keyof Events)[]) {
				this.on(e, eventOrEvents[e]!)
			}
		} else if (cb !== undefined) {
			let callbacks = this.events.get(eventOrEvents)
			if (!callbacks) {
				callbacks = []
				this.events.set(eventOrEvents, callbacks)
			}
			callbacks.push(cb)
		}
		// @ts-expect-error Generic case leads to generic case
		return () => this.off(eventOrEvents, cb)
	}
	public off(events: Partial<Events>): void
	public off<EventType extends keyof Events>(event: EventType, cb?: Events[EventType]): void
	public off<EventType extends keyof Events>(
		eventOrEvents: EventType | Partial<Events>,
		cb?: Events[EventType]
	): void {
		if (typeof eventOrEvents === 'object') {
			for (const e of Object.keys(eventOrEvents) as (keyof Events)[]) {
				this.off(e, eventOrEvents[e])
			}
		} else if (cb !== null && cb !== undefined) {
			const callbacks = this.events.get(eventOrEvents)
			if (callbacks) {
				this.events.set(
					eventOrEvents,
					callbacks.filter((c) => c !== cb)
				)
			}
		}
	}
	public emit<EventType extends keyof Events>(
		event: EventType,
		...args: Parameters<Events[EventType]>
	) {
		const callbacks = this.events.get(event)
		if (callbacks)
			for (const cb of callbacks) {
				cb(...args)
			}
	}
}
