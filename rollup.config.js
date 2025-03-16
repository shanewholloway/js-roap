import rpi_jsy from 'rollup-plugin-jsy'
import rpi_terser from '@rollup/plugin-terser'

const external = id => /^\w+:|^#/.test(id)
const plugins = [rpi_jsy()]
const plugins_min = [rpi_terser({})]

export default [
  ... add_jsy('index', 'roap'),
]


function * add_jsy(src_name, name) {
  yield { plugins, external,
    input: `code/${src_name}.jsy`,
    output: [
      { file: `esm/${name}.mjs`, format: 'es', sourcemap: true },
      { file: `esm/${name}.min.js`, format: 'es', sourcemap: false, plugins: plugins_min },
    ]}
}
