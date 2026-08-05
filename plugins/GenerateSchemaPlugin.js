const { readFile, writeFile, mkdir } = require("fs/promises")
const https = require('https')

const API_DUMP_URL = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"

function getAPIDump() {
	return new Promise((resolve, reject) => {
		https.get(API_DUMP_URL, res => {
			if (res.statusCode !== 200) {
				res.resume()
				reject(new Error(
					`Could not download the Roblox API dump from ${API_DUMP_URL}: server responded with status ${res.statusCode}`
				))
				return
			}

			let raw = ""

			res.setEncoding("utf8")

			res.on('data', chunk => {
				raw += chunk
			})

			res.on('end', () => {
				try {
					resolve(JSON.parse(raw))
				} catch (err) {
					reject(new Error(`Could not parse the Roblox API dump: ${err.message}`))
				}
			})

			res.on('error', reject)
		}).on('error', reject)
	})
}

function getServiceNames(APIDump) {
	const services = []

	for (const thisClass of APIDump.Classes) {
		const tags = thisClass.Tags
		if (tags && tags.includes("Service")) {
			services.push(thisClass.Name)
		}
	}

	return services
}

function getClassNames(APIDump) {
	const services = []

	for (const thisClass of APIDump.Classes) {
		services.push(thisClass.Name)
	}

	return services
}

async function generateSchema() {
	const dump = await getAPIDump()

	const currentProjectSchema = JSON.parse((await readFile("schemas/project.template.schema.json")).toString())

	const servicesRoot = currentProjectSchema.properties.tree.then.allOf[1].properties
	const services = getServiceNames(dump)

	for (const service of services) {
		if (!servicesRoot[service]) {
			servicesRoot[service] = {
				"$ref": "#/$defs/treeService"
			}
		}
	}

	const classesAnyOf = currentProjectSchema["$defs"].tree.properties["$className"].anyOf
	const classesEnum = getClassNames(dump)

	classesAnyOf.push({
		"enum": classesEnum,
	})

	const newProjectSchema = JSON.stringify(currentProjectSchema)
	await mkdir("dist", { recursive: true })
	await writeFile("dist/project.schema.json", newProjectSchema)
}

module.exports = class GenerateSchemaPlugin {
	apply(compiler) {
		// Generate the schema by reading the template, adding dynamic content, and writing to the main file location.
		// `beforeCompile` is an async hook, so tapping it with a promise makes webpack wait for the schema to be
		// written before the build continues. `compile` is synchronous and would let the build finish first.
		compiler.hooks.beforeCompile.tapPromise("GenerateSchema", () => generateSchema())
	}
}
