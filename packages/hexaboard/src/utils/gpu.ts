import createWebGpGpu, { WebGpGpu, WebGpuNotSupportedError, type RootWebGpGpu } from 'webgpgpu.ts'

const shaders: Record<string, string> = {}
const shaderImports = import.meta.glob('../wgsl/*.wgsl', { query: '?raw', eager: true })

for (const path in shaderImports)
	shaders[/\/([^\/]*)\.wgsl/.exec(path)![1]] = (shaderImports[path] as any).default as string

WebGpGpu.defineImports(shaders)
export const webGpGpu = createWebGpGpu()
webGpGpu.catch((e) => {
	if (
		e instanceof WebGpuNotSupportedError &&
		confirm(
			`Your browser does not (yet) support WebGPU.
Click on «ok» to be redirected to https://caniuse.com/webgpu`
		)
	)
		window.location.href = 'https://caniuse.com/webgpu'
})

export default async function gpu<T>(ctor: (wgg: RootWebGpGpu) => T) {
	return ctor(await webGpGpu)
}
