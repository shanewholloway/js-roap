import rpi_jsy from 'rollup-plugin-jsy'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import { terser as rpi_terser } from 'rollup-plugin-terser'

const configs = []
export default configs

const sourcemap = true
const plugins = [ rpi_jsy(), rpi_dgnotify() ]
const plugins_web = [ ... plugins, rpi_terser({}) ]


add_jsy('index', 'roap')
add_jsy('core', 'roap_core')
add_jsy('dom', 'roap_dom')


function add_jsy(src_name, module_name) {
  if (!module_name) module_name = src_name

  configs.push({
    input: `code/${src_name}.jsy`,
    output: [
      { file: `esm/${module_name}.mjs`, format: 'es', sourcemap },
      { file: `cjs/${module_name}.cjs`, format: 'cjs', sourcemap },
      { file: `umd/${module_name}.js`, name: module_name, format: 'umd', sourcemap },
    ],
    plugins })
  
  plugins_web && configs.push({
    input: `code/${src_name}.jsy`,
    output: [
      { file: `esm/${module_name}.min.mjs`, format: 'es' },
      { file: `umd/${module_name}.min.js`, name: module_name, format: 'umd' },
    ],
    plugins: plugins_web })
}
