// For sole purpose to use conditional breakpoints
export class DMap<K, V> extends Map<K, V> {
	clear() {
		return super.clear()
	}
	delete(key: K) {
		return super.delete(key)
	}
	entries() {
		return super.entries()
	}
	forEach(callbackfn: (value: V, key: K, map: DMap<K, V>) => void, thisArg?: any) {
		return super.forEach(callbackfn, thisArg)
	}
	get(key: K) {
		return super.get(key)
	}
	has(key: K) {
		return super.has(key)
	}
	keys() {
		return super.keys()
	}
	set(key: K, value: V) {
		return super.set(key, value)
	}
	values() {
		return super.values()
	}
}
