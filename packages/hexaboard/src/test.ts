import createWebGpGpu, { f32 } from 'webgpgpu.ts'

async function main() {
	const webGpGpu = await createWebGpGpu()

	const kernel = webGpGpu
		.input({
			myUniform: f32,
			data: f32.array('threads.x'),
		})
		.output({ produced: f32.array('threads.x') })
		.kernel('produced[thread.x] = myUniform * data[thread.x];')

	const { produced } = await kernel({
		myUniform: 2,
		data: [1, 2, 3, 4, 5],
	})
	// produced -> [2, 4, 6, 8, 10]
	console.log(produced.flat())
}
main()
