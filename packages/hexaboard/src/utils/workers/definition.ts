import type { FunctionParts, WorkerExposition } from './usage'

export type { FunctionParts }
export function makeFunction<Fct extends (...args: any[]) => Promise<any> | any>(
	parts: FunctionParts
) {
	return new Function(parts.args, parts.body) as Fct
}

export function exposeThreadTask<Fct extends (...args: any[]) => Promise<any> | any>(fn: Fct) {
	self.onmessage = async ({ data: { compute } }: MessageEvent<{ compute: Parameters<Fct> }>) => {
		try {
			if (compute) postMessage({ result: await fn.apply(self, compute) })
		} catch (err: any) {
			postMessage({ error: err.message, stack: err.stack })
		}
	}
}

export function exposeAllocatedWorker<Exposition extends WorkerExposition>(exposition: Exposition) {
	self.onmessage = async ({
		data: { fn, args },
	}: MessageEvent<{ fn: keyof Exposition; args: any[] }>) => {
		try {
			if (exposition[fn]) postMessage({ result: await exposition[fn].apply(self, args) })
			else postMessage({ error: `Unknown function provided: ${String(fn)}` })
		} catch (err: any) {
			postMessage({ error: err.message, stack: err.stack })
		}
	}
}
