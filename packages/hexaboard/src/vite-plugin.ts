import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { ViteDevServer } from 'vite'

export default {
	name: 'serve-hexaboard-workers',
	configureServer: (server: ViteDevServer): void => {
		server.middlewares.use(async (req, res, next) => {
			if (req.url?.startsWith('/assets/')) {
				const hexaboardPath = dirname(
					new URL(await import.meta.resolve('hexaboard'), import.meta.url).pathname
				)
				console.log(await import.meta.resolve('hexaboard'), import.meta.url)
				const filePath = resolve(
					hexaboardPath,
					req.url.startsWith('/') ? req.url.slice(1) : req.url
				)
				if (fs.existsSync(filePath)) {
					res.writeHead(200, {
						'Content-Type': 'application/javascript',
						'Cache-Control': 'public, max-age=31536000, immutable', // Cache forever
					})

					fs.createReadStream(filePath).pipe(res)
					return
				}
				res.writeHead(404)
				res.write(`Not found: ${filePath}`)
				return
			}
			next()
		})
	},
} as Plugin
