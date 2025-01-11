import { defineConfig } from "vite";
import {resolve} from 'path'

export default defineConfig({
	root: "./",
	build: {
		target: "esnext", // Adjust target as needed
	},
	optimizeDeps: {
		include: ["three"], // Example for including external dependencies
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, './src'),
		},
	}
});
