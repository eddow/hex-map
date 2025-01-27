import { debugInformation } from './debug'

export function cached<T>(...needed: PropertyKey[]) {
	return (original: () => T, context: ClassGetterDecoratorContext<unknown, T>) => {
		return function (this: any) {
			const missing = needed.filter((p) => !isCached(this, p))
			const stringName = context.name.toString()
			if (missing.length)
				throw new Error(`Missing properties to calculate ${stringName}: ${missing.join(', ')}`)
			const rv = original.call(this)
			cache(this, context.name, rv)
			return rv
		}
	}
}

export function isCached(object: Object, propertyKey: PropertyKey) {
	return !!Object.getOwnPropertyDescriptor(object, propertyKey)
}

export function cache(object: Object, propertyKey: PropertyKey, value: any) {
	Object.defineProperty(object, propertyKey, { value })
}

const performanceMeasures: Record<string, PerformanceMeasure[]> = {}

export function resetPerformances() {
	for (const k of Object.keys(performanceMeasures)) performanceMeasures[k] = []
}
export function logPerformances() {
	for (const k in performanceMeasures) debugInformation.set(`perf:${k}`, performanceMeasure(k))
	resetPerformances()
}

export function performanceMeasure(name: string) {
	if (!(performanceMeasures[name] ?? []).length)
		return { duration: 0, occurrences: 0, mean: Number.NaN }
	const rv = performanceMeasures[name].reduce(
		(acc, m) => ({ duration: acc.duration + m.duration, occurrences: acc.occurrences + 1 }),
		{ duration: 0, occurrences: 0 }
	)
	return {
		...rv,
		mean: rv.duration / rv.occurrences,
	}
}

export function performanceMeasured(name: string) {
	return (original: (...args: any[]) => any) => {
		const start = `${name}-start`
		return function perf(this: any, ...args: any[]) {
			performance.mark(start)
			const rv = original.call(this, ...args)
			performanceMeasures[name] ??= []
			performanceMeasures[name].push(performance.measure(name, start))
			return rv
		}
	}
	//return (t) => t
}
