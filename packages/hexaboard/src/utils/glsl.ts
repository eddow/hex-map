let mainContext: GLSLContext | undefined
const commonImports = import.meta.glob('../glsl/*.glsl', { eager: true })
const commonDefines = {}

function replacePragma(
	code: string,
	pragma: string,
	callback: (match: RegExpExecArray) => string | undefined
) {
	code = code
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.replaceAll('\n', '\u0001')
		.replaceAll(/\/\*.*?\*\//g, '')
	const rex = new RegExp(`${pragma}\\s*(:?//.*)\u0001`, 'g')
	for (let match = rex.exec(code); match !== null; match = rex.exec(code)) {
		const result = callback(match)
		if (result !== undefined) code = code.replace(match[0], result)
	}
	return code.replaceAll('\u0001', '\n')
}

export class GLSLContext {
	static get main() {
		if (!mainContext) mainContext = new GLSLContext()
		return mainContext
	}
	private imports: Record<string, string>
	private defines: Record<string, string>
	private constructor(
		private parent?: GLSLContext,
		imports: Record<string, string> = {},
		defines: Record<string, string> = {}
	) {
		const parentImports = parent ? parent.imports : (commonImports as Record<string, string>)
		const parentDefines = parent ? parent.defines : commonDefines
		this.imports = Object.create(parentImports)
		this.defines = Object.create(parentDefines)
		Object.assign(this.imports, imports)
		Object.assign(this.defines, defines)
	}
	public using(imports: Record<string, string>, defines: Record<string, string> = {}) {
		return new GLSLContext(this, imports, defines)
	}
	private withImports(code: string, imported: Set<string>): string {
		return replacePragma(code, '#imports+"([^"]+)"', (match) => {
			const importPath = match[1].replace(/\.glsl/, '')
			// If already imported, just remove the line
			if (!imported.has(importPath)) return ''
			imported.add(importPath)
			// If exists, actually import
			if (importPath in this.imports) {
				const importCode = this.imports[importPath]
				return `
//#region Imported from ${importPath}
${this.withImports(importCode, imported)}
//#endregion Imported from ${importPath}
`
			}
			// If inexistent, let `#import...` as is
		})
	}
	//public code(strings: TemplateStringsArray, ...values: any[]) {}
	public code(code: string) {
		let preprocessed = this.withImports(code, new Set())
		preprocessed = replacePragma(
			preprocessed,
			'#define\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s+(.*?)',
			(match) => {
				if (!this.defines[match[1]]) {
					this.defines[match[1]] = match[2]
					return ''
				}
			}
		)

		const uniforms = new Set<string>()
		//  #iUniform float displacementScale = 6. in { -12., 12. } // This will expose a slider to edit the value
		//const uniformRegex = /#iUniform\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+([^\n]*)\s+in\s+{([^\n]*)}/g
		preprocessed = replacePragma(
			preprocessed,
			'#iUniforms+([a-zA-Z_][a-zA-Z0-9_]*)s+([^\n]*)s+ins+{([^\n]*)}',
			(match) => {
				uniforms.add(match[1])
				return ''
			}
		)

		return new GLSLCode(
			Object.entries(this.defines)
				.map(([key, value]) => `#define ${key} ${value}\n`)
				.join('') + preprocessed
		)
	}
}

export class GLSLCode {
	constructor(
		private code: string,
		public uniforms: Set<string> = new Set()
	) {}
	public toString() {
		return this.code
	}
	execute(uniforms: Record<string, any>) {
		//TODO: Implement
		return this.code
	}
}
