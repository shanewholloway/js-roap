import rpi_jsy from 'rollup-plugin-jsy'
import { terser as rpi_terser } from 'rollup-plugin-terser'

const configs = []
export default configs

const sourcemap = true
const plugins = [ rpi_jsy() ]
const plugins_web = [ ... plugins, rpi_terser({}) ]


add_jsy('index')
add_jsy('deferred')
add_jsy('watch')


function add_jsy(src_name, module_name) {
  if (!module_name) module_name = src_name

  configs.push(
   {input: `code/${src_name}.jsy`,
    output: { file: `esm/${src_name}.mjs`, format: 'es', sourcemap },
    plugins },
  
   {input: `code/${src_name}.jsy`,
    output: { file: `esm/${src_name}.min.mjs`, format: 'es', sourcemap },
    plugins: plugins_web },
  )
}
