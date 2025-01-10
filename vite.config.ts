import { defineConfig } from "vite";

export default defineConfig({
	root: "./",
	build: {
		target: "esnext", // Adjust target as needed
	},
	optimizeDeps: {
		include: ["three"], // Example for including external dependencies
	},
});
