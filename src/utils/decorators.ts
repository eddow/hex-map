const cachedValues = Symbol('cachedValues')
export function cached<TThis extends Cacheable, TReturn>(
	originalGetter: (this: TThis) => TReturn,
	context: ClassGetterDecoratorContext<TThis, TReturn>
) {
	return function (this: TThis): TReturn {
		return this.cached(context.name, () => originalGetter.call(this))
	}
}

export class Cacheable {
	[cachedValues]: Record<PropertyKey, any> = {}
	invalidate(valueName: PropertyKey) {
		const cached = this[cachedValues]
		if (cached) delete cached[valueName]
	}
	cached<TReturn>(valueName: PropertyKey, getter: () => TReturn): TReturn {
		const cached = this[cachedValues]
		if (!(valueName in cached)) cached[valueName] = getter.call(this)
		return cached[valueName]
	}
}
