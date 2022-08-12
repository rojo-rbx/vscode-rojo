const { readFile, writeFile } = require("fs/promises")
const https = require('https')

const API_DUMP_URL = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"

function getAPIDump() {
	return new Promise((resolve, reject) => {
		const req = https.get(API_DUMP_URL, res => {
			let raw = ""

			res.on('data', chunk => {
				raw += chunk;
			})

			res.on('end', () => {
				const data = JSON.parse(raw);
				resolve(data)
			})

		}).on('error', err => reject)

		req.end()
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
	await writeFile("dist/project.schema.json", newProjectSchema)
}

module.exports = class GenerateSchemaPlugin {
	apply(compiler) {
		// Generate the schema by reading the template, adding dynamic content, and writing to the main file location
		compiler.hooks.compile.tap("GenerateSchema", async () => {
			generateSchema()
		})
	}
}
