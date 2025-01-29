<script lang="ts">
	import { MouseButtons } from 'hexaboard'

	let configuring: number | undefined = $state(undefined)
	let configured: number = $state(0)
	MouseButtons
	function mouseDown(e: MouseEvent) {
		e.preventDefault()
		configuring = e.buttons
	}
	function mouseUp(e: MouseEvent) {
		e.preventDefault()
		if (e.buttons === 0) {
			configured = configuring!
			configuring = undefined
		}
	}
	function hasButton(button: number) {
		return ((configuring ?? configured) & button) === button
	}
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	shape-rendering="geometricPrecision"
	text-rendering="geometricPrecision"
	image-rendering="optimizeQuality"
	fill-rule="evenodd"
	clip-rule="evenodd"
	viewBox="0 0 320 210"
	onmousedown={mouseDown}
	onmouseup={mouseUp}
	oncontextmenu={(e) => e.preventDefault()}
	role="button"
	tabindex="0"
	style="width: 5rem"
>
	<g fill-rule="nonzero">
		<path
			d="M 299.874 187.99 L 177.974 187.99 L 177.974 154.12 C 187.934 150.46 195.134 140.85 195.134 129.64 L 195.134 91.92 C 195.134 80.71 187.954 71.09 177.974 67.43 L 177.974 18.17 L 186.764 18.17 C 217.864 18.17 246.144 30.9 266.644 51.4 C 287.144 71.9 299.874 100.18 299.874 131.28 L 299.874 187.99 Z M 160.174 67.44 C 150.184 71.11 143.014 80.75 143.014 91.92 L 143.014 129.64 C 143.014 140.8 150.214 150.44 160.174 154.12 L 160.174 187.99 L 39.034 187.99 L 38.274 188.03 L 38.274 131.28 C 38.274 100.18 51.004 71.9 71.514 51.4 C 92.014 30.9 120.294 18.17 151.384 18.17 L 160.174 18.17 L 160.174 67.44 Z M 19.875 206.245 C 62.391 205.813 272.631 205.741 318.273 205.636 L 317.664 131.28 C 317.664 95.27 302.944 62.54 279.224 38.82 C 255.504 15.1 222.764 0.38 186.764 0.38 L 151.384 0.38 C 115.374 0.38 82.644 15.11 58.934 38.82 C 35.214 62.54 20.484 95.27 20.484 131.28 L 19.875 206.245 Z"
		>
		</path>
		{#if hasButton(MouseButtons.Left)}
			<path
				fill="#FFF185"
				d="M 160.174 18.17 L 151.384 18.17 C 120.294 18.17 92.014 30.9 71.514 51.4 C 51.004 71.9 38.274 100.18 38.274 131.28 L 38.274 188.03 L 39.034 187.99 L 160.174 187.99 L 160.174 154.12 C 150.214 150.44 143.014 140.8 143.014 129.64 L 143.014 91.92 C 143.014 80.75 150.184 71.11 160.174 67.44 L 160.174 18.17 Z"
			>
			</path>
		{/if}
		{#if hasButton(MouseButtons.Right)}
			<path
				fill="#FFF185"
				d="M 177.974 18.17 L 177.974 67.43 C 187.954 71.09 195.134 80.71 195.134 91.92 L 195.134 129.64 C 195.134 140.85 187.934 150.46 177.974 154.12 L 177.974 187.99 L 299.874 187.99 L 299.874 131.28 C 299.874 100.18 287.144 71.9 266.644 51.4 C 246.144 30.9 217.864 18.17 186.764 18.17 L 177.974 18.17 Z"
			>
			</path>
		{/if}
		{#if hasButton(MouseButtons.Middle)}
			<path
				fill="#FFF185"
				d="M 169.077 70.988 C 180.367 70.988 189.597 80.278 189.597 91.508 L 189.597 128.638 C 189.597 139.868 180.317 149.158 169.077 149.158 C 157.847 149.158 148.557 139.918 148.557 128.638 L 148.557 91.508 C 148.557 80.218 157.797 70.988 169.077 70.988 Z"
			>
			</path>
		{/if}
		<path
			d="M 7.439 108.649 C 25.693 108.649 42.28 125.421 42.28 136.651 C 42.28 136.651 27.916 134.087 9.743 134.087 C -8.414 134.087 -16.041 132.91 -16.041 132.91 C -16.041 121.62 -9.15 108.649 7.439 108.649 Z"
			style="transform-box: fill-box; transform-origin: 50% 50%;"
			transform="matrix(0, -1, 1, 0, 0.450493, -2.113495)"
		>
		</path>
		<path
			d="M 7.439 190.619 C 25.693 190.619 40.617 181.329 40.617 170.099 C 40.617 170.099 27.916 165.181 9.743 165.181 C -8.414 165.181 -16.041 166.358 -16.041 166.358 C -16.041 177.648 -9.15 190.619 7.439 190.619 Z"
			style="transform-box: fill-box; transform-origin: 50% 50%;"
			transform="matrix(0, 1, -1, 0, 0.000003, 0.000004)"
		>
		</path>
		{#if hasButton(MouseButtons.th5)}
			<path
				fill="#FFF185"
				d="M 9.439 110.649 C 23.693 110.649 34.123 117.523 36.617 129.169 C 36.617 129.169 23.916 132.087 11.743 132.087 C 0.584 132.087 -6.041 130.91 -6.041 130.91 C -6.041 121.62 0.32 110.649 9.439 110.649 Z"
				style="transform-box: fill-box; transform-origin: 50% 50%;"
				transform="matrix(0, -1, 1, 0, 0.000002, 0.000001)"
			>
			</path>
		{/if}
		{#if hasButton(MouseButtons.th4)}
			<path
				fill="#FFF185"
				d="M 8.608 188.62 C 22.862 188.62 35.786 181.33 35.786 170.1 C 35.786 170.1 23.085 167.182 10.912 167.182 C -0.247 167.182 -6.872 168.359 -6.872 168.359 C -6.872 177.649 -0.511 188.62 8.608 188.62 Z"
				style="transform-origin: 14.457px 177.901px;"
				id="object-0"
				transform="matrix(0, 1, -1, 0, 0.000011, 0.000011)"
			>
			</path>
		{/if}
	</g>
</svg>
