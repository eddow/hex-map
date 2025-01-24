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
